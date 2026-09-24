"""
scene_config.py — Spatial calibration and geometry for the fixed CCTV camera in Tashkent.
All coordinates are normalized (0.0 to 1.0) so they apply to any image resolution.
"""
from __future__ import annotations
import numpy as np

# Crosswalks (polygons in normalized [0, 1] coordinates: (x, y))
CROSSWALKS = {
    # Main pedestrian crossing across the left incoming carriageway (extends to median island)
    "crosswalk_left": np.array([
        [0.170, 0.550],
        [0.580, 0.460],
        [0.565, 0.530],
        [0.130, 0.635]
    ], dtype=np.float32),

    # Crosswalk on the right side of the intersection
    "crosswalk_right": np.array([
        [0.615, 0.445],
        [0.965, 0.460],
        [0.965, 0.535],
        [0.620, 0.525]
    ], dtype=np.float32),

    # Foreground bottom-left crosswalk
    "crosswalk_bottom_left": np.array([
        [0.050, 0.730],
        [0.230, 0.685],
        [0.470, 0.990],
        [0.240, 0.990]
    ], dtype=np.float32),
}

# Stop lines before crosswalks (lines: [p1, p2])
STOP_LINES = {
    # Stop line on the left carriageway before crosswalk_left
    "stop_line_left": (
        np.array([0.180, 0.490], dtype=np.float32),
        np.array([0.435, 0.455], dtype=np.float32)
    )
}

# Drivable roadway polygon (approximate bounds of the asphalt surface)
ROADWAY = np.array([
    [0.020, 0.050],
    [0.600, 0.050],
    [0.990, 0.320],
    [0.990, 0.980],
    [0.450, 0.990],
    [0.200, 0.680],
    [0.010, 0.600],
], dtype=np.float32)

# Sidewalks / islands where pedestrians are legally present (not jaywalking)
PEDESTRIAN_SAFE_ZONES = [
    # Center triangular island between crosswalks
    np.array([
        [0.260, 0.630],
        [0.400, 0.670],
        [0.320, 0.740]
    ], dtype=np.float32),
    # Lower rectangular island
    np.array([
        [0.350, 0.760],
        [0.500, 0.760],
        [0.480, 0.850],
        [0.350, 0.850]
    ], dtype=np.float32),
    # Right sidewalk / pedestrian refuge island
    np.array([
        [0.575, 0.440],
        [0.680, 0.440],
        [0.680, 0.540],
        [0.575, 0.540]
    ], dtype=np.float32),
]

# Traffic light detection zone on the gantry (left pole arm)
TRAFFIC_LIGHT_ROI = np.array([0.025, 0.220, 0.100, 0.320], dtype=np.float32)  # [x1, y1, x2, y2]
