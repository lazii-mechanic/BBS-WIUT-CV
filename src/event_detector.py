"""
event_detector.py — High-precision event detection engine for WIUT Hackathon 2026.
Evaluates tracked road users and scene geometry to detect:
  1. failure_to_yield
  2. jaywalking
  3. stopped_vehicle
  4. wrong_way
  5. congestion
  6. accident
  7. near_miss
  8. red_light
  9. stop_line
"""
from __future__ import annotations
import cv2
import numpy as np
from collections import defaultdict
from typing import Dict, List, Tuple, Set

from scene_config import CROSSWALKS, STOP_LINES, ROADWAY, PEDESTRIAN_SAFE_ZONES
from tracker import TrackState


def pt_in_poly(pt: Tuple[float, float], poly: np.ndarray) -> bool:
    """Returns True if point (x, y) is inside or on the boundary of polygon."""
    return cv2.pointPolygonTest(poly.astype(np.float32), (float(pt[0]), float(pt[1])), False) >= 0


def box_intersects_poly(box: np.ndarray, poly: np.ndarray) -> bool:
    """
    Checks if box [x1, y1, x2, y2] intersects polygon.
    Tests center, corners, and midpoint edges.
    """
    x1, y1, x2, y2 = box
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0

    if pt_in_poly((cx, cy), poly) or pt_in_poly((cx, y2), poly):
        return True

    for px, py in [(x1, y1), (x2, y1), (x1, y2), (x2, y2)]:
        if pt_in_poly((px, py), poly):
            return True

    return False


def box_iou(b1: np.ndarray, b2: np.ndarray) -> float:
    ix1 = max(b1[0], b2[0])
    iy1 = max(b1[1], b2[1])
    ix2 = min(b1[2], b2[2])
    iy2 = min(b1[3], b2[3])

    inter_w = max(0.0, ix2 - ix1)
    inter_h = max(0.0, iy2 - iy1)
    inter_area = inter_w * inter_h
    if inter_area <= 0:
        return 0.0

    a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
    a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
    union = a1 + a2 - inter_area
    return inter_area / union if union > 0 else 0.0


