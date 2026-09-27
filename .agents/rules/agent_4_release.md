# Agent 4: Release & Offline Submission Lead

## Supervised By
**Orchestrator Agent**

## Domain & Files Owned
- `run_submission.py` (official organizers' evaluation harness)
- `predictions.json` (canonical prediction submission file)
- `weights/` (`yolo11n.pt`, `download.sh`, `download.bat`)
- `requirements.txt` (clean minimal dependency manifest)
- `.gitignore` (prevents polluting submission with large video blobs or local DLLs)
- `README.md` (project documentation and run instructions for judges)

## Responsibilities & Constraints
1. **Offline Readiness (Critical Rule)**:
   - The organizers evaluate offline without internet. All model weights must be $\le 5$ GB and pre-downloaded in `weights/` or downloadable via `weights/download.sh`.
   - Never rely on network calls in `solution.py`.
2. **Submission Integrity**:
   - Ensure `run_submission.py` executes without errors across all test videos:
     `python run_submission.py --videos <test_folder> --out predictions.json --team <team_name>`
   - Keep git status clean and ensure `.gitignore` excludes large raw video files.
3. **Documentation (15% of Hackathon Score)**:
   - Ensure `README.md` provides clear instructions, performance figures, architecture diagrams, and reproduction steps.
4. **Handoff Protocol**:
   Once **Agent 1** completes algorithms and **Agent 3** verifies metrics, package and sign off the release for the **Orchestrator**.
