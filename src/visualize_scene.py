import cv2
import numpy as np
import sys
from pathlib import Path

# Add src to path
try:
    from src.scene_config import CROSSWALKS, STOP_LINES, ROADWAY, PEDESTRIAN_SAFE_ZONES, TRAFFIC_LIGHT_ROI
except ImportError:
    from scene_config import CROSSWALKS, STOP_LINES, ROADWAY, PEDESTRIAN_SAFE_ZONES, TRAFFIC_LIGHT_ROI

def main():
    img_path = Path("d:/CVHACK/wiut_cv_scripts/wiut_cv_scripts/videos/sample_frame.jpg")
    img = cv2.imread(str(img_path))
    if img is None:
        print("Cannot load sample_frame.jpg")
        return

    H, W = img.shape[:2]
    overlay = img.copy()

    # Draw Roadway
    pts_road = (ROADWAY * np.array([W, H])).astype(np.int32)
    cv2.polylines(overlay, [pts_road], True, (255, 200, 0), 3)

    # Draw Crosswalks in Green
    for name, poly in CROSSWALKS.items():
        pts = (poly * np.array([W, H])).astype(np.int32)
        cv2.fillPoly(overlay, [pts], (0, 200, 50))
        cv2.putText(overlay, name, (pts[0][0], pts[0][1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)

    # Draw Safe zones / Islands in Blue
    for idx, poly in enumerate(PEDESTRIAN_SAFE_ZONES):
        pts = (poly * np.array([W, H])).astype(np.int32)
        cv2.fillPoly(overlay, [pts], (200, 100, 0))

    # Blend overlay
    alpha = 0.35
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)

    # Draw Stop lines in Red
    for name, (p1, p2) in STOP_LINES.items():
        pt1 = (int(p1[0] * W), int(p1[1] * H))
        pt2 = (int(p2[0] * W), int(p2[1] * H))
        cv2.line(img, pt1, pt2, (0, 0, 255), 6)
        cv2.putText(img, name, (pt1[0], pt1[1] - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)

    out_path = Path("d:/CVHACK/wiut_cv_scripts/wiut_cv_scripts/videos/annotated_scene.jpg")
    cv2.imwrite(str(out_path), img)
    print("Saved annotated scene to:", out_path)

if __name__ == "__main__":
    main()
