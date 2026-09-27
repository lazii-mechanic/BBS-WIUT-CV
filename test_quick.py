import sys
import time
from pathlib import Path
import cv2
import numpy as np

# Add directory to sys.path
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

from solution import detect_events, RiskEstimator


def get_or_create_video() -> str:
    # 1. Check CLI argument
    if len(sys.argv) > 1 and Path(sys.argv[1]).is_file():
        return sys.argv[1]

    # 2. Check existing videos folder
    videos_dir = BASE_DIR / "videos"
    if videos_dir.exists():
        candidates = sorted(videos_dir.glob("*.mp4")) + sorted(videos_dir.glob("*.MP4"))
        if candidates:
            return str(candidates[0])

    # 3. Create a synthetic test video if none found
    videos_dir.mkdir(exist_ok=True)
    synth_path = videos_dir / "synthetic_smoke.mp4"
    if not synth_path.exists():
        print(f"[test_quick] No video found. Generating synthetic smoke test clip: {synth_path}")
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(synth_path), fourcc, 25.0, (640, 480))
        for frame_idx in range(75):  # 3 seconds @ 25 fps
            img = np.zeros((480, 640, 3), dtype=np.uint8)
            # Draw moving boxes to simulate moving road entities
            x = int(50 + frame_idx * 5)
            cv2.rectangle(img, (x, 200), (x + 80, 260), (0, 200, 255), -1)
            writer.write(img)
        writer.release()
    return str(synth_path)


def main():
    video_path = get_or_create_video()
    print(f"Testing pipeline on: {video_path}")

    # Test Part A
    print("\n--- Testing Part A (detect_events) ---")
    t0 = time.time()
    events = detect_events(video_path)
    elapsed_a = time.time() - t0

    print("=" * 60)
    print(f"Part A elapsed: {elapsed_a:.2f}s | Detected {len(events)} events:")
    for ev in events:
        print(f"  [{ev[0]:.2f}s - {ev[1]:.2f}s] {ev[2]}")
    print("=" * 60)

    # Test Part B (smoke test first 30 frames)
    print("\n--- Testing Part B (RiskEstimator) ---")
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    estimator = RiskEstimator()
    estimator.reset({"video_id": Path(video_path).name, "fps": fps, "width": w, "height": h, "n_frames": n_frames})

    sample_scores = []
    t_start = time.time()
    for idx in range(min(45, n_frames)):
        ret, frame = cap.read()
        if not ret:
            break
        t_sec = idx / fps
        score = estimator.step(frame, t_sec)
        sample_scores.append(score)
    cap.release()
    elapsed_b = time.time() - t_start

    print(f"Part B tested on {len(sample_scores)} frames in {elapsed_b:.2f}s")
    print(f"Risk score min: {min(sample_scores):.4f}, max: {max(sample_scores):.4f}, last: {sample_scores[-1]:.4f}")
    print("=" * 60)
    print("Smoke test PASSED!")


if __name__ == "__main__":
    main()
