"""
solution.py — the ONLY file a team has to implement.

The organizers' harness (run_submission.py) imports this module and calls:

    detect_events(video_path)  -> [[start_sec, end_sec, label], ...]    # Part A
    RiskEstimator().reset(meta); .step(frame, t_sec) -> float           # Part B (optional)

Keep the names and signatures exactly as they are. Everything else — models,
tracking, rules, helper modules under src/ — is up to you.

Labels must come from CLASSES. You may REMOVE classes you never predict;
do not add new ids.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
import cv2
import numpy as np

# Add src to sys.path for direct imports
_src_dir = str(Path(__file__).parent / "src")
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)


from src.tracker import RoadTracker
from src.event_detector import EventDetector
from src.postprocessor import merge_raw_frames


# Official class ids (14). See the task description for definitions and
# start/end conventions. Remove entries you never predict; never add.
CLASSES: list[str] = [
    "accident",            # collision between road users / with a fixed object
    "near_miss",           # sharp braking or swerving to avoid a collision, no contact
    "red_light",           # crossing the stop line on red
    "wrong_way",           # driving against the traffic direction / in the oncoming lane
    "stopped_vehicle",     # stationary on the carriageway >= 10 s, not queued at a signal
    "jaywalking",          # pedestrian on the carriageway outside a crossing
    "failure_to_yield",    # driving through a crossing while a pedestrian is on it
    "stop_line",           # stopped past the stop line on red
    "congestion",          # standstill / crawling traffic across all lanes of a direction
]

# Anticipation horizon used by the metric (seconds). step() should return
# P(an `accident` starts within the next RISK_HORIZON_SEC seconds).
RISK_HORIZON_SEC = 5.0


def detect_events(video_path: str) -> list[list]:
    """Part A — traffic event detection.

    Args:
        video_path: path to one .mp4 file.

    Returns:
        A list of events, each ``[start_sec, end_sec, label]`` with
        ``0 <= start_sec < end_sec <= duration`` and ``label in CLASSES``.
        Segments of the same class do not overlap.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[solution] Cannot open video: {video_path}")
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = n_frames / fps if fps else 0.0

    # Stride of 3 gives ~10 fps sampling on 30 fps video.
    # cap.grab() on non-sampled frames skips full 4K frame decompression.
    stride = 3
    effective_fps = fps / stride

    print(f"[solution] Processing {video_path}: {n_frames} frames, {duration:.1f}s at {fps:.1f} fps (stride={stride})...")
    tracker = RoadTracker(model_name="yolo11n.pt", imgsz=768, conf=0.25)
    detector = EventDetector()

    raw_frame_events = []
    frame_idx = 0

    while True:
        if frame_idx % stride == 0:
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            t_sec = frame_idx / fps
            try:
                # Fast downscale 4K frames to 1080p for 3x throughput speedup
                H, W = frame.shape[:2]
                if H > 1080:
                    scale = 1080.0 / H
                    new_w = int(W * scale)
                    proc_frame = cv2.resize(frame, (new_w, 1080), interpolation=cv2.INTER_LINEAR)
                else:
                    proc_frame = frame
                active_tracks = tracker.process_frame(proc_frame, t_sec)
                emitted = detector.update(active_tracks, t_sec)
                for ev in emitted:
                    raw_frame_events.append(ev)
            except Exception as frame_err:
                print(f"[solution] Warning at {t_sec:.1f}s: {frame_err}")
        else:
            ret = cap.grab()
            if not ret:
                break

        frame_idx += 1
        if frame_idx % 1000 == 0:
            pct = (frame_idx / n_frames) * 100.0 if n_frames else 0.0
            print(f"[solution] Progress: {frame_idx}/{n_frames} ({pct:.1f}%) | Raw events: {len(raw_frame_events)}")

    cap.release()

    events = merge_raw_frames(
        raw_frame_events,
        duration=duration,
        fps_sample=effective_fps,
        min_duration=0.6,
        gap_threshold=1.5
    )

    print(f"[solution] Detection completed: {len(events)} segments merged for {video_path}")
    return events


class RiskEstimator:
    """Part B — causal accident anticipation (TTC + looming, geometry-free)."""

    def __init__(self) -> None:
        self._impl = None

    def reset(self, meta: dict) -> None:
        self.meta = meta
        self.last_score = 0.0
        try:
            from src.risk_estimator import TTCRiskEstimator
        except Exception:
            try:
                from risk_estimator import TTCRiskEstimator
            except Exception:
                self._impl = None
                return
        if self._impl is None:
            self._impl = TTCRiskEstimator(proc_stride=5, imgsz=512, conf=0.25)
        self._impl.reset(meta)

    def step(self, frame: np.ndarray, t_sec: float) -> float:
        if self._impl is None:
            return 0.0
        try:
            self.last_score = float(self._impl.step(frame, t_sec))
        except Exception:
            self.last_score = 0.0
        return self.last_score
