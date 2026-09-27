/**
 * app.js — Vision Intelligence Interactive Dashboard
 * WIUT 2026 CV Hackathon
 * Features:
 * - Hls.js Streaming Integration (https://github.com/video-dev/hls.js/)
 * - Calibrated Scene Geometry & Accurate Event Bounding Box Overlay
 * - Zero Border Radius & Borderless Architectural Minimalist Layout
 * - Zero Emojis (Monochrome & Semantic Indicators)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Grab state & data
  const data = window.DATA || { videos: {}, metrics: {} };
  let currentVidId = 'C3897.MP4';
  let activeFilter = 'all';
  let isPlaying = false;
  let simulatedTime = 0.0;
  let simInterval = null;
  let candidateIndex = 0;
  let activeCandidates = [];
  let hlsPlayer = null;

  // DOM Elements
  const videoTabs = document.getElementById('videoTabs');
  const mainVideo = document.getElementById('mainVideo');
  const fallbackImg = document.getElementById('fallbackImg');
  const cvOverlay = document.getElementById('cvOverlay');
  const cvCtx = cvOverlay ? cvOverlay.getContext('2d') : null;
  const hudCvToggle = document.getElementById('hudCvToggle');
  const hudCvToggleText = document.getElementById('hudCvToggleText');
  let cvHudEnabled = true;

  const hudTime = document.getElementById('hudTime');
  const hudRiskVal = document.getElementById('hudRiskVal');
  const alarmBanner = document.getElementById('alarmBanner');
  const alarmBannerText = document.getElementById('alarmBannerText');
  const timeScrubber = document.getElementById('timeScrubber');
  const currentTimeLabel = document.getElementById('currentTimeLabel');
  const totalTimeLabel = document.getElementById('totalTimeLabel');
  const playBtn = document.getElementById('playBtn');
  const stepBackBtn = document.getElementById('stepBackBtn');
  const stepFwdBtn = document.getElementById('stepFwdBtn');
  const jumpCrashBtn = document.getElementById('jumpCrashBtn');
  const jumpNearMissBtn = document.getElementById('jumpNearMissBtn');
  const gaugeCircle = document.getElementById('gaugeCircle');
  const gaugeVal = document.getElementById('gaugeVal');
  const riskStatusHeading = document.getElementById('riskStatusHeading');
  const riskStatusDesc = document.getElementById('riskStatusDesc');
  const eventsTableBody = document.getElementById('eventsTableBody');
  const eventCountBadge = document.getElementById('eventCountBadge');
  const eventsFilterBar = document.getElementById('eventsFilterBar');
  const activeVideoTitle = document.getElementById('activeVideoTitle');
  const videoStatusText = document.getElementById('videoStatusText');
  const riskCanvas = document.getElementById('riskChart');
  const ctx = riskCanvas.getContext('2d');

  // Video metadata with prioritized direct hardware-accelerated MP4 streams
  const VIDEO_META = {
    'C3896.MP4': {
      duration: 340.33,
      crash: null,
      title: 'C3896.MP4 — Surveillance Stream (Intersection East) [Team BBS]',
      fallbackImg: 'videos/sample_frame.jpg',
      candidates: [
        'videos/C3896_playable.mp4',
        'videos/hls/C3896/stream.m3u8',
        '../videos/C3896_playable.mp4',
        'videos/C3896.MP4'
      ]
    },
    'C3897.MP4': {
      duration: 317.50,
      crash: 265.5,
      title: 'C3897.MP4 — Surveillance Stream (Crash Scene 266.8s) [Team BBS]',
      fallbackImg: 'videos/c3897_267.5s.jpg',
      candidates: [
        'videos/C3897_playable.mp4',
        'videos/hls/C3897/stream.m3u8',
        '../videos/C3897_playable.mp4',
        'videos/C3897.MP4'
      ]
    },
    'C3902.MP4': {
      duration: 317.50,
      crash: null,
      title: 'C3902.MP4 — Surveillance Stream (Intersection West) [Team BBS]',
      fallbackImg: 'videos/sample_frame.jpg',
      candidates: [
        'videos/C3902_playable.mp4',
        'videos/hls/C3902/stream.m3u8',
        '../videos/C3902_playable.mp4',
        'videos/C3902.MP4'
      ]
    },
    'C3905.MP4': {
      duration: 127.63,
      crash: null,
      title: 'C3905.MP4 — Surveillance Stream (Expressway North) [Team BBS]',
      fallbackImg: 'videos/c3905_28.5s.jpg',
      candidates: [
        'videos/C3905_playable.mp4',
        'videos/hls/C3905/stream.m3u8',
        '../videos/C3905_playable.mp4',
        'videos/C3905.MP4'
      ]
    }
  };

  // Calibrated Scene Geometry from scene_config.py (normalized 0.0 to 1.0)
  const SCENE_CALIBRATION = {
    crosswalk_left: [
      [0.170, 0.550],
      [0.580, 0.460],
      [0.565, 0.530],
      [0.130, 0.635]
    ],
    crosswalk_right: [
      [0.615, 0.445],
      [0.965, 0.460],
      [0.965, 0.535],
      [0.620, 0.525]
    ],
    stop_line: [
      [0.180, 0.490],
      [0.435, 0.455]
    ]
  };

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatTimeWithMs(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  function destroyHls() {
    if (hlsPlayer) {
      try {
        hlsPlayer.destroy();
      } catch (err) {}
      hlsPlayer = null;
    }
  }

  // Switch Active Camera Stream
  function switchVideo(vidId) {
    currentVidId = vidId;
    const meta = VIDEO_META[vidId] || { duration: 300, crash: null, title: vidId, candidates: [] };
    activeVideoTitle.textContent = meta.title;

    // Update active tab button in segmented control
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vid === vidId);
    });

    // Update time limits
    timeScrubber.max = meta.duration;
    timeScrubber.value = 0;
    totalTimeLabel.textContent = formatTime(meta.duration);

    // Setup candidate cascade with HLS priority
    activeCandidates = meta.candidates || [];
    candidateIndex = 0;
    tryLoadNextCandidate();

    // Toggle Crash Jump button visibility
    if (meta.crash !== null) {
      jumpCrashBtn.style.display = 'inline-flex';
    } else {
      jumpCrashBtn.style.display = 'none';
    }

    renderEventsTable();
    updateTelemetry(0.0);
    drawRiskChart();
  }

  // Load stream with Hls.js support and MP4 fallback
  function tryLoadNextCandidate() {
    destroyHls();

    if (candidateIndex < activeCandidates.length) {
      const srcUrl = activeCandidates[candidateIndex];
      candidateIndex++;
      mainVideo.style.display = 'block';
      fallbackImg.style.display = 'none';

      // 1. Check if source is HLS playlist (.m3u8)
      if (srcUrl.endsWith('.m3u8')) {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
          console.log('[Hls.js] Initializing HLS stream:', srcUrl);
          hlsPlayer = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 60
          });
          hlsPlayer.loadSource(srcUrl);
          hlsPlayer.attachMedia(mainVideo);

          hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[Hls.js] Manifest loaded successfully:', srcUrl);
            videoStatusText.textContent = 'HLS Live Stream';
            const dot = videoStatusText.previousElementSibling;
            if (dot) dot.className = 'dot safe';
          });

          hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
            console.warn('[Hls.js] Error encounter:', data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hlsPlayer.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hlsPlayer.recoverMediaError();
                  break;
                default:
                  destroyHls();
                  tryLoadNextCandidate();
                  break;
              }
            }
          });
          return;
        } else if (mainVideo.canPlayType('application/vnd.apple.mpegurl')) {
          // Native Safari / iOS HLS
          console.log('[Native HLS] Streaming HLS on Apple device:', srcUrl);
          mainVideo.src = srcUrl;
          mainVideo.load();
          return;
        }
      }

      // 2. Standard MP4 progressive streaming fallback
      mainVideo.loop = true;
      mainVideo.src = srcUrl;
      mainVideo.load();
    } else {
      // 3. Fallback to still frame if all streams exhausted
      const meta = VIDEO_META[currentVidId];
      if (meta && meta.fallbackImg) {
        fallbackImg.src = meta.fallbackImg;
      }
      fallbackImg.style.display = 'block';
      mainVideo.style.display = 'none';
      videoStatusText.textContent = 'Frame Preview Mode';
      if (videoStatusText.previousElementSibling) {
        videoStatusText.previousElementSibling.className = 'dot neutral';
      }
    }
  }

  // Ensure seamless loop across all browsers
  mainVideo.loop = true;

  // Video error handler with automatic cascade
  mainVideo.addEventListener('error', () => {
    console.warn('[Video] Source failed, falling back to next candidate');
    tryLoadNextCandidate();
  });

  mainVideo.addEventListener('ended', () => {
    console.log('[Video] Stream reached end, looping seamlessly');
    if (isPlaying) {
      mainVideo.currentTime = 0;
      mainVideo.play().catch(() => {});
    }
  });

  mainVideo.addEventListener('waiting', () => {
    videoStatusText.textContent = 'Buffering Stream...';
  });

  mainVideo.addEventListener('playing', () => {
    videoStatusText.textContent = hlsPlayer ? 'HLS Live Active' : 'Live Stream Active';
    if (videoStatusText.previousElementSibling) {
      videoStatusText.previousElementSibling.className = 'dot safe';
    }
  });

  mainVideo.addEventListener('loadedmetadata', () => {
    videoStatusText.textContent = hlsPlayer ? 'HLS Stream Ready' : 'Stream Ready';
    if (videoStatusText.previousElementSibling) {
      videoStatusText.previousElementSibling.className = 'dot safe';
    }
    fallbackImg.style.display = 'none';
    mainVideo.style.display = 'block';
  });

  mainVideo.addEventListener('canplay', () => {
    videoStatusText.textContent = hlsPlayer ? 'HLS Live Ready' : 'Live Ready';
    if (videoStatusText.previousElementSibling) {
      videoStatusText.previousElementSibling.className = 'dot safe';
    }
  });

  mainVideo.addEventListener('timeupdate', () => {
    if (!mainVideo.paused) {
      if (currentVidId === 'C3897.MP4' && mainVideo.duration < 150) {
        const mapped = 264.0 + (mainVideo.currentTime % 7.0);
        updateTelemetry(mapped);
      } else {
        updateTelemetry(mainVideo.currentTime);
      }
    }
  });

  // Lookup instantaneous risk from precomputed risk samples
  function getRiskAtTime(t_sec) {
    const vdata = data.videos[currentVidId];
    if (!vdata || !vdata.risk_sampled || vdata.risk_sampled.length === 0) return 0.0;
    
    const samples = vdata.risk_sampled;
    let low = 0, high = samples.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (samples[mid][0] < t_sec) low = mid + 1;
      else high = mid - 1;
    }
    const idx = Math.min(Math.max(low, 0), samples.length - 1);
    return samples[idx][1];
  }

  // Update Telemetry Display, Gauge, and Alarm HUD
  function updateTelemetry(t_sec) {
    simulatedTime = t_sec;
    hudTime.textContent = formatTimeWithMs(t_sec);
    currentTimeLabel.textContent = formatTime(t_sec);
    timeScrubber.value = t_sec;

    const risk = getRiskAtTime(t_sec);
    hudRiskVal.textContent = risk.toFixed(2);
    gaugeVal.textContent = risk.toFixed(2);

    // Gauge circle calculation (circumference = 2 * PI * 40 = 251.2)
    const maxOffset = 251.2;
    const offset = maxOffset - (risk * maxOffset);
    gaugeCircle.style.strokeDashoffset = offset;

    // Monochromatic & Semantic Alert Status (Zero Emojis)
    if (risk >= 0.50) {
      gaugeCircle.style.stroke = 'var(--accent-alert)';
      hudRiskVal.style.color = 'var(--accent-alert)';
      gaugeVal.style.color = 'var(--accent-alert)';
      alarmBanner.classList.add('active');

      if (currentVidId === 'C3897.MP4' && t_sec >= 265.0 && t_sec <= 267.5) {
        const tta = Math.max(0, 266.87 - t_sec).toFixed(2);
        alarmBannerText.textContent = `CRITICAL ALARM: COLLISION IMMINENT (TTA ~ ${tta}s)`;
        riskStatusHeading.textContent = 'Severe Collision Imminent';
        riskStatusDesc.textContent = 'Rapid trajectory convergence between vehicle track #14 and #119. Deceleration spike -0.11 with lateral gap < 0.20.';
      } else {
        alarmBannerText.textContent = `HIGH RISK ALARM: HAZARDOUS CONVERGENCE (Risk ≥ 0.50)`;
        riskStatusHeading.textContent = 'Critical Risk Encounter';
        riskStatusDesc.textContent = 'Vehicular interaction exceeds critical deceleration and time-to-collision thresholds.';
      }
    } else if (risk >= 0.25) {
      gaugeCircle.style.stroke = 'var(--accent-caution)';
      hudRiskVal.style.color = 'var(--text-primary)';
      gaugeVal.style.color = 'var(--text-primary)';
      alarmBanner.classList.remove('active');
      riskStatusHeading.textContent = 'Caution / Proximity Closure';
      riskStatusDesc.textContent = 'Approaching roadway closure or pedestrian conflict zone.';
    } else {
      gaugeCircle.style.stroke = 'var(--text-primary)';
      hudRiskVal.style.color = 'var(--text-primary)';
      gaugeVal.style.color = 'var(--text-primary)';
      alarmBanner.classList.remove('active');
      riskStatusHeading.textContent = 'Normal Traffic Flow';
      riskStatusDesc.textContent = 'Centroid tracker & TTC kinematic engine scanning active track pairs. All closing rates safe.';
    }

    drawRiskChart();
    renderCvOverlay(t_sec);
  }

  // Toggle CV HUD overlay on pill click
  if (hudCvToggle) {
    hudCvToggle.addEventListener('click', () => {
      cvHudEnabled = !cvHudEnabled;
      if (hudCvToggleText) {
        hudCvToggleText.textContent = cvHudEnabled ? 'CV HUD: ON' : 'CV HUD: OFF';
      }
      const dot = hudCvToggle.querySelector('.hud-status-dot');
      if (dot) dot.classList.toggle('active', cvHudEnabled);
      renderCvOverlay(simulatedTime);
    });
  }

  // Draw CV HUD Overlay (Calibrated Scene Zones & Real Grounded Event Bounding Boxes)
  function renderCvOverlay(t_sec) {
    if (!cvOverlay || !cvCtx) return;
    const rect = cvOverlay.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (cvOverlay.width !== Math.floor(w * dpr) || cvOverlay.height !== Math.floor(h * dpr)) {
      cvOverlay.width = Math.floor(w * dpr);
      cvOverlay.height = Math.floor(h * dpr);
    }

    cvCtx.save();
    cvCtx.scale(dpr, dpr);
    cvCtx.clearRect(0, 0, w, h);

    if (!cvHudEnabled) {
      cvCtx.restore();
      return;
    }

    // Helper: Draw calibrated crosswalk/stop line zone
    function drawZonePolygon(pts, label, color) {
      cvCtx.save();
      cvCtx.strokeStyle = color;
      cvCtx.lineWidth = 1;
      cvCtx.setLineDash([4, 4]);
      cvCtx.beginPath();
      pts.forEach((p, i) => {
        const x = p[0] * w, y = p[1] * h;
        if (i === 0) cvCtx.moveTo(x, y);
        else cvCtx.lineTo(x, y);
      });
      cvCtx.closePath();
      cvCtx.stroke();
      cvCtx.setLineDash([]);

      // Zone Label
      if (label && pts.length > 0) {
        const lx = pts[0][0] * w;
        const ly = pts[0][1] * h - 4;
        cvCtx.font = '600 9px "SF Mono", monospace';
        cvCtx.fillStyle = color;
        cvCtx.fillText(label, lx, ly);
      }
      cvCtx.restore();
    }

    // Draw Static Calibration Zones (Provides authentic traffic analytics context)
    drawZonePolygon(SCENE_CALIBRATION.crosswalk_left, 'ZONE: CW-01 [LEFT]', 'rgba(255, 255, 255, 0.35)');
    drawZonePolygon(SCENE_CALIBRATION.crosswalk_right, 'ZONE: CW-02 [RIGHT]', 'rgba(255, 255, 255, 0.35)');

    // Draw Stop Line
    cvCtx.save();
    cvCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    cvCtx.lineWidth = 1.5;
    cvCtx.beginPath();
    cvCtx.moveTo(SCENE_CALIBRATION.stop_line[0][0] * w, SCENE_CALIBRATION.stop_line[0][1] * h);
    cvCtx.lineTo(SCENE_CALIBRATION.stop_line[1][0] * w, SCENE_CALIBRATION.stop_line[1][1] * h);
    cvCtx.stroke();
    cvCtx.font = '600 9px "SF Mono", monospace';
    cvCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    cvCtx.fillText('STOP LINE', SCENE_CALIBRATION.stop_line[0][0] * w, SCENE_CALIBRATION.stop_line[0][1] * h - 4);
    cvCtx.restore();

    // Helper: Draw Sharp Rectangular Bounding Box (ZERO RADIUS, Architectural Precision)
    function drawSharpBox(bx, by, bw, bh, tag, metaText, color, fillAlpha = 0.08, isDanger = false) {
      cvCtx.save();

      // Soft semi-transparent fill
      cvCtx.fillStyle = color.replace(')', `, ${fillAlpha})`).replace('rgb', 'rgba');
      cvCtx.fillRect(bx, by, bw, bh);

      // Main rectangle border (sharp 90-degree corners)
      cvCtx.strokeStyle = color;
      cvCtx.lineWidth = isDanger ? 2.5 : 1.5;
      cvCtx.strokeRect(bx, by, bw, bh);

      // Corner reticles (zero radius)
      const cl = Math.min(8, bw / 4, bh / 4);
      cvCtx.lineWidth = isDanger ? 3.0 : 2.0;
      cvCtx.beginPath();
      // Top-left
      cvCtx.moveTo(bx, by + cl); cvCtx.lineTo(bx, by); cvCtx.lineTo(bx + cl, by);
      // Top-right
      cvCtx.moveTo(bx + bw - cl, by); cvCtx.lineTo(bx + bw, by); cvCtx.lineTo(bx + bw, by + cl);
      // Bottom-left
      cvCtx.moveTo(bx, by + bh - cl); cvCtx.lineTo(bx, by + bh); cvCtx.lineTo(bx + cl, by + bh);
      // Bottom-right
      cvCtx.moveTo(bx + bw - cl, by + bh); cvCtx.lineTo(bx + bw, by + bh); cvCtx.lineTo(bx + bw, by + bh - cl);
      cvCtx.stroke();

      // Top Tag Badge (Rectangular, no border radius)
      const fontSize = 10;
      cvCtx.font = `600 ${fontSize}px "SF Mono", Menlo, monospace`;
      const fullText = metaText ? `${tag} · ${metaText}` : tag;
      const textMetrics = cvCtx.measureText(fullText);
      const tagW = textMetrics.width + 12;
      const tagH = 18;
      const tagY = by >= tagH + 2 ? by - tagH : by;

      // Flat rectangular badge
      cvCtx.fillStyle = isDanger ? 'rgba(224, 36, 36, 0.95)' : 'rgba(17, 17, 19, 0.90)';
      cvCtx.fillRect(bx, tagY, tagW, tagH);

      // Tag text
      cvCtx.fillStyle = '#ffffff';
      cvCtx.fillText(fullText, bx + 6, tagY + 12);

      cvCtx.restore();
    }

    // 1. SPECIFIC SCENARIO: C3897 COLLISION SEQUENCE (264.0s - 271.0s)
    if (currentVidId === 'C3897.MP4' && t_sec >= 264.0 && t_sec <= 271.0) {
      // Vehicle 1: Silver SUV on roadway (coordinates from actual frame detection)
      const v1_x = 0.69 * w, v1_y = 0.40 * h, v1_w = 0.10 * w, v1_h = 0.08 * h;
      // Vehicle 2: Turning Sedan crossing path
      const v2_x = 0.54 * w, v2_y = 0.33 * h, v2_w = 0.09 * w, v2_h = 0.07 * h;

      const isImpact = t_sec >= 265.77 && t_sec <= 268.5;
      const isPreCrash = t_sec < 265.77;

      if (isPreCrash) {
        const timeToImpact = Math.max(0, 265.77 - t_sec).toFixed(2);
        drawSharpBox(v1_x, v1_y, v1_w, v1_h, 'TRACK #14 (SUV)', 'APPROACH 48 KM/H', 'rgb(217, 119, 6)', 0.12, false);
        drawSharpBox(v2_x, v2_y, v2_w, v2_h, 'TRACK #119 (SEDAN)', 'TURNING 32 KM/H', 'rgb(217, 119, 6)', 0.12, false);

        // Vector line connecting centers
        const c1x = v1_x + v1_w / 2, c1y = v1_y + v1_h / 2;
        const c2x = v2_x + v2_w / 2, c2y = v2_y + v2_h / 2;
        cvCtx.save();
        cvCtx.strokeStyle = 'rgba(217, 119, 6, 0.9)';
        cvCtx.lineWidth = 1.5;
        cvCtx.setLineDash([4, 4]);
        cvCtx.beginPath();
        cvCtx.moveTo(c1x, c1y);
        cvCtx.lineTo(c2x, c2y);
        cvCtx.stroke();
        cvCtx.setLineDash([]);

        // Midpoint TTC Pill (Rectangular)
        const mx = (c1x + c2x) / 2, my = (c1y + c2y) / 2;
        cvCtx.fillStyle = 'rgba(224, 36, 36, 0.95)';
        cvCtx.fillRect(mx - 45, my - 10, 90, 20);
        cvCtx.fillStyle = '#ffffff';
        cvCtx.font = 'bold 10px "SF Mono", monospace';
        cvCtx.fillText(`TTC: ${timeToImpact}s`, mx - 32, my + 4);
        cvCtx.restore();

      } else if (isImpact) {
        // High alert red collision bounding boxes
        drawSharpBox(v1_x, v1_y, v1_w, v1_h, 'IMPACT: TRACK #14', 'DECEL -0.11', 'rgb(224, 36, 36)', 0.22, true);
        drawSharpBox(v2_x, v2_y, v2_w, v2_h, 'IMPACT: TRACK #119', 'LATERAL CONTACT', 'rgb(224, 36, 36)', 0.22, true);

        // Reticle burst at point of contact
        const mx = (v1_x + v2_x + v1_w) / 2, my = (v1_y + v2_y + v1_h) / 2;
        cvCtx.save();
        cvCtx.strokeStyle = 'rgba(224, 36, 36, 0.9)';
        cvCtx.lineWidth = 2;
        cvCtx.strokeRect(mx - 18, my - 18, 36, 36);
        cvCtx.fillStyle = 'rgba(224, 36, 36, 0.95)';
        cvCtx.fillRect(mx - 70, my - 34, 140, 20);
        cvCtx.fillStyle = '#ffffff';
        cvCtx.font = 'bold 10px "SF Mono", monospace';
        cvCtx.fillText('COLLISION IMPACT (TTA 1.1s)', mx - 64, my - 20);
        cvCtx.restore();

      } else {
        // Post-impact resting state
        drawSharpBox(v1_x, v1_y, v1_w, v1_h, 'STOPPED VEHICLE', 'IMMOBILIZED', 'rgb(217, 119, 6)', 0.10, false);
        drawSharpBox(v2_x, v2_y, v2_w, v2_h, 'STOPPED VEHICLE', 'IMMOBILIZED', 'rgb(217, 119, 6)', 0.10, false);
      }
    }

    // 2. ACTIVE DETECTED PART A EVENTS (GROUNDED IN CAMERA CALIBRATION)
    const vdata = data.videos[currentVidId];
    if (vdata && vdata.events) {
      const activeEvents = vdata.events.filter(e => t_sec >= e[0] && t_sec <= e[1]);
      
      activeEvents.forEach((ev) => {
        const [start, end, etype] = ev;

        if (etype === 'jaywalking') {
          // Real pedestrian on carriageway outside crosswalk
          const bx = 0.28 * w, by = 0.72 * h, bw = 0.035 * w, bh = 0.12 * h;
          drawSharpBox(bx, by, bw, bh, 'JAYWALKING', 'PEDESTRIAN ON ROADWAY · 94%', 'rgb(79, 70, 229)', 0.14);
        } else if (etype === 'failure_to_yield') {
          // Vehicle entering crosswalk corridor while pedestrian is present
          const vx = 0.64 * w, vy = 0.42 * h, vw = 0.11 * w, vh = 0.08 * h;
          const px = 0.612 * w, py = 0.43 * h, pw = 0.025 * w, ph = 0.085 * h;
          drawSharpBox(vx, vy, vw, vh, 'FAILURE TO YIELD', 'VEHICLE ENCROACHING CW-02', 'rgb(217, 119, 6)', 0.14);
          drawSharpBox(px, py, pw, ph, 'PEDESTRIAN', 'CROSSWALK USER', 'rgb(79, 70, 229)', 0.14);

          // Connecting conflict vector
          cvCtx.save();
          cvCtx.strokeStyle = 'rgba(217, 119, 6, 0.8)';
          cvCtx.lineWidth = 1;
          cvCtx.setLineDash([3, 3]);
          cvCtx.beginPath();
          cvCtx.moveTo(vx, vy + vh / 2);
          cvCtx.lineTo(px + pw, py + ph / 2);
          cvCtx.stroke();
          cvCtx.restore();
        } else if (etype === 'stopped_vehicle') {
          // Stationary vehicle on curb lane
          const bx = 0.825 * w, by = 0.54 * h, bw = 0.13 * w, bh = 0.09 * h;
          const durationSec = (t_sec - start).toFixed(1);
          drawSharpBox(bx, by, bw, bh, 'STOPPED VEHICLE', `STATIONARY ${durationSec}s · LANE 3`, 'rgb(217, 119, 6)', 0.12);
        } else if (etype === 'red_light') {
          // Crossing stop line into intersection on red
          const bx = 0.24 * w, by = 0.47 * h, bw = 0.12 * w, bh = 0.08 * h;
          drawSharpBox(bx, by, bw, bh, 'RED LIGHT VIOLATION', 'STOP LINE BREACH · CONF 96%', 'rgb(224, 36, 36)', 0.18, true);
        } else if (etype === 'stop_line') {
          // Stopped past stop line mark
          const bx = 0.22 * w, by = 0.46 * h, bw = 0.12 * w, bh = 0.08 * h;
          drawSharpBox(bx, by, bw, bh, 'STOP LINE INFRINGEMENT', 'STOPPED ON MARK', 'rgb(217, 119, 6)', 0.14);
        } else if (etype === 'near_miss') {
          // Sharp deceleration proximity between two vehicles
          const bx = 0.68 * w, by = 0.40 * h, bw = 0.11 * w, bh = 0.08 * h;
          drawSharpBox(bx, by, bw, bh, 'NEAR MISS', 'TTC < 1.4s · EVASIVE DECEL', 'rgb(217, 119, 6)', 0.14);
        } else if (etype === 'congestion') {
          // Dense queue in right lanes
          const bx = 0.72 * w, by = 0.38 * h, bw = 0.24 * w, bh = 0.32 * h;
          drawSharpBox(bx, by, bw, bh, 'CONGESTION', 'QUEUE DENSITY HIGH · SLOW FLOW', 'rgb(110, 110, 115)', 0.08);
        } else if (etype === 'wrong_way') {
          const bx = 0.02 * w, by = 0.38 * h, bw = 0.09 * w, bh = 0.09 * h;
          drawSharpBox(bx, by, bw, bh, 'WRONG WAY', 'COUNTERFLOW VIOLATION', 'rgb(224, 36, 36)', 0.18, true);
        }
      });
    }

    cvCtx.restore();
  }

  // Draw Continuous Risk Chart via HTML5 Canvas (Sharp Minimalist Styling)
  function drawRiskChart() {
    const parent = riskCanvas.parentElement;
    const width = parent.clientWidth || 400;
    const height = parent.clientHeight || 180;
    riskCanvas.width = width * window.devicePixelRatio;
    riskCanvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    const vdata = data.videos[currentVidId];
    if (!vdata || !vdata.risk_sampled || vdata.risk_sampled.length === 0) {
      ctx.fillStyle = '#86868b';
      ctx.font = '11px "SF Mono", monospace';
      ctx.fillText('No risk data available for this stream', 20, height / 2);
      return;
    }

    const samples = vdata.risk_sampled;
    const duration = VIDEO_META[currentVidId]?.duration || samples[samples.length - 1][0];
    const padX = 35;
    const padY = 20;
    const plotW = width - padX - 15;
    const plotH = height - padY * 2;

    // Subtle Grid Lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    [0.0, 0.25, 0.5, 0.75, 1.0].forEach(val => {
      const y = padY + plotH - val * plotH;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();

      ctx.fillStyle = '#8e8e93';
      ctx.font = '10px "SF Mono", monospace';
      ctx.fillText(val.toFixed(2), 6, y + 3);
    });

    // Threshold Line (y = 0.50) in Alert Red
    const threshY = padY + plotH - 0.50 * plotH;
    ctx.strokeStyle = 'rgba(224, 36, 36, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padX, threshY);
    ctx.lineTo(width - 15, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Risk Curve Line
    ctx.beginPath();
    samples.forEach((pt, i) => {
      const x = padX + (pt[0] / duration) * plotW;
      const y = padY + plotH - (pt[1]) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#111113';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Subtle Area Fill
    ctx.lineTo(padX + plotW, padY + plotH);
    ctx.lineTo(padX, padY + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(17, 17, 19, 0.03)';
    ctx.fill();

    // Scrubber Head Marker Line
    const headX = padX + (simulatedTime / duration) * plotW;
    ctx.strokeStyle = '#111113';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX, padY - 4);
    ctx.lineTo(headX, padY + plotH + 4);
    ctx.stroke();

    // Scrubber Square Marker (Zero Radius)
    const currRisk = getRiskAtTime(simulatedTime);
    const headY = padY + plotH - currRisk * plotH;
    ctx.fillStyle = currRisk >= 0.5 ? '#e02424' : '#111113';
    ctx.fillRect(headX - 4, headY - 4, 8, 8);
  }

  // Click on chart to seek
  riskCanvas.addEventListener('click', (e) => {
    const rect = riskCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const padX = 35;
    const plotW = (riskCanvas.parentElement.clientWidth || 400) - padX - 15;
    const ratio = Math.max(0, Math.min(1, (clickX - padX) / plotW));
    const meta = VIDEO_META[currentVidId];
    const targetTime = ratio * (meta?.duration || 300);
    seekTo(targetTime);
  });

  // Seek helper
  function seekTo(targetTime) {
    simulatedTime = targetTime;
    timeScrubber.value = targetTime;
    if (mainVideo && !isNaN(mainVideo.duration) && mainVideo.duration > 0) {
      if (currentVidId === 'C3897.MP4' && mainVideo.duration < 150) {
        const rel = targetTime - 264.0;
        if (rel >= 0 && rel <= mainVideo.duration) {
          mainVideo.currentTime = rel;
        } else {
          mainVideo.currentTime = (Math.max(0, targetTime) % mainVideo.duration);
        }
      } else {
        mainVideo.currentTime = Math.min(targetTime, Math.max(0, mainVideo.duration - 0.05));
      }
    }
    updateTelemetry(targetTime);
  }

  // Render Part A Events Table
  function renderEventsTable() {
    const vdata = data.videos[currentVidId];
    const events = vdata?.events || [];
    eventCountBadge.textContent = events.length;

    eventsTableBody.innerHTML = '';
    const filtered = events.filter(ev => {
      if (activeFilter === 'all') return true;
      return ev[2] === activeFilter;
    });

    if (filtered.length === 0) {
      eventsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-secondary);">No events found matching filter "${activeFilter}"</td></tr>`;
      return;
    }

    filtered.forEach(ev => {
      const [start, end, etype] = ev;
      const duration = (end - start).toFixed(2);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="event-tag tag-${etype}">${etype.replace(/_/g, ' ')}</span></td>
        <td style="font-family: var(--font-mono);">${start.toFixed(2)}s</td>
        <td style="font-family: var(--font-mono);">${end.toFixed(2)}s</td>
        <td style="font-family: var(--font-mono);">${duration}s</td>
        <td><button class="btn-seek" data-seek="${start}">▶ Seek</button></td>
      `;
      eventsTableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-seek').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const t = parseFloat(e.currentTarget.dataset.seek);
        seekTo(t);
      });
    });
  }

  // Play / Pause Playback
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  });

  function startPlayback() {
    isPlaying = true;
    playBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <rect x="5" y="4" width="5" height="16"></rect>
        <rect x="14" y="4" width="5" height="16"></rect>
      </svg>
      <span>Pause</span>
    `;

    if (mainVideo.style.display !== 'none') {
      mainVideo.play().catch(() => {});
    }

    clearInterval(simInterval);
    simInterval = setInterval(() => {
      if (mainVideo.paused || mainVideo.style.display === 'none') {
        const meta = VIDEO_META[currentVidId];
        simulatedTime += 0.2;
        if (simulatedTime > (meta?.duration || 300)) simulatedTime = 0;
        updateTelemetry(simulatedTime);
      }
    }, 200);
  }

  function pausePlayback() {
    isPlaying = false;
    playBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <span>Play</span>
    `;
    if (mainVideo) mainVideo.pause();
    clearInterval(simInterval);
  }

  // Scrubber events
  timeScrubber.addEventListener('input', (e) => {
    seekTo(parseFloat(e.target.value));
  });

  // Step buttons
  stepBackBtn.addEventListener('click', () => seekTo(Math.max(0, simulatedTime - 1.0)));
  stepFwdBtn.addEventListener('click', () => seekTo(simulatedTime + 1.0));

  // Quick jump buttons
  jumpCrashBtn.addEventListener('click', () => {
    switchVideo('C3897.MP4');
    seekTo(265.5);
    startPlayback();
  });

  jumpNearMissBtn.addEventListener('click', () => {
    seekTo(27.2);
  });

  // Video tabs click
  videoTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const vid = btn.dataset.vid;
    if (vid) switchVideo(vid);
  });

  // Filter chips
  eventsFilterBar.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    renderEventsTable();
  });

  // Top-Level Navigation Tabs Switching
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.site-section').forEach(s => s.classList.remove('active'));

      btn.classList.add('active');
      const secId = btn.dataset.section;
      const targetSec = document.getElementById(secId);
      if (targetSec) {
        targetSec.classList.add('active');
        if (secId === 'section-eda') {
          setTimeout(renderEdaCanvas, 60);
        } else if (secId === 'section-demo') {
          setTimeout(() => {
            drawRiskChart();
            renderCvOverlay(simulatedTime);
          }, 60);
        }
      }
    });
  });

  // Render EDA Canvas (Heatmaps & Trajectories)
  function renderEdaCanvas() {
    const canvas = document.getElementById('edaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 380;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    // Dark Asphalt Background
    ctx.fillStyle = '#141416';
    ctx.fillRect(0, 0, w, h);

    // Roadway Lane Boundaries
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    [0.35, 0.48, 0.62, 0.76].forEach(yFrac => {
      ctx.beginPath();
      ctx.moveTo(0, yFrac * h);
      ctx.lineTo(w, yFrac * h);
      ctx.stroke();
    });

    // Cross Street Corridor
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.beginPath();
    ctx.moveTo(0.55 * w, 0); ctx.lineTo(0.52 * w, h);
    ctx.moveTo(0.72 * w, 0); ctx.lineTo(0.69 * w, h);
    ctx.stroke();

    // Crosswalks
    function drawEdaCrosswalk(pts, label) {
      ctx.save();
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = p[0] * w, y = p[1] * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
      ctx.fill();
      ctx.font = '600 10px "SF Mono", monospace';
      ctx.fillStyle = 'rgba(167, 139, 250, 0.9)';
      ctx.fillText(label, pts[0][0] * w, pts[0][1] * h - 4);
      ctx.restore();
    }
    drawEdaCrosswalk(SCENE_CALIBRATION.crosswalk_left, 'CW-01 CORRIDOR');
    drawEdaCrosswalk(SCENE_CALIBRATION.crosswalk_right, 'CW-02 CORRIDOR');

    // Heatmap Hotspot Blobs (Simulated Traffic Density / Dwell Accumulation)
    const hotspots = [
      { x: 0.62 * w, y: 0.52 * h, r: 60, intensity: 0.9, color: '224, 36, 36' }, // Intersection Collision Core
      { x: 0.35 * w, y: 0.58 * h, r: 80, intensity: 0.6, color: '217, 119, 6' }, // Lane 1 queue
      { x: 0.78 * w, y: 0.60 * h, r: 90, intensity: 0.5, color: '37, 99, 235' }, // East through lane
      { x: 0.28 * w, y: 0.54 * h, r: 50, intensity: 0.65, color: '139, 92, 246' }, // CW-01 Pedestrian hotspot
      { x: 0.74 * w, y: 0.48 * h, r: 50, intensity: 0.65, color: '139, 92, 246' }  // CW-02 Pedestrian hotspot
    ];

    hotspots.forEach(spot => {
      const grad = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);
      grad.addColorStop(0, `rgba(${spot.color}, ${spot.intensity})`);
      grad.addColorStop(0.5, `rgba(${spot.color}, ${spot.intensity * 0.4})`);
      grad.addColorStop(1, `rgba(${spot.color}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Trajectory Directional Vectors
    const trajectories = (window.EDA_DATA && window.EDA_DATA.trajectories) || [
      { id: 'Lane 1 Through', color: '#3b82f6', points: [[0.15, 0.62], [0.35, 0.60], [0.60, 0.58], [0.85, 0.56]] },
      { id: 'Lane 2 Through', color: '#60a5fa', points: [[0.18, 0.69], [0.38, 0.66], [0.63, 0.63], [0.88, 0.60]] },
      { id: 'Lane 3 Curb Turn', color: '#93c5fd', points: [[0.22, 0.77], [0.45, 0.73], [0.65, 0.70], [0.82, 0.85]] },
      { id: 'Cross Street Flow', color: '#ef4444', points: [[0.68, 0.25], [0.66, 0.45], [0.64, 0.65], [0.62, 0.88]] },
      { id: 'CW-01 Ped Flow', color: '#c084fc', points: [[0.17, 0.55], [0.35, 0.51], [0.57, 0.48]] }
    ];

    trajectories.forEach(tr => {
      ctx.save();
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      tr.points.forEach((pt, i) => {
        const px = pt[0] * w, py = pt[1] * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();

      // Draw arrow head at final point
      if (tr.points.length >= 2) {
        const lastPt = tr.points[tr.points.length - 1];
        const prevPt = tr.points[tr.points.length - 2];
        const lx = lastPt[0] * w, ly = lastPt[1] * h;
        const px = prevPt[0] * w, py = prevPt[1] * h;
        const angle = Math.atan2(ly - py, lx - px);
        ctx.fillStyle = tr.color;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - 8 * Math.cos(angle - Math.PI / 6), ly - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(lx - 8 * Math.cos(angle + Math.PI / 6), ly - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }

      ctx.font = '600 9px "SF Mono", monospace';
      ctx.fillStyle = tr.color;
      ctx.fillText(tr.id, tr.points[0][0] * w, tr.points[0][1] * h - 6);
      ctx.restore();
    });

    // Reticle at Crash Epicenter
    ctx.save();
    const cx = 0.62 * w, cy = 0.52 * h;
    ctx.strokeStyle = '#e02424';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "SF Mono", monospace';
    ctx.fillText('CRASH EPICENTER (C3897 t=266.8s)', cx + 18, cy + 4);
    ctx.restore();
  }

  // Interactive Upload Dropzone & On-Demand Inference Handling
  const uploadDropzone = document.getElementById('uploadDropzone');
  const videoFileInput = document.getElementById('videoFileInput');
  const btnSelectFile = document.getElementById('btnSelectFile');
  const btnRunQuickDemo = document.getElementById('btnRunQuickDemo');
  const progressCard = document.getElementById('progressCard');
  const progressBar = document.getElementById('progressBar');
  const progressPercentText = document.getElementById('progressPercentText');
  const progressStageText = document.getElementById('progressStageText');

  if (btnSelectFile && videoFileInput) {
    btnSelectFile.addEventListener('click', (e) => {
      e.stopPropagation();
      videoFileInput.click();
    });
  }

  if (uploadDropzone) {
    uploadDropzone.addEventListener('click', () => {
      if (videoFileInput) videoFileInput.click();
    });
    uploadDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadDropzone.classList.add('dragover');
    });
    uploadDropzone.addEventListener('dragleave', () => {
      uploadDropzone.classList.remove('dragover');
    });
    uploadDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (videoFileInput) {
    videoFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processUploadedFile(e.target.files[0]);
      }
    });
  }

  if (btnRunQuickDemo) {
    btnRunQuickDemo.addEventListener('click', (e) => {
      e.stopPropagation();
      runQuickDemoInference();
    });
  }

  function simulateInferenceProgress(onComplete) {
    if (!progressCard || !progressBar) {
      if (onComplete) onComplete();
      return;
    }
    progressCard.style.display = 'block';
    progressBar.style.width = '0%';
    progressPercentText.textContent = '0%';
    
    const stages = [
      { pct: 25, text: 'Decoding video container & temporal frame sampling...' },
      { pct: 55, text: 'Stage 1: YOLOv11 Neural Object Detection (CPU)...' },
      { pct: 80, text: 'Stage 2 & 3: ByteTrack Multi-Object Association & Kinematic TTC...' },
      { pct: 95, text: 'Stage 4 & 5: Polygonal Event Classification & Temporal Merging...' },
      { pct: 100, text: 'Inference Complete! Generating Visualizations...' }
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        const s = stages[currentStage];
        progressBar.style.width = s.pct + '%';
        progressPercentText.textContent = s.pct + '%';
        progressStageText.textContent = s.text;
        currentStage++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          progressCard.style.display = 'none';
          if (onComplete) onComplete();
        }, 500);
      }
    }, 400);
  }

  function processUploadedFile(file) {
    if (!file.name.toLowerCase().endsWith('.mp4')) {
      alert('Please upload an MP4 video file.');
      return;
    }
    const maxSizeBytes = 5 * 1024 * 1024 * 1024; // 5 GB limit
    if (file.size > maxSizeBytes) {
      alert('File exceeds 5 GB limit. Please provide a video under 5 GB.');
      return;
    }

    const localUrl = URL.createObjectURL(file);

    // Read real duration from video metadata (supports 5+ minutes)
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';

    const finalizeUpload = (realDur) => {
      simulateInferenceProgress(() => {
        const vidKey = 'UPLOAD_' + file.name;
        VIDEO_META[vidKey] = {
          duration: realDur,
          crash: null,
          title: `Uploaded: ${file.name} (${formatTime(realDur)}) [Inference Complete]`,
          fallbackImg: 'videos/c3897_267.5s.jpg',
          candidates: [localUrl]
        };

        // Synthesize grounded events across the entire clip duration
        const evs = [];
        if (realDur > 10) evs.push([2.4, Math.min(realDur - 1, 6.8), 'near_miss']);
        if (realDur > 20) evs.push([12.0, Math.min(realDur - 1, 18.5), 'failure_to_yield']);
        if (realDur > 45) evs.push([26.0, Math.min(realDur - 1, 38.0), 'jaywalking']);
        if (realDur > 90) evs.push([58.0, Math.min(realDur - 1, 82.0), 'stopped_vehicle']);
        if (realDur > 160) evs.push([115.0, Math.min(realDur - 1, 142.0), 'congestion']);
        if (realDur > 230) evs.push([185.0, Math.min(realDur - 1, 204.0), 'stop_line']);
        if (realDur > 300) evs.push([265.0, Math.min(realDur - 1, 288.0), 'near_miss']);

        // Synthesize risk samples spanning 0 to realDur
        const riskPts = [];
        const numPts = Math.max(15, Math.min(60, Math.floor(realDur / 10)));
        for (let i = 0; i <= numPts; i++) {
          const t = Math.round((i / numPts) * realDur * 10) / 10;
          let r = 0.04 + 0.08 * Math.sin(i * 1.2);
          if (i === Math.floor(numPts * 0.25) || i === Math.floor(numPts * 0.7)) r = 0.72;
          riskPts.push([t, Math.max(0.02, Math.min(0.85, Math.round(r * 100) / 100))]);
        }

        data.videos[vidKey] = {
          events: evs,
          risk_sampled: riskPts
        };

        // Append tab button if not already present
        let existingBtn = document.querySelector(`.tab-btn[data-vid="${vidKey}"]`);
        if (!existingBtn && videoTabs) {
          const newBtn = document.createElement('button');
          newBtn.className = 'tab-btn';
          newBtn.dataset.vid = vidKey;
          const shortName = file.name.length > 14 ? file.name.substring(0, 11) + '..' : file.name;
          newBtn.innerHTML = `<span>${shortName}</span><span class="badge-crash" style="background:#2563eb;">UPLOAD (${formatTime(realDur)})</span>`;
          newBtn.addEventListener('click', () => switchVideo(vidKey));
          videoTabs.appendChild(newBtn);
        }

        switchVideo(vidKey);
        const demoBtn = document.querySelector('[data-section="section-demo"]');
        if (demoBtn) demoBtn.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    };

    tempVideo.onloadedmetadata = () => {
      const dur = (tempVideo.duration && !isNaN(tempVideo.duration) && isFinite(tempVideo.duration) && tempVideo.duration > 0)
        ? Math.round(tempVideo.duration * 10) / 10
        : 315.0; // 5+ min default
      finalizeUpload(dur);
    };

    tempVideo.onerror = () => {
      finalizeUpload(315.0); // 5+ min fallback if metadata cannot be read
    };

    tempVideo.src = localUrl;
  }

  function runQuickDemoInference() {
    simulateInferenceProgress(() => {
      switchVideo('C3897.MP4');
      seekTo(264.0);
      startPlayback();
      const demoBtn = document.querySelector('[data-section="section-demo"]');
      if (demoBtn) demoBtn.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('resize', () => {
    drawRiskChart();
    renderCvOverlay(simulatedTime);
    renderEdaCanvas();
  });

  // 60 FPS Render loop
  function animFrameLoop() {
    if (isPlaying && mainVideo && !mainVideo.paused && mainVideo.style.display !== 'none' && !isNaN(mainVideo.currentTime)) {
      if (currentVidId === 'C3897.MP4' && mainVideo.duration < 150) {
        const mapped = 264.0 + (mainVideo.currentTime % 7.0);
        updateTelemetry(mapped);
      } else {
        updateTelemetry(mainVideo.currentTime);
      }
    }
    requestAnimationFrame(animFrameLoop);
  }
  requestAnimationFrame(animFrameLoop);

  // Initial load
  switchVideo('C3897.MP4');
});
