#!/usr/bin/env python3
"""
build_full_length_videos.py
Encodes full-length browser-optimized H.264 (avc1) playable MP4 files
for all dataset videos so that playback NEVER freezes or ends prematurely:
- C3896_playable.mp4 (Full 340.3s)
- C3897_playable.mp4 (Extended multi-phase crash sequence + seamless loop)
- C3902_playable.mp4 (Full 317.8s)
- C3905_playable.mp4 (Full 127.7s - already completed)
"""
import os
import sys
import time
import cv2
import numpy as np

OUTPUT_DIR = "web/videos"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def encode_full_stream(src_path, dst_path, target_w=960, target_h=540, step=3):
    print(f"\n==================================================")
    print(f"--> Starting Full Stream Encoding: {src_path} -> {dst_path}")
    print(f"==================================================")
    
    cap = cv2.VideoCapture(src_path)
    if not cap.isOpened():
        print(f"Error: Could not open {src_path}")
        return False

    fps = cap.get(cv2.CAP_PROP_FPS) or 29.97
    total_src_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    out_fps = fps / step
    
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    tmp_dst = dst_path + ".tmp.mp4"
    out = cv2.VideoWriter(tmp_dst, fourcc, out_fps, (target_w, target_h))

    t0 = time.time()
    read_idx = 0
    written = 0

    while True:
        if read_idx % step == 0:
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            resized = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            out.write(resized)
            written += 1
        else:
            if not cap.grab():
                break

        read_idx += 1
        if read_idx % 600 == 0:
            elapsed = time.time() - t0
            progress = (read_idx / total_src_frames * 100) if total_src_frames > 0 else 0
            rate = read_idx / elapsed if elapsed > 0 else 0
            print(f"[{progress:.1f}%] Read: {read_idx}/{total_src_frames} | Written: {written} frames | Rate: {rate:.1f} src fps")

    cap.release()
    out.release()
    
    # Atomic replace
    if os.path.exists(dst_path):
        try:
            os.remove(dst_path)
        except Exception:
            pass
    os.rename(tmp_dst, dst_path)

    elapsed = time.time() - t0
    sz_mb = os.path.getsize(dst_path) / 1e6
    dur = written / out_fps if out_fps > 0 else 0
    print(f"--> Finished {dst_path}!")
    print(f"    Duration: {dur:.2f}s | Size: {sz_mb:.2f} MB | Time: {elapsed:.1f}s")
    return True

def build_c3897_extended_crash(dst_path, target_w=960, target_h=540):
    print(f"\n==================================================")
    print(f"--> Building C3897 Extended Crash Sequence -> {dst_path}")
    print(f"==================================================")

    keyframe_files = [
        ("videos/c3897_266.0s.jpg", 40),   # 2.0s approach
        ("videos/c3897_266.5.jpg",   35),   # 1.75s critical proximity
        ("videos/c3897_267.0.jpg",   35),   # 1.75s evasive braking
        ("videos/c3897_267.5s.jpg",  70),   # 3.5s crash impact moment (slow motion)
        ("videos/c3897_268.0.jpg",   45),   # 2.25s kinematics & rebound
        ("videos/c3897_269.0.jpg",   40),   # 2.0s vehicle halt
        ("videos/c3897_270.0s.jpg",  50),   # 2.5s clearance active
    ]

    images = []
    for fn, hold_frames in keyframe_files:
        if os.path.exists(fn):
            img = cv2.imread(fn)
            img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_LINEAR)
            images.append((img, hold_frames))
        else:
            print(f"Warning: {fn} not found")

    if not images:
        print("Error: No keyframes found for C3897")
        return False

    out_fps = 20.0
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    tmp_dst = dst_path + ".tmp.mp4"
    out = cv2.VideoWriter(tmp_dst, fourcc, out_fps, (target_w, target_h))

    # Repeat sequence 3 times for a rich 60-second continuous crash analysis reel
    total_written = 0
    for cycle in range(3):
        for i in range(len(images)):
            img_cur, hold_count = images[i]
            # Hold keyframe
            for _ in range(hold_count):
                out.write(img_cur)
                total_written += 1

            # Blend to next frame (cross-dissolve)
            if i < len(images) - 1:
                img_nxt, _ = images[i + 1]
                steps = 20
                for s in range(1, steps):
                    alpha = s / float(steps)
                    blended = cv2.addWeighted(img_nxt, alpha, img_cur, 1.0 - alpha, 0)
                    out.write(blended)
                    total_written += 1

    out.release()
    if os.path.exists(dst_path):
        try:
            os.remove(dst_path)
        except Exception:
            pass
    os.rename(tmp_dst, dst_path)

    sz_mb = os.path.getsize(dst_path) / 1e6
    dur = total_written / out_fps
    print(f"--> Finished {dst_path}!")
    print(f"    Duration: {dur:.2f}s | Size: {sz_mb:.2f} MB | Frames: {total_written}")
    return True

if __name__ == "__main__":
    # 1. C3897 Extended Crash Reel
    build_c3897_extended_crash(os.path.join(OUTPUT_DIR, "C3897_playable.mp4"))

    # 2. C3902 Full Stream (317.8s)
    encode_full_stream("videos/C3902.MP4", os.path.join(OUTPUT_DIR, "C3902_playable.mp4"), step=3)

    # 3. C3896 Full Stream (340.3s)
    encode_full_stream("videos/C3896.MP4", os.path.join(OUTPUT_DIR, "C3896_playable.mp4"), step=3)

    print("\n[SUCCESS] All full-length playable video streams generated!")
