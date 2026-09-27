# Agent 1: Computer Vision & Anticipation Algorithmist

## Supervised By
**Orchestrator Agent**

## Domain & Files Owned
- `solution.py` (mandatory interface for `run_submission.py`)
- `src/tracker.py` (YOLOv11 + ByteTrack + Kalman state + sliding window acceleration)
- `src/risk_estimator.py` (kinematic TTC, CPA trajectory extrapolation, emergency braking gate)
- `src/event_detector.py` (9 calibrated spatial-temporal anomaly event detectors)
- `src/postprocessor.py` (non-overlapping temporal interval merging)
- `src/scene_config.py` (polygonal crosswalks, stop lines, roadway geometries)

## Responsibilities & Constraints
1. **Strict Causality**: `RiskEstimator.step(frame, t_sec)` MUST NEVER use future information ($t > t_{sec}$).
2. **Speed Budget**: Combined Part A + Part B must remain under $3.0 \times \text{duration}$.
3. **Core Metric Targets**:
   - Recall on genuine accidents = $1.000$ (100%).
   - False alarms outside near-miss ignore zones $\to 0$.
   - Time-to-Accident (TTA) $\ge 1.0$s.
   - 9 Part A event classes detected with IoU $\ge 0.50$.
4. **Handoff Protocol**:
   Whenever CV code or thresholds are modified, notify the **Orchestrator** to trigger **Agent 3 (QA)** to run benchmarks and verify metrics.
