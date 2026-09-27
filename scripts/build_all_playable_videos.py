#!/usr/bin/env python3
"""
build_all_playable_videos.py
Generates browser-compatible H.264 (avc1) playable MP4 videos for all 4 dataset videos:
- C3896_playable.mp4 (from videos/C3896.MP4)
- C3897_playable.mp4 (from collision sequence c3897_266.0s.jpg ... c3897_270.0s.jpg with smooth interpolation)
- C3902_playable.mp4 (from videos/C3902.MP4)
- C3905_playable.mp4 (from videos/C3905.MP4)
"""
import os
import cv2
import numpy as np

OUTPUT_DIR = "web/videos"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def encode_from_source(src_path, dst_path, target_w=960, target_h=540, max_frames=400, step=2):
    print(f"--> Encoding {src_path} -> {dst_path}...")
    cap = cv2.VideoCapture(src_path)
    if not cap.isOpened():
        print(f"Error: Could not open {src_path}")
        return False

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    out_fps = max(10.0, fps / step)
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(dst_path, fourcc, out_fps, (target_w, target_h))
    
    count = 0
    read_idx = 0
    while count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if read_idx % step == 0:
            resized = cv2.resize(frame, (target_w, target_h), interpolation=cv2.INTER_AREA)
            out.write(resized)
            count += 1
        read_idx += 1

    out.release()
    cap.release()
    sz_mb = os.path.getsize(dst_path) / 1e6
    print(f"Done: {dst_path} ({count} frames @ {out_fps:.1f} fps, {sz_mb:.2f} MB)")
    return True

def build_c3897_crash_video(dst_path, target_w=960, target_h=540):
    print(f"--> Building C3897 crash sequence -> {dst_path}...")
    keyframe_files = [
        ("videos/c3897_266.0s.jpg", "t=266.0s | Approaching Intersection"),
        ("videos/c3897_266.5.jpg",   "t=266.5s | Critical Proximity - Yield Violation"),
        ("videos/c3897_267.0.jpg",   "t=267.0s | Imminent Impact - Severe Deceleration"),
        ("videos/c3897_267.5s.jpg",  "t=267.5s | PART B CRASH EVENT (Ground Truth t=265.77s)"),
        ("videos/c3897_268.0.jpg",   "t=268.0s | Post-Impact Kinematics"),
        ("videos/c3897_269.0.jpg",   "t=269.0s | Vehicles Come to Rest"),
        ("videos/c3897_270.0s.jpg",  "t=270.0s | Incident Clearance Active"),
    ]

    images = []
    for fn, label in keyframe_files:
        if os.path.exists(fn):
            img = cv2.imread(fn)
            img = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)
            images.append((img, label))
        else:
            print(f"Warning: {fn} not found")

    if not images:
        print("Error: No keyframes for C3897")
        return False

    out_fps = 20.0
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(dst_path, fourcc, out_fps, (target_w, target_h))

    # Hold first frame for 1.5 seconds (30 frames)
    first_img, _ = images[0]
    for _ in range(30):
        out.write(first_img)

    # Transition smoothly between each pair of keyframes (25 blended frames)
    for i in range(len(images) - 1):
        img_a, label_a = images[i]
        img_b, label_b = images[i+1]
        
        # Hold keyframe for 15 frames
        for _ in range(15):
            out.write(img_a)

        # Smooth cross-fade over 20 frames
        steps = 20
        for s in range(1, steps):
            alpha = s / float(steps)
            blended = cv2.addWeighted(img_b, alpha, img_a, 1.0 - alpha, 0)
            out.write(blended)

    # Hold last frame for 2 seconds (40 frames)
    last_img, _ = images[-1]
    for _ in range(40):
        out.write(last_img)

    out.release()
    sz_mb = os.path.getsize(dst_path) / 1e6
    print(f"Done: {dst_path} ({sz_mb:.2f} MB)")
    return True

if __name__ == "__main__":
    # 1. C3896
    encode_from_source("videos/C3896.MP4", os.path.join(OUTPUT_DIR, "C3896_playable.mp4"), max_frames=300, step=3)

    # 2. C3897
    build_c3897_crash_video(os.path.join(OUTPUT_DIR, "C3897_playable.mp4"))

    # 3. C3902
    encode_from_source("videos/C3902.MP4", os.path.join(OUTPUT_DIR, "C3902_playable.mp4"), max_frames=300, step=3)

    # 4. C3905
    encode_from_source("videos/C3905.MP4", os.path.join(OUTPUT_DIR, "C3905_playable.mp4"), max_frames=300, step=2)

    print("All playable videos ready!")
