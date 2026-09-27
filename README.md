# WIUT Hackathon 2026 — Computer Vision Track
## Traffic Event Detection & Causal Accident Anticipation

**Team BBS**:
- **Arifayev Bobur** — *Team Lead & Systems Architect* (Causal Bayesian Kinematic Anticipator, Pipeline Orchestration, Runtime Optimization)
- **Axmedov Shaxriyor** — *ML Engineer* (Spatial Perception, YOLO11 & ByteTrack Integration, Spatial Zones & Part A Rule Formulation)
- **Baxromjonov Behruz** — *UI/UX & Frontend Engineer* (Refined Architectural Design System, Telemetry HUD, Web Player & Canvas Overlays)

---

## 1. Repository Structure

This repository strictly implements the submission package layout specified in the official competition guidelines:

```text
.
├── solution.py                 # Core submission interface (CLASSES, detect_events, RiskEstimator)
├── run_submission.py           # Organizers' harness (unchanged from starter kit)
├── evaluate.py                 # Organizers' evaluation script (unchanged from starter kit)
├── requirements.txt            # Python dependencies
├── weights/                    # Model weights & download scripts
│   ├── download.sh             # Bash download script (fetches yolo11n.pt, <= 5 GB)
│   ├── download.bat            # Windows download script
│   └── yolo11n.pt              # Ultralytics YOLO11n weights (5.6 MB)
├── src/                        # Implementation modules
│   ├── __init__.py             # Library initialization
│   ├── tracker.py              # YOLO11 + ByteTrack multi-object road user tracker
│   ├── event_detector.py       # Spatial zone and kinematic anomaly event detector (Part A)
│   ├── risk_estimator.py       # Bayesian kinematic TTC causal risk estimator (Part B)
│   ├── postprocessor.py        # Temporal hysteresis segment merging & suppression
│   ├── scene_config.py         # Calibrated spatial zones, crosswalk polygons & stop lines
│   └── visualize_scene.py      # Spatial calibration visualization tool
├── notebooks/                  # Exploratory Data Analysis & experiments
│   └── eda_and_experiments.ipynb # Full EDA, distributions, and risk curves
├── scripts/                    # Development & verification utilities
│   ├── test_quick.py           # Quick verification smoke test
│   ├── test_part_b_all_videos.py # Part B validation runner
│   ├── build_hls_streams.py    # HLS multi-bitrate video stream builder
│   ├── build_all_playable_videos.py # Full video compatibility encoder
│   └── build_full_length_videos.py # Video assembler utility
├── web/                        # Public team website, live demo & report
│   ├── index.html              # 7-section single-page responsive dashboard
│   ├── styles.css              # Refined Swiss architectural design system
│   ├── app.js                  # Player, HLS streaming, and interactive telemetry
│   ├── data.js                 # Event timeline and metrics dataset
│   └── eda_data.js             # EDA parameters & dataset statistics
├── examples/                   # Official format reference fixtures
│   ├── ground_truth.json       # Example ground truth fixture
│   └── predictions.json        # Example predictions fixture
├── predictions_samples.json    # Verified predictions on sample videos (100% valid)
├── run_dashboard.py            # Local HTTP streaming server for the web interface
└── README.md                   # System documentation & reproduction guide
```

---

## 2. Quickstart & Installation

### Environment Setup
Requirements: **Python 3.10+**, 64-bit OS (Linux, macOS, or Windows), 1x NVIDIA GPU (optional, CPU inference supported).

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Fetch model weights (run once before evaluation)
bash weights/download.sh
# On Windows PowerShell / Command Prompt:
# weights\download.bat
```

### Docker (One-Command Deployment & Evaluation)
A production-ready `Dockerfile` and `entrypoint.sh` are provided at the root:

```bash
# 1. Build the container image
docker build -t team .

# 2. Launch the web dashboard & live demo (accessible at http://localhost:8080)
docker run -p 8080:8080 team

# 3. Run the official offline evaluation inside Docker (as described in the hackathon rules):
docker run --rm -v /data/test:/data/test team python run_submission.py --videos /data/test --out predictions.json
```

### Running the Official Harness
To run the solution over an unlabeled directory of `.mp4` test videos and produce `predictions.json`:

```bash
python run_submission.py --videos /data/test --out predictions.json --team BBS
```

### Validation & Scoring
```bash
# Validate prediction output format (must output: 0 error(s), 0 warning(s) -> VALID)
python evaluate.py --pred predictions_samples.json --validate-only

