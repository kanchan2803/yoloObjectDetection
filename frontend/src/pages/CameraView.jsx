import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useDrishtiAI from '../hooks/useDrishtiAI';
import useDrishtiVoice from '../hooks/useDrishtiVoice';
import { MODES } from '../components/DrishtiConstants';
import Navbar from '../components/Navbar';
import Icon from '../components/Icon';
import useFaceIdentification from '../hooks/useFaceIdentification';

export default function CameraView() {
  const navigate = useNavigate();
  const handleSafeNavigate = (path) => {
    setIsSystemActive(false);
    setSystemStatus("Deactivated");
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    const safetyTimeout = setTimeout(() => {
      navigate(path);
    }, 1500);

    speak("Drishti deactivated.", true, () => {
      clearTimeout(safetyTimeout);
      navigate(path);
    });
  };

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastSpokenRef = useRef(0);
  const idleTimerRef = useRef(null);

  const [currentMode, setCurrentMode] = useState("NORMAL");
  const [isMuted, setIsMuted] = useState(false);
  const [eventLog, setEventLog] = useState([]);
  const [systemStatus, setSystemStatus] = useState("Initializing...");
  const [isSystemActive, setIsSystemActive] = useState(false);

  const onModeActivated = useCallback(() => {
    setIsSystemActive(true);
    setSystemStatus("System Active");
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const { speak, playStartupSequence, handleScreenInteraction } = useDrishtiVoice(
    currentMode, setCurrentMode, isMuted, setIsMuted, onModeActivated
  );

  const { isModelLoaded, fps, activeDetections, isPathSafe, confidence, runInference } = useDrishtiAI(
    videoRef, speak, lastSpokenRef
  );

  const { identifyFace } = useFaceIdentification();

  // 1. Startup Logic
  useEffect(() => {
    const startSystem = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } },
          audio: true
        });
        if (videoRef.current) videoRef.current.srcObject = stream;

        if (isModelLoaded && !isSystemActive) {
          setSystemStatus("Waiting for Mode...");
          playStartupSequence();
          resetIdleTimer();
        }
      } catch (err) {
        setSystemStatus("Permission Denied");
      }
    };
    startSystem();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [isModelLoaded, isSystemActive]);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (!isSystemActive) {
        playStartupSequence();
        resetIdleTimer();
      }
    }, 40000);
  };

  // 2. Controlled Inference Loop
  useEffect(() => {
    if (isModelLoaded && isSystemActive) {
      runInference(currentMode);
    }
  }, [isModelLoaded, currentMode, isSystemActive]);

  // 3. Canvas Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState !== 4 || !isSystemActive) return;

    const ctx = canvas.getContext('2d');
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(170, 199, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((canvas.width / 3) * i, 0);
      ctx.lineTo((canvas.width / 3) * i, canvas.height);
      ctx.stroke();
    }
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (canvas.height / 3) * i);
      ctx.lineTo(canvas.width, (canvas.height / 3) * i);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    const scale = Math.min(canvas.width / vWidth, canvas.height / vHeight);
    const offsetX = (canvas.width - vWidth * scale) / 2;
    const offsetY = (canvas.height - vHeight * scale) / 2;
    const aiScaleX = vWidth / 640;
    const aiScaleY = vHeight / 640;

    activeDetections.forEach(det => {
      const x = ((det.cx - det.w / 2) * aiScaleX * scale) + offsetX;
      const y = ((det.cy - det.h / 2) * aiScaleY * scale) + offsetY;
      const drawW = (det.w * aiScaleX) * scale;
      const drawH = (det.h * aiScaleY) * scale;

      const isUrgent = det.distance === "Very Near" || det.distance === "Near";
ctx.strokeStyle = det.isCustom ? "#FFD700" : (isUrgent ? "#FFB4AB" : "#AAC7FF");      ctx.lineWidth = 2;
      ctx.setLineDash(isUrgent ? [] : [5, 5]);
      ctx.strokeRect(x, y, drawW, drawH);

      // Label background
      const labelText = `${det.label.toUpperCase()} ${(det.score || 0).toFixed(2)}`;
      ctx.font = "bold 10px Inter";
      const textWidth = ctx.measureText(labelText).width;
      const labelY = y > 20 ? y - 22 : y + 2;
      ctx.fillStyle = isUrgent ? "#FFB4AB" : "#AAC7FF";
      ctx.fillRect(x, labelY, textWidth + 8, 16);
      ctx.fillStyle = isUrgent ? "#690005" : "#003064";
      ctx.fillText(labelText, x + 4, labelY + 12);
    });
  }, [activeDetections, isSystemActive]);

  // 4. Audio Feedback
