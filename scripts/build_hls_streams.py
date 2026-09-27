#!/usr/bin/env python3
"""
build_hls_streams.py
Generates HLS (HTTP Live Streaming) VOD streams (.m3u8 + .ts segments)
for all 4 dataset videos:
- web/videos/hls/C3896/stream.m3u8
- web/videos/hls/C3897/stream.m3u8
- web/videos/hls/C3902/stream.m3u8
- web/videos/hls/C3905/stream.m3u8
"""
import os
import cv2

def convert_to_hls(input_video_path, output_dir, segment_duration=2.5):
    print(f"--> Building HLS stream from {input_video_path} into {output_dir}...")
    os.makedirs(output_dir, exist_ok=True)
    
    cap = cv2.VideoCapture(input_video_path)
    if not cap.isOpened():
        print(f"Error: Could not open {input_video_path}")
        return False

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    frames_per_seg = max(10, int(fps * segment_duration))
    fourcc = cv2.VideoWriter_fourcc(*'H264')

    seg_idx = 0
    frame_in_seg = 0
    out = None
    playlist_entries = []

    for fi in range(total_frames):
        ret, frame = cap.read()
        if not ret or frame is None:
            break

        if frame_in_seg == 0:
            if out is not None:
                out.release()
            seg_name = f"segment_{seg_idx:03d}.ts"
            seg_path = os.path.join(output_dir, seg_name)
            out = cv2.VideoWriter(seg_path, fourcc, fps, (w, h))
            seg_idx += 1

        out.write(frame)
        frame_in_seg += 1

        if frame_in_seg >= frames_per_seg:
            duration_actual = frame_in_seg / fps
            playlist_entries.append((seg_name, duration_actual))
            frame_in_seg = 0

    if out is not None:
        out.release()
        if frame_in_seg > 0:
            duration_actual = frame_in_seg / fps
            playlist_entries.append((seg_name, duration_actual))

    cap.release()

    if not playlist_entries:
        print(f"Error: No segments produced for {input_video_path}")
        return False

    # Write M3U8 Playlist
    m3u8_path = os.path.join(output_dir, "stream.m3u8")
    max_d = max(d for _, d in playlist_entries)
    with open(m3u8_path, "w", encoding="utf-8") as f:
        f.write("#EXTM3U\n")
        f.write("#EXT-X-VERSION:3\n")
        f.write(f"#EXT-X-TARGETDURATION:{int(max_d + 1)}\n")
        f.write("#EXT-X-MEDIA-SEQUENCE:0\n")
        f.write("#EXT-X-PLAYLIST-TYPE:VOD\n")
        for sname, dur in playlist_entries:
            f.write(f"#EXTINF:{dur:.3f},\n")
            f.write(f"{sname}\n")
        f.write("#EXT-X-ENDLIST\n")

    print(f"Done: {m3u8_path} ({len(playlist_entries)} segments)")
    return True

if __name__ == "__main__":
    videos = [
        ("web/videos/C3896_playable.mp4", "web/videos/hls/C3896"),
        ("web/videos/C3897_playable.mp4", "web/videos/hls/C3897"),
        ("web/videos/C3902_playable.mp4", "web/videos/hls/C3902"),
        ("web/videos/C3905_playable.mp4", "web/videos/hls/C3905"),
    ]

    for src, dst in videos:
        convert_to_hls(src, dst, segment_duration=2.5)

    print("All HLS streams ready!")
