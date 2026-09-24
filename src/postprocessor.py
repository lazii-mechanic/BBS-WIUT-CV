"""
postprocessor.py — Aggregates per-frame event detections into valid segments [start_sec, end_sec, label].
Enforces all rules from evaluate.py:
  1. 0 <= start_sec < end_sec <= duration
  2. Non-overlapping segments for the same class
  3. Merge gaps between segments of the same class (< gap_threshold)
  4. Drop spurious micro-blips (< min_duration)
"""
from __future__ import annotations
from collections import defaultdict
from typing import List, Tuple

def merge_raw_frames(frame_events: list[tuple[float, str]],
                     duration: float,
                     fps_sample: float = 10.0,
                     min_duration: float = 0.5,
                     gap_threshold: float = 1.2) -> list[list]:
    """
    Args:
        frame_events: list of (t_sec, label) detections emitted per sampled frame.
        duration: video total duration in seconds.
        fps_sample: effective sampling rate (e.g. 10 fps).
        min_duration: minimum duration for an event to be retained.
        gap_threshold: maximum time gap (s) to merge two segments of the same class.

    Returns:
        Clean, sorted list of [[start_sec, end_sec, label], ...]
    """
    if not frame_events:
        return []

    # Group timestamps by class
    by_class: dict[str, list[float]] = defaultdict(list)
    for t_sec, label in frame_events:
        by_class[label].append(float(t_sec))

    dt = 1.0 / fps_sample if fps_sample > 0 else 0.1
    all_events: list[list] = []

    for label, times in by_class.items():
        times = sorted(set(times))
        if not times:
            continue

        # Cluster timestamps into segments
        segments: list[list[float]] = []
        seg_start = times[0]
        seg_end = times[0] + dt

        for t in times[1:]:
            if t <= seg_end + gap_threshold:
                # Extend segment
                seg_end = max(seg_end, t + dt)
            else:
                # Close current segment
                if (seg_end - seg_start) >= min_duration:
                    segments.append([seg_start, min(seg_end, duration)])
                seg_start = t
                seg_end = t + dt

        # Close the last segment
        if (seg_end - seg_start) >= min_duration:
            segments.append([seg_start, min(seg_end, duration)])

        # Ensure no overlaps among segments of the same class
        # (merge any that overlap or touch)
        merged: list[list[float]] = []
        for s, e in segments:
            if not merged:
                merged.append([s, e])
            else:
                last_s, last_e = merged[-1]
                if s <= last_e:
                    merged[-1][1] = max(last_e, e)
                else:
                    merged.append([s, e])

        for s, e in merged:
            s_round = round(max(0.0, float(s)), 2)
            e_round = round(min(duration, float(e)), 2)
            if e_round > s_round + 0.1:
                all_events.append([s_round, e_round, label])

    # Sort all events chronologically
    all_events.sort(key=lambda x: (x[0], x[1], x[2]))
    return all_events
