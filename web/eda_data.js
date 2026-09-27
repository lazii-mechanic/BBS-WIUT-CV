window.EDA_DATA = {
  "summary": {
    "total_videos": 4,
    "total_duration_sec": 1103.3,
    "total_frames_raw": 33075,
    "total_events_detected": 289,
    "classes_monitored": 9,
    "avg_fps": 29.97,
    "native_resolution": "3840x2160 (4K UHD)",
    "color_space": "BT.709 / YUV420p"
  },
  "videos": {
    "C3896.MP4": {
      "res": "3840x2160",
      "fps": 29.97,
      "duration": 340.33,
      "frames": 10200,
      "lighting": "Direct morning sunlight, sharp 45\u00b0 roadside tree shadows, high asphalt specular glare",
      "scene_type": "Urban 4-way intersection (East Approach) with dual marked crosswalks",
      "traffic_density": "High (42.5 vehicles/min)",
      "flow_direction": "East-West bidirectional with protected left-turn corridor",
      "class_distribution": {
        "car": 412,
        "pedestrian": 98,
        "truck": 28,
        "bus": 19,
        "motorcycle": 14
      },
      "dominant_events": [
        "jaywalking (23)",
        "near_miss (20)",
        "failure_to_yield (16)",
        "stopped_vehicle (8)"
      ]
    },
    "C3897.MP4": {
      "res": "3840x2160",
      "fps": 29.97,
      "duration": 317.5,
      "frames": 9525,
      "lighting": "Overcast diffused daylight, minimal ground shadows, uniform contrast",
      "scene_type": "Wide intersection with high-speed perpendicular cross-traffic",
      "traffic_density": "Moderate-to-High (38.1 vehicles/min)",
      "flow_direction": "North-South arterial with crossing Eastbound flow",
      "class_distribution": {
        "car": 384,
        "pedestrian": 76,
        "truck": 31,
        "bus": 14,
        "motorcycle": 9
      },
      "dominant_events": [
        "failure_to_yield (29)",
        "near_miss (15)",
        "jaywalking (14)",
        "accident (1 @ 266.8s)"
      ]
    },
    "C3902.MP4": {
      "res": "3840x2160",
      "fps": 29.97,
      "duration": 317.82,
      "frames": 9525,
      "lighting": "Afternoon sun with stop-line shadow occlusion, moderate atmospheric haze",
      "scene_type": "Commercial corridor with dense pedestrian activity and dual bus stops",
      "traffic_density": "Very High (51.2 vehicles/min)",
      "flow_direction": "Westbound arterial with frequent curb drop-offs",
      "class_distribution": {
        "car": 489,
        "pedestrian": 142,
        "truck": 35,
        "bus": 32,
        "motorcycle": 21
      },
      "dominant_events": [
        "failure_to_yield (32)",
        "near_miss (24)",
        "jaywalking (19)",
        "congestion (8)"
      ]
    },
    "C3905.MP4": {
      "res": "3840x2160",
      "fps": 29.97,
      "duration": 127.63,
      "frames": 3825,
      "lighting": "Clear midday sky, high optical contrast, minimal road surface texture distortion",
      "scene_type": "Multi-lane divided expressway with grade separation ramp",
      "traffic_density": "High speed / Moderate density (64.0 vehicles/min)",
      "flow_direction": "Unidirectional Northbound multi-lane laminar flow",
      "class_distribution": {
        "car": 295,
        "pedestrian": 11,
        "truck": 44,
        "bus": 16,
        "motorcycle": 8
      },
      "dominant_events": [
        "near_miss (13)",
        "failure_to_yield (12)",
        "jaywalking (7)",
        "congestion (3)"
      ]
    }
  },
  "trajectories": [
    {
      "id": "Lane 1 Through",
      "color": "#3b82f6",
      "points": [
        [
          0.15,
          0.62
        ],
        [
          0.35,
          0.6
        ],
        [
          0.6,
          0.58
        ],
        [
          0.85,
          0.56
        ]
      ]
    },
    {
      "id": "Lane 2 Through",
      "color": "#2563eb",
      "points": [
        [
          0.18,
          0.69
        ],
        [
          0.38,
          0.66
        ],
        [
          0.63,
          0.63
        ],
        [
          0.88,
          0.6
        ]
      ]
    },
    {
      "id": "Lane 3 Curb Turn",
      "color": "#1d4ed8",
      "points": [
        [
          0.22,
          0.77
        ],
        [
          0.45,
          0.73
        ],
        [
          0.65,
          0.7
        ],
        [
          0.82,
          0.85
        ]
      ]
    },
    {
      "id": "Cross Street Flow",
      "color": "#e02424",
      "points": [
        [
          0.68,
          0.25
        ],
        [
          0.66,
          0.45
        ],
        [
          0.64,
          0.65
        ],
        [
          0.62,
          0.88
        ]
      ]
    },
    {
      "id": "CW-01 Ped Corridor",
      "color": "#8b5cf6",
      "points": [
        [
          0.17,
          0.55
        ],
        [
          0.35,
          0.51
        ],
        [
          0.57,
          0.48
        ]
      ]
    },
    {
      "id": "CW-02 Ped Corridor",
      "color": "#8b5cf6",
      "points": [
        [
          0.62,
          0.45
        ],
        [
          0.78,
          0.46
        ],
        [
          0.96,
          0.47
        ]
      ]
    }
  ],
  "class_aggregates": [
    {
      "name": "Passenger Cars",
      "count": 1580,
      "pct": 67.2,
      "color": "#111113"
    },
    {
      "name": "Pedestrians",
      "count": 327,
      "pct": 13.9,
      "color": "#4f46e5"
    },
    {
      "name": "Trucks / Heavy",
      "count": 138,
      "pct": 5.9,
      "color": "#d97706"
    },
    {
      "name": "Transit Buses",
      "count": 81,
      "pct": 3.4,
      "color": "#059669"
    },
    {
      "name": "Motorcycles / Bikes",
      "count": 52,
      "pct": 2.2,
      "color": "#dc2626"
    },
    {
      "name": "Other / Stationary",
      "count": 174,
      "pct": 7.4,
      "color": "#6b7280"
    }
  ]
};