class EventDetector:
    def __init__(self):
        # Durations & state trackers
        self.ped_jaywalk_start: Dict[int, float] = {}
        self.vehicle_stopped_start: Dict[int, float] = {}
        self.wrong_way_start: Dict[int, float] = {}
        self.congestion_start: Optional[float] = None

        # Red light & stop line state
        self.crossed_stop_line_on_red: Set[int] = set()
        self.violating_stop_line: Set[int] = set()

        # Accident tracking: (id1, id2) -> (collision_time, start_t, stationary_t)
        self.potential_accidents: Dict[Tuple[int, int], float] = {}
        self.confirmed_accidents: Dict[Tuple[int, int], float] = {}

        # Near miss tracking: (id1, id2) -> start_t
        self.near_miss_candidates: Dict[Tuple[int, int], float] = {}

    def is_red_light_phase(self, vehicles: List[TrackState]) -> bool:
        """
        Determines if the signal is red for incoming carriageway.
        Signal is red when >= 2 vehicles are stopped before stop line (y: 0.35..0.49).
        """
        stopped_at_line = 0
        for v in vehicles:
            cx, cy = v.current_center
            if 0.15 <= cx <= 0.46 and 0.35 <= cy <= 0.49:
                if v.speed < 0.010:
                    stopped_at_line += 1
        return stopped_at_line >= 2

    def update(self, tracks: List[TrackState], t_sec: float) -> List[Tuple[float, str]]:
        events: List[Tuple[float, str]] = []

        pedestrians = [t for t in tracks if t.is_pedestrian]
        vehicles = [t for t in tracks if t.is_vehicle]

        # -------------------------------------------------------------
        # 1. Update Pedestrian locations: Crosswalk vs Jaywalking
        # -------------------------------------------------------------
        active_ped_ids = set()
        peds_in_crosswalks: Dict[str, List[Tuple[TrackState, Tuple[float, float]]]] = defaultdict(list)

        for p in pedestrians:
            active_ped_ids.add(p.track_id)
            box = p.current_box
            foot = ((box[0] + box[2]) / 2.0, box[3])
            center = p.current_center

            in_cw = False
            for cw_name, cw_poly in CROSSWALKS.items():
                if pt_in_poly(foot, cw_poly) or pt_in_poly(center, cw_poly):
                    in_cw = True
                    peds_in_crosswalks[cw_name].append((p, foot))
                    break

            in_safe_zone = False
            for zone_poly in PEDESTRIAN_SAFE_ZONES:
                if pt_in_poly(foot, zone_poly) or pt_in_poly(center, zone_poly):
                    in_safe_zone = True
                    break

            in_roadway = pt_in_poly(foot, ROADWAY) or pt_in_poly(center, ROADWAY)

            # Jaywalking: on road, outside crossing and outside pedestrian island
            if in_roadway and not in_cw and not in_safe_zone:
                if p.track_id not in self.ped_jaywalk_start:
                    self.ped_jaywalk_start[p.track_id] = t_sec
                elif (t_sec - self.ped_jaywalk_start[p.track_id]) >= 0.8:
                    events.append((t_sec, "jaywalking"))
            else:
                self.ped_jaywalk_start.pop(p.track_id, None)

        for pid in list(self.ped_jaywalk_start.keys()):
            if pid not in active_ped_ids:
                del self.ped_jaywalk_start[pid]

        # -------------------------------------------------------------
        # 2. Failure to Yield
        # Vehicle driving through crosswalk while pedestrian is crossing
        # -------------------------------------------------------------
        for cw_name, peds_list in peds_in_crosswalks.items():
            if not peds_list:
                continue
            cw_poly = CROSSWALKS[cw_name]

            for v in vehicles:
                # Vehicle moving through crosswalk
                if v.speed > 0.012 and box_intersects_poly(v.current_box, cw_poly):
                    vc = v.current_center
                    # Check distance to pedestrian to avoid false triggers across 4 lanes
                    min_dist = min(np.linalg.norm(np.array(vc) - np.array(p_foot)) for _, p_foot in peds_list)
                    if min_dist < 0.22:
                        events.append((t_sec, "failure_to_yield"))
                        break

        # -------------------------------------------------------------
        # 3. Traffic Light Violations: red_light & stop_line
        # -------------------------------------------------------------
        signal_red = self.is_red_light_phase(vehicles)
        for v in vehicles:
            cx, cy = v.current_center
            vx, vy = v.velocity

            # If signal is red for incoming carriageway
            if signal_red and (0.15 <= cx <= 0.48):
                # Car crossed stop line (cy > 0.48) and keeps moving forward into intersection
                if cy > 0.49 and cy < 0.70 and vy > 0.020:
                    events.append((t_sec, "red_light"))
                # Car stopped past the stop line without entering intersection
                elif cy > 0.48 and cy < 0.58 and v.speed < 0.008:
                    events.append((t_sec, "stop_line"))

        # -------------------------------------------------------------
        # 4. Stopped Vehicle (stationary on carriageway >= 10s)
        # Not in a queue at a signal
        # -------------------------------------------------------------
        for v in vehicles:
            cx, cy = v.current_center
            # Queue zone before stop line: left carriageway waiting for signal
            is_in_signal_queue = (0.12 <= cx <= 0.50 and 0.18 <= cy <= 0.52)

            if pt_in_poly((cx, cy), ROADWAY) and not is_in_signal_queue:
                if v.stationary_duration >= 10.0:
                    events.append((t_sec, "stopped_vehicle"))

        # -------------------------------------------------------------
        # 5. Wrong-Way Driving (Corrected direction logic)
        # -------------------------------------------------------------
        for v in vehicles:
            if len(v.history) < 6:
                continue
            cx, cy = v.current_center
            vx, vy = v.velocity

            is_wrong = False
            # Sector 1: Left incoming carriageway (entering intersection towards bottom-right)
            # Normal flow: vy > 0. Wrong way: driving backwards away from intersection (vy < -0.030)
            if 0.12 <= cx <= 0.48 and 0.20 <= cy <= 0.65:
                if vy < -0.030 and abs(vy) > abs(vx):
                    is_wrong = True

            # Sector 2: Far carriageway behind median strip (normal flow is to the left: vx < 0)
            # Wrong way: driving to the RIGHT (vx > 0.035)
            elif 0.05 <= cx <= 0.95 and 0.05 <= cy < 0.22:
                if vx > 0.035 and abs(vx) > abs(vy):
                    is_wrong = True

            if is_wrong:
                if v.track_id not in self.wrong_way_start:
                    self.wrong_way_start[v.track_id] = t_sec
                elif (t_sec - self.wrong_way_start[v.track_id]) >= 1.2:
                    events.append((t_sec, "wrong_way"))
            else:
                self.wrong_way_start.pop(v.track_id, None)

        # -------------------------------------------------------------
        # 6. Congestion
        # Standstill or crawling across all lanes of incoming direction
        # -------------------------------------------------------------
        incoming_vehicles = [
            v for v in vehicles
            if (0.15 <= v.current_center[0] <= 0.48 and 0.20 <= v.current_center[1] <= 0.52)
        ]
        if len(incoming_vehicles) >= 6:
            slow_or_stopped = [v for v in incoming_vehicles if v.speed < 0.008]
            if len(slow_or_stopped) / float(len(incoming_vehicles)) >= 0.80:
                if self.congestion_start is None:
                    self.congestion_start = t_sec
                elif (t_sec - self.congestion_start) >= 3.0:
                    events.append((t_sec, "congestion"))
            else:
                self.congestion_start = None
        else:
            self.congestion_start = None

        # -------------------------------------------------------------
        # 7. Collision (accident) & Near Miss
        # -------------------------------------------------------------
        n_veh = len(vehicles)
        for i in range(n_veh):
            v1 = vehicles[i]
            b1 = v1.current_box
            c1 = v1.current_center

            for j in range(i + 1, n_veh):
                v2 = vehicles[j]
                b2 = v2.current_box
                c2 = v2.current_center

                pair_key = (min(v1.track_id, v2.track_id), max(v1.track_id, v2.track_id))
                iou = box_iou(b1, b2)
                dist = float(np.linalg.norm(c1 - c2))

                # Check if this pair is waiting in signal queue (not an accident)
                in_queue = (
                    0.15 <= c1[0] <= 0.48 and 0.20 <= c1[1] <= 0.50 and
                    0.15 <= c2[0] <= 0.48 and 0.20 <= c2[1] <= 0.50 and
                    v1.speed < 0.012 and v2.speed < 0.012
                )

                # ---------------------------------------------------------
                # Accident criteria:
                # 1. Physical contact (IoU > 0.18 or centers extremely close dist < 0.035)
                # 2. Before contact, at least one vehicle had notable speed (max_recent_speed > 0.022)
                # 3. CRUCIAL: After contact, vehicles STOP (speed < 0.007) and remain stopped for >= 2.0s
                # ---------------------------------------------------------
                had_prior_motion = (v1.max_recent_speed > 0.022 or v2.max_recent_speed > 0.022)
                is_contact = (iou > 0.18 or dist < 0.035)

                if is_contact and had_prior_motion:
                    # Check if vehicles stopped following contact
                    stopped_after_contact = (v1.speed < 0.007 and v2.speed < 0.007)
                    if stopped_after_contact:
                        if pair_key not in self.potential_accidents:
                            self.potential_accidents[pair_key] = t_sec
                        else:
                            stopped_duration = t_sec - self.potential_accidents[pair_key]
                            if stopped_duration >= 3.5:
                                events.append((t_sec, "accident"))
                    else:
                        self.potential_accidents.pop(pair_key, None)
                else:
                    self.potential_accidents.pop(pair_key, None)

                    # ---------------------------------------------------------
                    # Near miss criteria:
                    # 1. Close encounter: 0.030 < dist < 0.070, no box overlap (iou < 0.10)
                    # 2. High approach speed
                    # 3. Fast converging closure rate
                    # 4. Sharp evasive action: at least one vehicle brakes sharply (acceleration < -0.025)
                    max_speed = max(v1.speed, v2.speed)
                    if 0.030 < dist < 0.070 and max_speed > 0.020 and iou < 0.10:
                        rel_v = v1.velocity - v2.velocity
                        closure = np.dot(c2 - c1, rel_v)
                        sharp_braking = (v1.acceleration < -0.025 or v2.acceleration < -0.025)
                        if closure > 0.002 and sharp_braking:
                            events.append((t_sec, "near_miss"))

        return events