useEffect(() => {
  // async wrapper needed because identifyFace is async
  const run = async () => {
    if (currentMode === "PATHFINDER") return;

    if (isMuted || activeDetections.length === 0 || !isSystemActive) return;
    const currentTime = Date.now();
    const modeConfig = MODES[currentMode] || MODES.NORMAL;
    const cooldown = modeConfig.cooldown || 3000;

    if (currentTime - lastSpokenRef.current > cooldown) {
      const topObject = activeDetections[0];
      let message = topObject.displayText;

      // If it's a person detection, try to identify them
if (topObject.label === 'person' && videoRef.current) {
  const match = await identifyFace(videoRef.current, topObject);
  if (match) {
    message = `${topObject.distance} — that's ${match.label}, ${Math.round(match.confidence)}% confident`;
  }
}

      if (modeConfig.prefix) message = `${modeConfig.prefix} ${message}`;
      if (!isPathSafe && currentMode !== "SILENT") message = `Stop! ${message}`;

      speak(message);
      lastSpokenRef.current = currentTime;

      const newEntry = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 2 }),
        text: message,
        mode: currentMode
      };
      setEventLog(prev => [newEntry, ...prev].slice(0, 20));
    }
  }
  run()}, [activeDetections, isMuted, currentMode, isPathSafe, isSystemActive , identifyFace, lastSpokenRef, speak]);

  const handleManualModeSelection = (m) => {
    setCurrentMode(m);
    onModeActivated();
    speak(`${MODES[m].label} mode activated.`);
  };

  // Determine log entry icon & color for each entry
  const getLogEntryStyle = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('stop') || lower.includes('obstacle'))
      return { icon: 'warning', color: 'var(--error)', borderClass: 'camera-log-entry-danger' };
    if (lower.includes('person') || lower.includes('pedestrian'))
      return { icon: 'person', color: 'var(--primary)', borderClass: 'camera-log-entry-info' };
    return { icon: 'visibility', color: 'var(--tertiary)', borderClass: 'camera-log-entry-neutral' };
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      // Unmute
      setIsMuted(false);
      speak("Narration resumed.");
    } else {
      // Mute — cancel any ongoing speech immediately
      window.speechSynthesis.cancel();
      setIsMuted(true);
    }
  };

  const modeLabel = MODES[currentMode]?.label || currentMode;

  return (
    <div className="camera-page">
      <Navbar onNavigate={handleSafeNavigate} />

      {/* Status bar */}
      <div className={`camera-status-bar ${isSystemActive ? 'camera-status-bar-active' : 'camera-status-bar-waiting'}`}>
        <span className={`status-dot ${isSystemActive ? 'status-dot-active' : 'status-dot-waiting'}`} />
        {systemStatus}

        <button
          onClick={handleMuteToggle}
          className={`mute-toggle-btn ${isMuted ? 'mute-toggle-btn-muted' : ''}`}
        >
          <Icon name={isMuted ? 'volume_off' : 'volume_up'} fill size={16} />
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      {/* Main content */}
      <div className="camera-main" style={{ marginTop: 0 }}>
        {/* Camera feed */}
        <div className="camera-video-section">
          <div className="grid-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
          <div
            className="camera-video-wrapper"
            onDoubleClick={() => {
              setCurrentMode("SILENT");
              setIsMuted(true);
              handleScreenInteraction();
            }}
          >
            <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
            <canvas ref={canvasRef} className="camera-canvas" />

            {currentMode === "CONVERSATION" && (
              <div style={{
                position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                padding: '8px 20px', borderRadius: 'var(--radius-full)',
                background: 'rgba(170,199,255,0.1)', border: '1px solid var(--primary)',
                fontSize: 12, color: 'var(--primary)', fontWeight: 700, zIndex: 10
              }}>
                AI ASSISTANT LISTENING...
              </div>
            )}

            {!isSystemActive && (
              <div className="camera-overlay">
                <div className="camera-pulse" />
                <p style={{ marginTop: 20, fontWeight: 700, letterSpacing: 1, fontSize: 13, color: 'var(--on-surface)' }}>
                  LISTENING FOR COMMAND...
                </p>
              </div>
            )}

            {/* Safe path / obstacle badge */}
            {isSystemActive && (
              <div
                className="camera-path-alert"
                style={{
                  background: isPathSafe ? 'rgba(74,222,128,0.9)' : 'rgba(255,180,171,0.9)',
                  borderColor: isPathSafe ? 'rgba(74,222,128,0.5)' : 'rgba(255,180,171,0.5)',
                  color: isPathSafe ? '#052e16' : '#690005',
                }}
              >
                <Icon name={isPathSafe ? 'check_circle' : 'warning'} fill size={22} />
                {isPathSafe ? 'SAFE PATH' : 'OBSTACLE DETECTED'}
              </div>
            )}
          </div>
        </div>

        {/* Right column: log + mode selector */}
        <div className="camera-log-section">
          <div className="camera-log-panel">
            <div className="camera-log-header">
              <h2>Perception Log</h2>
              <Icon name="history" size={20} style={{ color: 'var(--primary)', cursor: 'pointer' }} />
            </div>
            <div className="camera-log-body">
              {eventLog.length === 0 && (
                <div style={{ color: 'var(--outline)', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
                  {isSystemActive ? "Scanning environment..." : "Waiting for mode selection"}
                </div>
              )}
              {eventLog.map(log => {
                const style = getLogEntryStyle(log.text);
                return (
                  <div key={log.id} className={`camera-log-entry ${style.borderClass}`}>
                    <div className="camera-log-entry-icon">
                      <Icon name={style.icon} size={20} style={{ color: style.color }} />
                    </div>
                    <div className="camera-log-entry-text">
                      <p>{log.text}</p>
                      <p className="log-time">{log.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Footer: mode selector + stats */}
      <footer className="camera-footer-wrapper">
        {/* Mode selector row */}
        <div className="camera-mode-row">
          {Object.keys(MODES).map(m => (
            <button
              key={m}
              onClick={() => handleManualModeSelection(m)}
              className={`camera-mode-btn ${currentMode === m ? 'camera-mode-btn-active' : ''}`}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        <div className="camera-footer">
          <div className="camera-stat-group">
            <div className="camera-stat">
              <span className="camera-stat-label">Speed</span>
              <span className="camera-stat-value">{fps} <small>FPS</small></span>
            </div>
            <div className="camera-stat">
              <span className="camera-stat-label">Mode</span>
              <span className="camera-mode-badge">{modeLabel}</span>
            </div>
          </div>

          <div className="camera-confidence-bar">
            <div className="camera-confidence-header">
              <span className="camera-stat-label">AI Confidence</span>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)' }}>{confidence}%</span>
            </div>
            <div className="camera-confidence-track">
              <div className="camera-confidence-fill" style={{ width: `${confidence}%` }} />
            </div>
          </div>

          <div className="camera-footer-actions">
            <button
              className={`camera-footer-btn ${isMuted ? 'camera-footer-btn-muted' : 'camera-footer-btn-primary'}`}
              onClick={handleMuteToggle}
              title={isMuted ? 'Unmute narration' : 'Mute narration'}
            >
              <Icon name={isMuted ? 'volume_off' : 'volume_up'} fill size={22} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
