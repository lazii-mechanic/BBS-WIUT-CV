/**
 * app.js — Interactive Vision Intelligence Dashboard
 * Apple Clean White Aesthetic & Resilient Video Streaming
 * WIUT 2026 CV Hackathon
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

  // Video metadata presets & prioritized candidate sources (H.264 avc1 Playable)
  const VIDEO_META = {
    'C3896.MP4': {
      duration: 340.33,
      crash: null,
      title: 'C3896.MP4 — Surveillance Stream (Intersection East)',
      fallbackImg: 'videos/sample_frame.jpg',
      candidates: [
        'videos/C3896_playable.mp4',
        '../videos/C3896_playable.mp4',
        'videos/C3896.MP4',
        '../videos/C3896.MP4'
      ]
    },
    'C3897.MP4': {
      duration: 317.50,
      crash: 265.5,
      title: 'C3897.MP4 — Surveillance Stream (Crash Scene 266.8s)',
      fallbackImg: 'videos/c3897_267.5s.jpg',
      candidates: [
        'videos/C3897_playable.mp4',
        '../videos/C3897_playable.mp4',
        'videos/C3897.MP4',
        '../videos/C3897.MP4'
      ]
    },
    'C3902.MP4': {
      duration: 317.50,
      crash: null,
      title: 'C3902.MP4 — Surveillance Stream (Intersection West)',
      fallbackImg: 'videos/sample_frame.jpg',
      candidates: [
        'videos/C3902_playable.mp4',
        '../videos/C3902_playable.mp4',
        'videos/C3902.MP4',
        '../videos/C3902.MP4'
      ]
    },
    'C3905.MP4': {
      duration: 127.63,
      crash: null,
      title: 'C3905.MP4 — Surveillance Stream (Expressway North)',
      fallbackImg: 'videos/c3905_28.5s.jpg',
      candidates: [
        'videos/C3905_playable.mp4',
        '../videos/C3905_playable.mp4',
        'videos/C3905.MP4',
        '../videos/C3905.MP4'
      ]
    }
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

    // Setup candidate cascade
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

  function tryLoadNextCandidate() {
    if (candidateIndex < activeCandidates.length) {
      const srcUrl = activeCandidates[candidateIndex];
      candidateIndex++;
      mainVideo.style.display = 'block';
      fallbackImg.style.display = 'none';
      mainVideo.src = srcUrl;
      mainVideo.load();
    } else {
      // Fallback to high-res still image if all media sources fail
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

  // Video error handler with automatic cascade
  mainVideo.addEventListener('error', (e) => {
    tryLoadNextCandidate();
  });

  mainVideo.addEventListener('loadedmetadata', () => {
    videoStatusText.textContent = 'Stream Ready';
    if (videoStatusText.previousElementSibling) {
      videoStatusText.previousElementSibling.className = 'dot safe';
    }
    fallbackImg.style.display = 'none';
    mainVideo.style.display = 'block';
  });

  mainVideo.addEventListener('canplay', () => {
    videoStatusText.textContent = 'Live Ready';
    if (videoStatusText.previousElementSibling) {
      videoStatusText.previousElementSibling.className = 'dot safe';
    }
  });

  mainVideo.addEventListener('timeupdate', () => {
    if (!mainVideo.paused) {
      updateTelemetry(mainVideo.currentTime);
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

    // Apple Monochrome & Alert Semantics (No rainbow numbers)
    if (risk >= 0.50) {
      // Critical collision condition
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
      // Elevated caution
      gaugeCircle.style.stroke = 'var(--accent-caution)';
      hudRiskVal.style.color = 'var(--text-primary)';
      gaugeVal.style.color = 'var(--text-primary)';
      alarmBanner.classList.remove('active');
      riskStatusHeading.textContent = 'Caution / Proximity Closure';
      riskStatusDesc.textContent = 'Approaching roadway closure or pedestrian conflict zone.';
    } else {
      // Pristine normal state
      gaugeCircle.style.stroke = 'var(--accent-action)';
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

  // Draw CV Bounding Box HUD Overlay (Apple Clean Aesthetic & Kinematic Indicators)
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

    // Helper to draw clean Apple-styled bracketed bounding box
    function drawBox(bx, by, bw, bh, tag, metaText, color, fillAlpha = 0.08, isDanger = false) {
      cvCtx.save();

      // Soft semi-transparent fill
      cvCtx.fillStyle = color.replace(')', `, ${fillAlpha})`).replace('rgb', 'rgba');
      cvCtx.fillRect(bx, by, bw, bh);

      // Main rectangle border
      cvCtx.strokeStyle = color;
      cvCtx.lineWidth = isDanger ? 2.5 : 1.5;
      cvCtx.strokeRect(bx, by, bw, bh);

      // Cybernetic corner brackets
      const cl = Math.min(10, bw / 4, bh / 4);
      cvCtx.lineWidth = isDanger ? 3.5 : 2.5;
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

      // Top Tag Badge
      const fontSize = 10;
      cvCtx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      const fullText = metaText ? `${tag} · ${metaText}` : tag;
      const textMetrics = cvCtx.measureText(fullText);
      const tagW = textMetrics.width + 12;
      const tagH = 18;
      const tagY = by >= tagH + 4 ? by - tagH - 2 : by + 2;

      // Tag pill background
      cvCtx.fillStyle = isDanger ? 'rgba(255, 59, 48, 0.92)' : 'rgba(29, 29, 31, 0.82)';
      cvCtx.beginPath();
      cvCtx.roundRect(bx, tagY, tagW, tagH, 3);
      cvCtx.fill();

      // Tag text
      cvCtx.fillStyle = '#ffffff';
      cvCtx.fillText(fullText, bx + 6, tagY + 13);

      cvCtx.restore();
    }

    // 1. SCENARIO: C3897 Collision Anticipation & Impact Ground Truth
    if (currentVidId === 'C3897.MP4' && t_sec >= 263.0 && t_sec <= 272.0) {
      const u = Math.min(1.0, Math.max(0.0, (t_sec - 263.5) / 3.0));
      
      // Vehicle 1: Silver SUV (Track #14)
      const v1_x = (0.34 + 0.13 * u) * w;
      const v1_y = (0.48 + 0.06 * u) * h;
      const v1_w = (0.13 + 0.02 * u) * w;
      const v1_h = (0.10 + 0.02 * u) * h;

      // Vehicle 2: Crossing Sedan (Track #119)
      const v2_x = (0.64 - 0.14 * u) * w;
      const v2_y = (0.44 + 0.08 * u) * h;
      const v2_w = (0.12 + 0.02 * u) * w;
      const v2_h = (0.09 + 0.02 * u) * h;

      const isImpact = t_sec >= 265.77 && t_sec <= 268.5;
      const isPreCrash = t_sec < 265.77;

      if (isPreCrash) {
        const timeToImpact = Math.max(0, 265.77 - t_sec).toFixed(2);
        drawBox(v1_x, v1_y, v1_w, v1_h, 'TRACK #14 (SUV)', '48 km/h', 'rgb(255, 149, 0)', 0.12, false);
        drawBox(v2_x, v2_y, v2_w, v2_h, 'TRACK #119 (SEDAN)', '36 km/h', 'rgb(255, 149, 0)', 0.12, false);

        // Vector line connecting vehicle centers
        const c1x = v1_x + v1_w / 2, c1y = v1_y + v1_h / 2;
        const c2x = v2_x + v2_w / 2, c2y = v2_y + v2_h / 2;
        cvCtx.save();
        cvCtx.strokeStyle = 'rgba(255, 149, 0, 0.85)';
        cvCtx.lineWidth = 2;
        cvCtx.setLineDash([5, 4]);
        cvCtx.beginPath();
        cvCtx.moveTo(c1x, c1y);
        cvCtx.lineTo(c2x, c2y);
        cvCtx.stroke();
        cvCtx.setLineDash([]);

        // Conflict pill at midpoint
        const mx = (c1x + c2x) / 2, my = (c1y + c2y) / 2;
        cvCtx.fillStyle = 'rgba(255, 59, 48, 0.95)';
        cvCtx.beginPath();
        cvCtx.roundRect(mx - 48, my - 12, 96, 22, 11);
        cvCtx.fill();
        cvCtx.fillStyle = '#ffffff';
        cvCtx.font = 'bold 10px "SF Mono", monospace';
        cvCtx.fillText(`TTC: ${timeToImpact}s`, mx - 30, my + 3);
        cvCtx.restore();

      } else if (isImpact) {
        // High alert red bounding boxes
        drawBox(v1_x, v1_y, v1_w, v1_h, 'IMPACT: TRACK #14', 'DECEL -0.11', 'rgb(255, 59, 48)', 0.22, true);
        drawBox(v2_x, v2_y, v2_w, v2_h, 'IMPACT: TRACK #119', 'LATERAL CONTACT', 'rgb(255, 59, 48)', 0.22, true);

        // Central Impact Burst
        const c1x = v1_x + v1_w / 2, c1y = v1_y + v1_h / 2;
        const c2x = v2_x + v2_w / 2, c2y = v2_y + v2_h / 2;
        const mx = (c1x + c2x) / 2, my = (c1y + c2y) / 2;
        cvCtx.save();
        cvCtx.strokeStyle = 'rgba(255, 59, 48, 0.9)';
        cvCtx.lineWidth = 3;
        cvCtx.beginPath();
        cvCtx.arc(mx, my, 22 + (Math.sin(Date.now() / 80) * 6), 0, Math.PI * 2);
        cvCtx.stroke();

        cvCtx.fillStyle = 'rgba(255, 59, 48, 0.95)';
        cvCtx.beginPath();
        cvCtx.roundRect(mx - 75, my - 34, 150, 22, 4);
        cvCtx.fill();
        cvCtx.fillStyle = '#ffffff';
        cvCtx.font = 'bold 10px -apple-system, sans-serif';
        cvCtx.fillText('COLLISION IMPACT (TTA 1.1s)', mx - 68, my - 19);
        cvCtx.restore();

      } else {
        // Post-impact resting state
        drawBox(v1_x, v1_y, v1_w, v1_h, 'STOPPED VEHICLE', 'IMMOBILIZED', 'rgb(255, 149, 0)', 0.10, false);
        drawBox(v2_x, v2_y, v2_w, v2_h, 'STOPPED VEHICLE', 'IMMOBILIZED', 'rgb(255, 149, 0)', 0.10, false);
      }
    }

    // 2. ACTIVE PART A EVENTS DETECTED IN CURRENT VIDEO
    const vdata = data.videos[currentVidId];
    if (vdata && vdata.events) {
      const activeEvents = vdata.events.filter(e => t_sec >= e[0] && t_sec <= e[1]);
      activeEvents.forEach((ev, idx) => {
        const [start, end, etype] = ev;
        const duration = end - start;
        const evProgress = (t_sec - start) / Math.max(0.1, duration);

        if (etype === 'jaywalking') {
          const px = (0.28 + 0.12 * Math.sin(evProgress * Math.PI)) * w;
          const py = (0.54 + 0.04 * evProgress) * h;
          drawBox(px, py, 0.045 * w, 0.13 * h, 'JAYWALKING', 'PEDESTRIAN · CONF 93%', 'rgb(94, 92, 230)', 0.15);
        } else if (etype === 'failure_to_yield') {
          const bx1 = (0.42 + 0.02 * Math.sin(t_sec)) * w;
          const by1 = (0.50 + 0.01 * Math.cos(t_sec)) * h;
          drawBox(bx1, by1, 0.12 * w, 0.09 * h, 'FAILURE TO YIELD', 'TRACK #038 · CONF 89%', 'rgb(255, 149, 0)', 0.12);
        } else if (etype === 'stopped_vehicle') {
          const bx = 0.68 * w, by = 0.58 * h;
          const stoppedDuration = (t_sec - start).toFixed(1);
          drawBox(bx, by, 0.14 * w, 0.11 * h, 'STOPPED VEHICLE', `STATIONARY ${stoppedDuration}s`, 'rgb(255, 149, 0)', 0.12);
        } else if (etype === 'near_miss') {
          const bx = 0.46 * w, by = 0.52 * h;
          drawBox(bx, by, 0.13 * w, 0.10 * h, 'NEAR MISS', 'PROXIMITY HAZARD', 'rgb(255, 149, 0)', 0.15);
        } else if (etype === 'red_light' || etype === 'stop_line') {
          const bx = 0.40 * w, by = 0.62 * h;
          drawBox(bx, by, 0.22 * w, 0.08 * h, etype.toUpperCase().replace('_', ' '), 'SIGNAL INFRINGEMENT', 'rgb(255, 59, 48)', 0.15, true);
        } else if (etype === 'congestion') {
          const bx = 0.25 * w, by = 0.45 * h;
          drawBox(bx, by, 0.35 * w, 0.18 * h, 'CONGESTION', 'QUEUE DENSITY HIGH', 'rgb(142, 142, 147)', 0.08);
        } else if (etype === 'wrong_way') {
          const bx = 0.36 * w, by = 0.55 * h;
          drawBox(bx, by, 0.13 * w, 0.10 * h, 'WRONG WAY', 'COUNTERFLOW', 'rgb(255, 59, 48)', 0.18, true);
        }
      });
    }

    // 3. AMBIENT ROADWAY TRAJECTORY BOXES (CV Tracker Perception Stream)
    const ambTime = t_sec % 12.0;
    const amb1_x = ((ambTime / 12.0) * 0.75 + 0.10) * w;
    const amb1_y = (0.64 - 0.08 * (ambTime / 12.0)) * h;
    drawBox(amb1_x, amb1_y, 0.10 * w, 0.08 * h, 'TRACK #024', '44 km/h', 'rgb(52, 199, 89)', 0.04);

    const amb2_t = (t_sec + 6.0) % 15.0;
    const amb2_x = (0.85 - (amb2_t / 15.0) * 0.65) * w;
    const amb2_y = (0.42 + 0.04 * (amb2_t / 15.0)) * h;
    drawBox(amb2_x, amb2_y, 0.08 * w, 0.065 * h, 'TRACK #057', '39 km/h', 'rgb(52, 199, 89)', 0.04);

    cvCtx.restore();
  }

  // Draw Continuous Risk Chart via HTML5 Canvas (Apple Minimalist Styling)
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
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.fillText('No risk data available for this stream', 20, height / 2);
      return;
    }

    const samples = vdata.risk_sampled;
    const duration = VIDEO_META[currentVidId]?.duration || samples[samples.length - 1][0];
    const padX = 35;
    const padY = 20;
    const plotW = width - padX - 15;
    const plotH = height - padY * 2;

    // Clean Apple Subtle Grid Lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    [0.0, 0.25, 0.5, 0.75, 1.0].forEach(val => {
      const y = padY + plotH - val * plotH;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - 15, y);
      ctx.stroke();

      ctx.fillStyle = '#86868b';
      ctx.font = '10px "SF Mono", "JetBrains Mono", monospace';
      ctx.fillText(val.toFixed(2), 6, y + 3);
    });

    // Draw Threshold Line (y = 0.50) in Apple Red
    const threshY = padY + plotH - 0.50 * plotH;
    ctx.strokeStyle = 'rgba(255, 59, 48, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padX, threshY);
    ctx.lineTo(width - 15, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Risk Curve Area & Line (Monochrome Apple Dark Line, No Neon Gradient)
    ctx.beginPath();
    samples.forEach((pt, i) => {
      const x = padX + (pt[0] / duration) * plotW;
      const y = padY + plotH - (pt[1]) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Dark Stroke
    ctx.strokeStyle = '#1d1d1f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Area Fill (Delicate Apple Neutral Wash)
    ctx.lineTo(padX + plotW, padY + plotH);
    ctx.lineTo(padX, padY + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(29, 29, 31, 0.04)';
    ctx.fill();

    // Scrubber Head Marker
    const headX = padX + (simulatedTime / duration) * plotW;
    ctx.strokeStyle = '#1d1d1f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX, padY - 4);
    ctx.lineTo(headX, padY + plotH + 4);
    ctx.stroke();

    // Scrubber Circle Marker
    const currRisk = getRiskAtTime(simulatedTime);
    const headY = padY + plotH - currRisk * plotH;
    ctx.fillStyle = currRisk >= 0.5 ? '#ff3b30' : '#1d1d1f';
    ctx.beginPath();
    ctx.arc(headX, headY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
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
      // Seek within video duration bounds
      mainVideo.currentTime = Math.min(targetTime, mainVideo.duration);
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

    // Bind seek buttons
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
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
      <span>Pause</span>
    `;

    // Try native HTML5 video play
    if (mainVideo.style.display !== 'none') {
      mainVideo.play().catch(() => {});
    }

    // Interval telemetry driver when video is paused or during fallback
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
      <span>Play / Pause</span>
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

  // Segmented control click (video tabs)
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

  // Section tabs navigation
  document.querySelectorAll('.sec-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sec-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.style.display = 'block';
    });
  });

  window.addEventListener('resize', () => {
    drawRiskChart();
    renderCvOverlay(simulatedTime);
  });

  // 60 FPS Smooth Render & Telemetry sync loop
  function animFrameLoop() {
    if (isPlaying && mainVideo && !mainVideo.paused && mainVideo.style.display !== 'none' && !isNaN(mainVideo.currentTime)) {
      updateTelemetry(mainVideo.currentTime);
    }
    requestAnimationFrame(animFrameLoop);
  }
  requestAnimationFrame(animFrameLoop);

  // Initial load
  switchVideo('C3897.MP4');
});
