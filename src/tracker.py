"""
tracker.py — Ultralytics YOLO + ByteTrack wrapper for road users.
Extracts normalized bounding boxes, track IDs, velocities, and stationary state.
"""
from __future__ import annotations

import numpy as np
from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple

COCO_PEDESTRIAN_IDS = {0}                     # person
COCO_VEHICLE_IDS = {1, 2, 3, 5, 7}            # bicycle, car, motorcycle, bus, truck

COCO_NAMES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

class TrackState:
    def __init__(self, track_id: int, cls_id: int, t_sec: float,
                 box_norm: np.ndarray, center_norm: np.ndarray):
        self.track_id = track_id
        self.cls_id = cls_id
        self.cls_name = COCO_NAMES.get(cls_id, "vehicle")
        self.is_pedestrian = (cls_id in COCO_PEDESTRIAN_IDS)
        self.is_vehicle = (cls_id in COCO_VEHICLE_IDS)

        # History of (t_sec, center_norm, box_norm)
        self.history = deque(maxlen=40)
        self.history.append((t_sec, center_norm, box_norm))

        self.first_seen_t = t_sec
        self.last_seen_t = t_sec
        self.velocity = np.array([0.0, 0.0], dtype=np.float32)  # (vx, vy) in norm units / sec
        self.speed = 0.0
        self.acceleration = 0.0
        self.stationary_start_t = t_sec  # When stationary state started

    def update(self, t_sec: float, box_norm: np.ndarray, center_norm: np.ndarray):
        dt = t_sec - self.last_seen_t
        if dt > 1e-4:
            prev_center = self.history[-1][1]
            prev_speed = self.speed
            inst_v = (center_norm - prev_center) / dt
            # Smooth velocity
            self.velocity = 0.6 * self.velocity + 0.4 * inst_v
            self.speed = float(np.linalg.norm(self.velocity))
            self.acceleration = 0.5 * self.acceleration + 0.5 * ((self.speed - prev_speed) / dt)

        self.last_seen_t = t_sec
        self.history.append((t_sec, center_norm, box_norm))

        # Check if stationary (speed < 0.012 in normalized coords/sec)
        if self.speed > 0.015:
            self.stationary_start_t = t_sec

    @property
    def max_recent_speed(self) -> float:
        if len(self.history) < 2:
            return self.speed
        # Max speed across last up to 15 frames
        pts = list(self.history)[-15:]
        max_s = 0.0
        for i in range(1, len(pts)):
            dt = pts[i][0] - pts[i-1][0]
            if dt > 1e-4:
                s = float(np.linalg.norm(pts[i][1] - pts[i-1][1])) / dt
                if s > max_s:
                    max_s = s
        return max_s

    @property
    def windowed_acceleration(self) -> float:
        """Robust multi-frame acceleration over sliding window (cuts 1-frame jitter)."""
        if len(self.history) < 5:
            return self.acceleration
        pts = list(self.history)
        t_curr, c_curr, _ = pts[-1]
        t_mid, c_mid, _ = pts[-3]
        t_old, c_old, _ = pts[-5]
        dt1 = t_curr - t_mid
        dt2 = t_mid - t_old
        if dt1 > 1e-3 and dt2 > 1e-3:
            s_curr = float(np.linalg.norm(c_curr - c_mid)) / dt1
            s_prev = float(np.linalg.norm(c_mid - c_old)) / dt2
            return (s_curr - s_prev) / (0.5 * (dt1 + dt2))
        return self.acceleration

    @property
    def stationary_duration(self) -> float:
        return self.last_seen_t - self.stationary_start_t

    @property
    def current_box(self) -> np.ndarray:
        return self.history[-1][2]

    @property
    def current_center(self) -> np.ndarray:
        return self.history[-1][1]


class RoadTracker:
    def __init__(self, model_name: str = "yolo11n.pt", imgsz: int = 768, conf: float = 0.25):
        from ultralytics import YOLO
        from pathlib import Path
        import torch
        weights_candidate = Path(__file__).parent.parent / "weights" / model_name
        target = str(weights_candidate) if weights_candidate.exists() else model_name
        self.model = YOLO(target)
        self.device = 0 if torch.cuda.is_available() else "cpu"
        self.imgsz = imgsz
        self.conf = conf
        self.tracked_objects: Dict[int, TrackState] = {}
        self.interest_classes = list(COCO_PEDESTRIAN_IDS | COCO_VEHICLE_IDS)

    def process_frame(self, frame: np.ndarray, t_sec: float) -> List[TrackState]:
        """
        Run YOLO detection and ByteTrack tracking on one frame.
        Returns list of active TrackStates with normalized coordinates.
        """
        H, W = frame.shape[:2]

        results = self.model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=self.interest_classes,
            conf=self.conf,
            iou=0.5,
            imgsz=self.imgsz,
            device=self.device,
            verbose=False
        )

        active_tracks: List[TrackState] = []
        res = results[0]
        boxes = res.boxes

        if boxes is not None and boxes.id is not None:
            xyxy_list = boxes.xyxy.cpu().numpy()
            id_list = boxes.id.int().cpu().tolist()
            cls_list = boxes.cls.int().cpu().tolist()

            for xyxy, track_id, cls_id in zip(xyxy_list, id_list, cls_list):
                # Normalized coords
                box_norm = np.array([
                    xyxy[0] / W,
                    xyxy[1] / H,
                    xyxy[2] / W,
                    xyxy[3] / H
                ], dtype=np.float32)

                center_norm = np.array([
                    (box_norm[0] + box_norm[2]) / 2.0,
                    (box_norm[1] + box_norm[3]) / 2.0
                ], dtype=np.float32)

                if track_id not in self.tracked_objects:
                    state = TrackState(track_id, cls_id, t_sec, box_norm, center_norm)
                    self.tracked_objects[track_id] = state
                else:
                    state = self.tracked_objects[track_id]
                    state.update(t_sec, box_norm, center_norm)

                active_tracks.append(state)

        # Cleanup stale tracks (> 3.0s unobserved)
        stale_ids = [tid for tid, s in self.tracked_objects.items() if (t_sec - s.last_seen_t) > 3.0]
        for tid in stale_ids:
            del self.tracked_objects[tid]

        return active_tracks
