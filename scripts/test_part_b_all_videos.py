"""
test_part_b_all_videos.py — Complete test of Part B across all 4 videos.
Runs RiskEstimator on C3896, C3897, C3902, C3905, evaluates time budgets,
counts alarms, validates format with evaluate.py, and computes official Part B metric.
"""
import json
import time
from pathlib import Path
import cv2
import numpy as np

from solution import RiskEstimator
from evaluate import validate, alarm_starts, evaluate_part_b


def run_video_part_b(video_path: Path, estimator: RiskEstimator):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 29.97
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = n_frames / fps if fps else 0.0
    budget = 3.0 * duration

    meta = {
        "video_id": video_path.name,
        "fps": float(fps),
        "width": width,
        "height": height,
        "n_frames": n_frames,
        "duration": duration,
    }

    print(f"\n{'='*70}")
    print(f"Processing {video_path.name}: {duration:.1f}s ({duration/60:.1f}m), {fps:.2f} fps, {n_frames} frames")
    print(f"Time budget: {budget:.1f}s")

    t0 = time.perf_counter()
    estimator.reset(meta)

    curve = []
    idx = 0
    last_score = 0.0

    while True:
        t_sec = idx / fps
        if idx % 5 == 0:
            ok, frame = cap.read()
            if not ok:
                break
            score = estimator.step(frame, t_sec)
            last_score = min(1.0, max(0.0, float(score)))
        else:
            ok = cap.grab()
            if not ok:
                break
            score = estimator.step(None, t_sec)
            last_score = min(1.0, max(0.0, float(score)))

        curve.append([round(t_sec, 4), round(last_score, 4)])
        idx += 1

        if idx % 1500 == 0:
            elapsed = time.perf_counter() - t0
            speed = idx / elapsed
            print(f"  Frame {idx}/{n_frames} ({idx/n_frames*100:.1f}%) | {elapsed:.1f}s elapsed ({speed:.1f} fps) | Current risk: {last_score:.3f}")

    cap.release()
    elapsed_total = time.perf_counter() - t0
    alarms = alarm_starts(curve, theta=0.5)

    print(f"Completed {video_path.name}:")
    print(f"  Time taken: {elapsed_total:.2f}s (Budget: {budget:.1f}s) — {'OK WITHIN BUDGET' if elapsed_total <= budget else 'OVER BUDGET!'}")
    print(f"  Risk samples: {len(curve)}")
    print(f"  Alarms (>= 0.5): {len(alarms)} at {[round(a, 2) for a in alarms]}")

    return curve, elapsed_total, alarms


def main():
    videos_dir = Path("videos")
    # Deduplicate video files (Windows case insensitivity)
    unique_names = {}
    for p in sorted(videos_dir.glob("*.MP4")) + sorted(videos_dir.glob("*.mp4")):
        if p.name.upper().startswith("C") and "smoke" not in p.name.lower() and "synthetic" not in p.name.lower():
            unique_names[p.name.upper()] = p
    video_files = sorted(unique_names.values(), key=lambda x: x.name)

    print(f"Found {len(video_files)} target videos: {[v.name for v in video_files]}")

    # Load existing predictions to preserve Part A events
    pred_path = Path("predictions.json")
    if pred_path.exists():
        with open(pred_path, "r", encoding="utf-8") as f:
            predictions = json.load(f)
    else:
        predictions = {"team": "bbs", "videos": {}}

    estimator = RiskEstimator()
    summary = {}

    for vpath in video_files:
        vid_name = vpath.name
        curve, elapsed, alarms = run_video_part_b(vpath, estimator)

        if vid_name not in predictions["videos"]:
            predictions["videos"][vid_name] = {"events": [], "risk": []}

        predictions["videos"][vid_name]["risk"] = curve
        summary[vid_name] = {
            "elapsed_sec": round(elapsed, 2),
            "samples": len(curve),
            "alarms": [round(a, 2) for a in alarms]
        }

    # Save updated predictions.json
    print(f"\n{'='*70}")
    print("Writing updated predictions.json...")
    with open("predictions.json", "w", encoding="utf-8") as f:
        json.dump(predictions, f, indent=1)
    print("Saved predictions.json successfully.")

    # Validate predictions format
    print("\n--- Running evaluate.py validate-only check ---")
    errors, warnings = validate(predictions)
    print(f"Errors: {len(errors)}, Warnings: {len(warnings)}")
    for e in errors:
        print("  Error:", e)
    for w in warnings:
        print("  Warning:", w)

    if not errors:
        print("Predictions format is 100% VALID!")

    # Evaluate Part B on C3897 accident
    print("\n--- Evaluating Part B Metric with C3897 accident (Strict GT, no near-miss ignore) ---")
    gt_strict = {
        "C3897.MP4": {
            "duration": 317.8,
            "fps": 29.97,
            "events": [[266.87, 268.97, "accident"]]
        }
    }
    for v in video_files:
        if v.name != "C3897.MP4":
            gt_strict[v.name] = {"duration": len(predictions["videos"][v.name]["risk"])/29.97, "fps": 29.97, "events": []}

    res_b_strict = evaluate_part_b(gt_strict, predictions["videos"])
    if res_b_strict:
        print(f"Score B (Strict): {res_b_strict['score_b']:.4f}")
        print(f"  AP: {res_b_strict['ap']:.4f} (raw: {res_b_strict['ap_raw']:.4f})")
        print(f"  Alarm F1: {res_b_strict['f1_alarm']:.4f} (P: {res_b_strict['alarm_precision']:.4f}, R: {res_b_strict['alarm_recall']:.4f})")
        print(f"  mTTA: {res_b_strict.get('mtta_sec', 0.0):.2f}s")
        print(f"  Per video: {res_b_strict['per_video']}")

    # Official GT with near-miss ignore zones as defined in evaluate.py
    print("\n--- Evaluating Part B Metric with Official GT (near_miss ignore zones per evaluate.py) ---")
    samples_data = json.load(open("predictions_samples.json", "r", encoding="utf-8"))
    gt_official = {}
    for v in video_files:
        evs = samples_data["videos"].get(v.name, {}).get("events", [])
        filtered_evs = [ev for ev in evs if ev[2] == "near_miss" and not (255 <= ev[0] <= 267)]
        if v.name == "C3897.MP4":
            filtered_evs.append([266.87, 268.97, "accident"])
        gt_official[v.name] = {
            "duration": len(predictions["videos"][v.name]["risk"])/29.97,
            "fps": 29.97,
            "events": filtered_evs
        }

    res_b_off = evaluate_part_b(gt_official, predictions["videos"])
    if res_b_off:
        print(f"Score B (Official): {res_b_off['score_b']:.4f}")
        print(f"  AP: {res_b_off['ap']:.4f} (raw: {res_b_off['ap_raw']:.4f})")
        print(f"  Alarm F1: {res_b_off['f1_alarm']:.4f} (P: {res_b_off['alarm_precision']:.4f}, R: {res_b_off['alarm_recall']:.4f})")
        print(f"  mTTA: {res_b_off.get('mtta_sec', 0.0):.2f}s")
        print(f"  Per video: {res_b_off['per_video']}")

    print("\n" + "="*70)
    print("ALL 4 VIDEOS TEST COMPLETE SUMMARY:")
    for k, v in summary.items():
        print(f"  {k}: {v['samples']} risk samples in {v['elapsed_sec']}s | Alarms: {v['alarms']}")
    print("="*70)


if __name__ == "__main__":
    main()
