import time
import sys
from pathlib import Path

# Add directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from solution import detect_events

video_path = str(Path(__file__).parent / "videos" / "C3896.MP4")
print(f"Testing detect_events on {video_path}...")
t0 = time.time()
events = detect_events(video_path)
elapsed = time.time() - t0

print("=" * 60)
print(f"Total time elapsed: {elapsed:.2f} seconds ({elapsed/60:.2f} minutes)")
print(f"Detected {len(events)} events:")
for ev in events:
    print(f"  [{ev[0]:.2f}s - {ev[1]:.2f}s] {ev[2]}")
print("=" * 60)