# Score against labeled ground truth (when ground_truth.json is available)
python evaluate.py --pred predictions.json --gt ground_truth.json --per-video
```

### Launching the Public Team Website & Live Demo
To inspect the interactive visualizations, EDA heatmaps, technical report, and live video demo:

```bash
python run_dashboard.py
# Open http://localhost:8080 in your browser
```

---

## 3. Methodology & System Architecture

### Part A — Traffic Event Detection (70% Weight)
Part A identifies contiguous temporal segments `[start_sec, end_sec, label]` for traffic anomalies across 9 active classes:

1. **Spatial Object Perception**: We deploy **YOLO11n** (pretrained on COCO, AGPL-3.0) to detect pedestrians (class 0) and vehicles (bicycles, cars, motorcycles, buses, trucks).
2. **Multi-Object Tracking**: Detections are associated across frames via **ByteTrack** with Kalman filtering, producing stable track IDs, instantaneous velocities, and moving/stationary states.
3. **Normalized Coordinate Modeling**: All geometric boundaries (crosswalk polygons, stop lines, queue corridors) are defined in normalized $[0, 1]$ coordinates, making detection robust to frame resizing.
4. **Domain-Specific Spatial Rules**:
   - `accident`: Dynamic vehicle collision detection based on sudden overlap + severe kinematic halt + persistent stationary cluster.
   - `near_miss`: Severe emergency braking ($a < -0.08$) and close proximity on an intercepting trajectory without physical contact.
   - `red_light`: Vehicles traversing past the stop-line vector during red signal intervals.
   - `wrong_way`: Trajectories moving against the calibrated lane flow vector ($v_y < -0.03$).
   - `stopped_vehicle`: Stationary carriageway occupancy outside signal queues exceeding 10 seconds.
   - `jaywalking`: Pedestrian presence on the active vehicular carriageway outside marked crosswalks.
   - `failure_to_yield`: Vehicles passing through crosswalk zones while active pedestrians occupy the crossing.
   - `stop_line`: Stationary vehicle positioned beyond the stop line on red without proceeding into the intersection.
   - `congestion`: Simultaneous queue deceleration across multiple lanes below the crawling threshold ($v < 0.015$).
5. **Temporal Hysteresis Post-Processing (`merge_raw_frames`)**:
   - Merges fragmented frame-level detections separated by gaps $< 1.5\text{ s}$.
   - Discards short transient blips under $0.6\text{ s}$.
   - Strictly enforces non-overlapping segments of the same class (required by `evaluate.py`).

### Part B — Causal Accident Anticipation (30% Weight)
Part B returns a causal risk score $P(\text{accident starts within } 5\text{ s}) \in [0, 1]$ for every frame in real time:

- **Strict Causality**: `RiskEstimator.step()` operates frame-by-frame using only past frames; it never opens the video file or accesses future context.
- **Kinematic Closure & Time-to-Collision (TTC)**: For every pair of moving vehicles with relative position $\mathbf{r} = \mathbf{c}_2 - \mathbf{c}_1$ and relative velocity $\mathbf{v}_{\text{rel}} = \mathbf{v}_1 - \mathbf{v}_2$:
  $$\text{Closing Rate} = -\frac{d(\text{dist})}{dt} = \frac{\mathbf{r} \cdot \mathbf{v}_{\text{rel}}}{\|\mathbf{r}\|}$$
  $$\text{Time to Closest Point of Approach: } t_{\text{CPA}} = \frac{\mathbf{r} \cdot \mathbf{v}_{\text{rel}}}{\|\mathbf{v}_{\text{rel}}\|^2}$$
- **Emergency Deceleration Gate**: The risk score is raised only when emergency deceleration ($a < -0.08$) occurs on an imminent collision course ($0.1 < t_{\text{CPA}} \le 1.6\text{ s}$).
- **Two-Stage Alarm Filtering**:
  - Requires hazard confirmation across $\ge 2$ consecutive processed frames to suppress edge-of-frame tracking noise.
  - Scores decay smoothly ($\alpha = 0.70$) with a clean noise floor at $0.15$ to prevent false alarm penalties under the chance-normalized AP metric.

---

## 4. What is Learned vs. What is Rule-Based

| Component | Nature | Model / Method | Training Data & License |
| :--- | :--- | :--- | :--- |
| **Object Detection** | **Learned** | YOLO11n (`weights/yolo11n.pt`) | COCO 2017 Dataset (AGPL-3.0) |
| **Multi-Object Association** | **Learned / Algorithmic** | ByteTrack (Kalman Filter + Hungarian Matching) | Algorithmic (MIT License) |
| **Accident Anticipation (Part B)** | **Kinematic / Bayesian** | Relative closure rate + CPA extrapolation + emergency deceleration | Causal kinematic formulation (Zero dataset overfitting) |
| **Event Classification (Part A)** | **Rule-Based** | Spatial polygon intersection + directional vector geometry | Formulated from CCTV scene topology |
| **Temporal Segment Smoothing** | **Rule-Based** | Hysteresis merging, gap bridging, non-overlap enforcement | Deterministic post-processing |

---

## 5. Determinism & Reproducibility

- **Fixed Random Seeds**: Constant random state initialized across all modules:
  ```python
  import random, numpy as np, torch
  random.seed(42)
  np.random.seed(42)
  torch.manual_seed(42)
  if torch.cuda.is_available():
      torch.cuda.manual_seed_all(42)
  ```
- **Deterministic Association**: ByteTrack matching is purely deterministic based on bounding box IoU and cost matrix reduction.
- **Zero Inter-Video Leakage**: `RiskEstimator.reset(meta)` instantiates a completely fresh tracker state on every video boundary, ensuring test runs are 100% reproducible.

---

## 6. Runtime Budget & Engineering Judgement

The competition rules allocate **at most 3x the video duration in wall-clock time** for Part A + Part B combined.

- **Adaptive Stride (3)**: The video is sampled at ~10 FPS (every 3rd frame). Non-sampled frames are skipped using `cv2.VideoCapture.grab()`, bypassing costly 4K frame decompression.
- **Input Downscaling**: Frames are resized to 1080p for Part A and 720p for Part B. Because all coordinate representations use normalized $[0, 1]$ bounding box centers, zero precision is lost while gaining a **12x throughput speedup**.
- **Measured Throughput**:
  - Sample video duration: **1,103.3 seconds** total across 4 clips.
  - Full pipeline runtime (Part A + Part B): **~190 seconds** on a single GPU.
  - **Speedup Factor: 5.8x real-time** (well inside the 3.0x time budget limit).

---

## 7. Validation Results on Sample Videos

Validation executed via `python evaluate.py --pred predictions_samples.json --validate-only`:
```text
format: 4 video(s), 289 event(s), 0 error(s), 0 warning(s) -> VALID
```

- **Video C3896.MP4 (340.3s)**: 67 events (`jaywalking`, `near_miss`, `failure_to_yield`, `stopped_vehicle`).
- **Video C3897.MP4 (317.5s)**: 59 events including **1 severe collision at $t = 266.8\text{ s}$**.
  - Part B triggered anticipation alarm at $t = 265.7\text{ s}$ (**1.10s lead time** before impact).
  - Peak risk score: **0.96**.
  - False alarm runs: **0**.
- **Video C3902.MP4 (317.8s)**: 98 events (`congestion`, `failure_to_yield`, `jaywalking`, `stop_line`).
- **Video C3903.MP4 (127.6s)**: 65 events (`stopped_vehicle`, `red_light`, `wrong_way`).

---

## 8. Team Members & Contributions

- **Arifayev Bobur** (*Lead*): Formulated the Bayesian kinematic closing-rate collision model (Part B), overall pipeline orchestration, and end-to-end performance optimization.
- **Axmedov Shaxriyor** (*ML Engineer*): Engineered YOLO11 spatial perception, ByteTrack association, camera crosswalk polygons, stop lines, and Part A event detection rules.
- **Baxromjonov Behruz** (*UI/UX & Frontend*): Designed the architectural Swiss design system, telemetry HUD overlays, live CV canvas visualizer, responsive layout hierarchy, and user interaction flows.
