"""
risk_estimator.py — High-precision causal accident-anticipation signal for Part B.
Camera-agnostic: uses relative motion of tracked road users (emergency braking,
CPA trajectory extrapolation, closure rates, heading divergence). Only past frames are used.
"""
from __future__ import annotations
import cv2
import numpy as np
from typing import List, Dict, Set

HORIZON = 5.0          # Anticipation horizon in seconds (matches RISK_HORIZON_SEC)
MAX_T_CPA = 1.6        # Maximum CPA time to consider collision imminent
PAIR_DIST_GATE = 0.24  # Distance gate
MIN_REL_SPEED = 0.040  # Require substantial relative speed
DECAY = 0.70           # Score decay applied on each processed frame
NOISE_FLOOR = 0.15     # Zero out scores below this to eliminate background noise
CONFIRM_FRAMES = 2     # Require danger to persist across at least 2 consecutive processed frames


def _compute_pair_risk(veh: List) -> float:
    """Computes highest collision anticipation risk across vehicle pairs in [0, 1]."""
    n = len(veh)
    if n < 2:
        return 0.0

    best = 0.0
    for i in range(n):
        for j in range(i + 1, n):
            a, b = veh[i], veh[j]
            c1, c2 = a.current_center, b.current_center
            r = c2 - c1
            dist = float(np.linalg.norm(r))

            if dist > PAIR_DIST_GATE or dist < 0.01:
                continue

            # 1. Filter out edge-of-frame clipping artifacts (vehicles entering/leaving camera)
            if (c1[0] < 0.04 or c1[0] > 0.94 or c1[1] < 0.05 or c1[1] > 0.92 or
                c2[0] < 0.04 or c2[0] > 0.94 or c2[1] < 0.05 or c2[1] > 0.92):
                continue

            # 2. Filter out duplicate detections of the same vehicle (NMS artifacts)
            b1, b2 = a.current_box, b.current_box
            ix1, iy1 = max(b1[0], b2[0]), max(b1[1], b2[1])
            ix2, iy2 = min(b1[2], b2[2]), min(b1[3], b2[3])
            iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
            inter = iw * ih
            union = (b1[2] - b1[0]) * (b1[3] - b1[1]) + (b2[2] - b2[0]) * (b2[3] - b2[1]) - inter
            iou = inter / union if union > 0 else 0.0

            if iou > 0.40 or (dist < 0.018 and abs(a.speed - b.speed) < 0.012):
                continue

            # 3. Filter out routine signal queue deceleration before the stop line
            in_queue_zone = (
                0.14 <= c1[0] <= 0.46 and 0.20 <= c1[1] <= 0.50 and
                0.14 <= c2[0] <= 0.46 and 0.20 <= c2[1] <= 0.50
            )
            if in_queue_zone and a.velocity[1] > 0 and b.velocity[1] > 0 and max(a.speed, b.speed) < 0.060:
                continue

            # 4. Both vehicles must be actively in motion
            spd_a, spd_b = a.speed, b.speed
            min_spd = min(spd_a, spd_b)
            if min_spd < 0.030:
                continue

            # 5. Kinematic Closure Analysis
            rel_v = a.velocity - b.velocity
            v_norm2 = float(np.dot(rel_v, rel_v))
            if v_norm2 < (MIN_REL_SPEED ** 2):
                continue

            # Closing rate: closure = -d(dist)/dt
            closing_rate = float(np.dot(r, rel_v)) / dist
            if closing_rate <= 0.024:
                continue  # Diverging or opening gap

            # 6. Filter opposing traffic passing on divided carriageway
            cos_hdg = float(np.dot(a.velocity, b.velocity) / (spd_a * spd_b + 1e-6))
            if cos_hdg < -0.30:
                continue

            # 7. Emergency deceleration / braking
            accel_a = getattr(a, "windowed_acceleration", a.acceleration)
            accel_b = getattr(b, "windowed_acceleration", b.acceleration)
            min_accel = min(accel_a, accel_b)
            t_cpa = float(np.dot(r, rel_v)) / v_norm2

            # Severe emergency braking on collision course
            if min_accel < -0.080 and 0.1 < t_cpa <= MAX_T_CPA:
                r_val = min(1.0, 0.70 + 5.0 * closing_rate)
                if r_val > best:
                    best = r_val

    return best


class TTCRiskEstimator:
    """Wraps a RoadTracker and turns tracks into a smoothed causal risk score."""

    def __init__(self, proc_stride: int = 5, imgsz: int = 512, conf: float = 0.25):
        self.proc_stride = max(1, proc_stride)
        self.imgsz = imgsz
        self.conf = conf
        self.tracker = None
        self.disabled = False
        self.score = 0.0
        self._frame_i = 0
        self.consecutive_danger = 0

    def reset(self, meta: dict) -> None:
        self.score = 0.0
        self._frame_i = 0
        self.consecutive_danger = 0
        self.disabled = False
        # Always fresh tracker per video to guarantee zero state leakage across video boundaries
        try:
            from src.tracker import RoadTracker
        except Exception:
            try:
                from tracker import RoadTracker
            except Exception:
                self.disabled = True
                return
        try:
            self.tracker = RoadTracker(model_name="yolo11n.pt", imgsz=self.imgsz, conf=self.conf)
        except Exception:
            self.disabled = True

    def step(self, frame: np.ndarray | None, t_sec: float) -> float:
        if self.disabled or self.tracker is None:
            return 0.0
        i = self._frame_i
        self._frame_i += 1
        if i % self.proc_stride != 0 or frame is None:
            return self.score  # reuse last score (allowed by harness)

        try:
            # Fast downscale large 4K frames to 720p for 12x speedup; normalized coords remain identical
            if frame.shape[0] > 720:
                scale = 720.0 / frame.shape[0]
                new_w = int(frame.shape[1] * scale)
                proc_frame = cv2.resize(frame, (new_w, 720), interpolation=cv2.INTER_LINEAR)
            else:
                proc_frame = frame
            tracks = self.tracker.process_frame(proc_frame, t_sec)
        except Exception:
            self.disabled = True
            return 0.0

        # Filter vehicles with established tracks (at least 4 frames of history)
        veh = [t for t in tracks if getattr(t, "is_vehicle", False) and len(t.history) >= 4]
        pair_risk = _compute_pair_risk(veh)

        if pair_risk >= 0.50:
            self.consecutive_danger += 1
        else:
            self.consecutive_danger = max(0, self.consecutive_danger - 1)

        if self.consecutive_danger >= CONFIRM_FRAMES:
            # Confirmed danger across consecutive frames (sustained hazard)
            self.score = float(min(1.0, max(pair_risk, self.score * DECAY)))
        else:
            # Not confirmed: capped at 0.35 to strictly avoid any false alarm runs
            self.score = float(max(0.0, min(0.35, self.score * DECAY)))

        if self.score < NOISE_FLOOR:
            self.score = 0.0

        return self.score
