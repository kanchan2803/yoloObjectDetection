import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useDrishtiAI from '../hooks/useDrishtiAI';
import useDrishtiAudio from '../hooks/useDrishtiAudio';
import useCustomObjectMatcher from '../hooks/useCustomObjectMatcher';
import useDrishtiVoice from '../hooks/useDrishtiVoice';
import { MODES } from '../components/DrishtiConstants';
import Navbar from '../components/Navbar';
import Icon from '../components/Icon';

export default function CameraView() {
  const navigate = useNavigate();

  const handleSafeNavigate = (path) => {
    setIsSystemActive(false);
    setSystemStatus("Deactivated");
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const safetyTimeout = setTimeout(() => navigate(path), 1500);
    speak("Drishti deactivated.", true, () => {
      clearTimeout(safetyTimeout);
      navigate(path);
    });
  };

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const idleTimerRef = useRef(null);

  const [currentMode, setCurrentMode] = useState("NORMAL");
  const [isMuted, setIsMuted] = useState(false);
  const [eventLog, setEventLog] = useState([]);
  const [systemStatus, setSystemStatus] = useState("Initializing...");
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [isLogExpanded, setIsLogExpanded] = useState(false);

  const onModeActivated = useCallback(() => {
    setIsSystemActive(true);
    setSystemStatus("System Active");
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const handleVoiceMuteToggle = useCallback((nextMuted) => {
    if (typeof nextMuted === 'boolean') {
      if (nextMuted) { window.speechSynthesis.cancel(); setIsMuted(true); }
      else setIsMuted(false);
      return;
    }
    setIsMuted((value) => {
      if (!value) window.speechSynthesis.cancel();
      return !value;
    });
  }, []);

  const audio = useDrishtiAudio(isMuted);
  const { speak, playStartupSequence, announce } = audio;
  const { references: customReferences } = useCustomObjectMatcher();

  // Voice log: adds entries for what the user says + system voice events
  const addVoiceLogEntry = useCallback((text, type = 'voice') => {
    const entry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      text,
      type, // 'voice' | 'detection' | 'system'
    };
    setEventLog(prev => [entry, ...prev].slice(0, 30));
  }, []);

  const {
    handleScreenInteraction,
    launchModeSelection,
    restartVoiceSelection,
    stopListening,
    isListening,
    isVoiceSupported,
    voiceError,
    lastHeard,
  } = useDrishtiVoice({
    setCurrentMode,
    setIsMuted,
    onModeActivated,
    speak,
    playStartupSequence,
    onToggleMute: handleVoiceMuteToggle,
    onVoiceLog: addVoiceLogEntry,
  });

  const { isModelLoaded, fps, activeDetections, isPathSafe, confidence, runInference } = useDrishtiAI(videoRef, customReferences);

  // 1. Startup
  useEffect(() => {
    const startSystem = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 640 } },
          audio: true
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (isModelLoaded && !isSystemActive) {
          setSystemStatus("Ready for voice selection");
          launchModeSelection();
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
      if (!isSystemActive) { launchModeSelection(); resetIdleTimer(); }
    }, 40000);
  };

  useEffect(() => {
    if (isSystemActive) return;
    if (voiceError) { setSystemStatus('Voice assistance needs attention'); return; }
    if (isListening) { setSystemStatus('Listening for mode'); return; }
    if (isModelLoaded) setSystemStatus('Ready for voice selection');
  }, [isListening, isModelLoaded, isSystemActive, voiceError]);

  // 2. Inference loop
  useEffect(() => {
    if (isModelLoaded && isSystemActive) runInference(currentMode);
  }, [isModelLoaded, currentMode, isSystemActive]);

  // 3. Canvas drawing
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
      ctx.beginPath(); ctx.moveTo((canvas.width / 3) * i, 0); ctx.lineTo((canvas.width / 3) * i, canvas.height); ctx.stroke();
    }
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(0, (canvas.height / 3) * i); ctx.lineTo(canvas.width, (canvas.height / 3) * i); ctx.stroke();
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
      ctx.strokeStyle = isUrgent ? "#FFB4AB" : "#AAC7FF";
      ctx.lineWidth = 2;
      ctx.setLineDash(isUrgent ? [] : [5, 5]);
      ctx.strokeRect(x, y, drawW, drawH);
      const labelText = `${(det.displayLabel || det.label).toUpperCase()} ${(det.score || 0).toFixed(2)}`;
      ctx.font = "bold 10px monospace";
      const textWidth = ctx.measureText(labelText).width;
      const labelY = y > 20 ? y - 22 : y + 2;
      ctx.fillStyle = isUrgent ? "#FFB4AB" : "#AAC7FF";
      ctx.fillRect(x, labelY, textWidth + 8, 16);
      ctx.fillStyle = isUrgent ? "#690005" : "#003064";
      ctx.fillText(labelText, x + 4, labelY + 12);
    });
  }, [activeDetections, isSystemActive]);

  // 4. Audio feedback + detection log
  useEffect(() => {
    if (isMuted || !isSystemActive) return;
    if (currentMode !== "PATHFINDER" && activeDetections.length === 0) return;
    const message = announce(activeDetections, currentMode, isPathSafe);
    if (!message) return;
    addVoiceLogEntry(message, 'detection');
  }, [activeDetections, announce, isMuted, currentMode, isPathSafe, isSystemActive]);

  const handleManualModeSelection = (m) => {
    stopListening();
    setCurrentMode(m);
    setIsMuted(m === "SILENT");
    onModeActivated();
    speak(`${MODES[m].label} activated.`, true);
    addVoiceLogEntry(`Mode changed to ${MODES[m].label}`, 'system');
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      speak("Narration resumed.", true);
      addVoiceLogEntry("Narration resumed", 'system');
    } else {
      window.speechSynthesis.cancel();
      setIsMuted(true);
      addVoiceLogEntry("Narration muted", 'system');
    }
  };

  const getLogEntryStyle = (entry) => {
    if (entry.type === 'voice') return { icon: 'mic', color: '#A78BFA', dot: '#7C3AED' };
    if (entry.type === 'system') return { icon: 'settings', color: '#60A5FA', dot: '#2563EB' };
    const lower = entry.text.toLowerCase();
    if (lower.includes('stop') || lower.includes('obstacle') || lower.includes('danger'))
      return { icon: 'warning', color: '#F87171', dot: '#DC2626' };
    if (lower.includes('person') || lower.includes('pedestrian'))
      return { icon: 'person', color: '#AAC7FF', dot: '#3E90FF' };
    return { icon: 'visibility', color: '#6EE7B7', dot: '#059669' };
  };

  const modeLabel = MODES[currentMode]?.label || currentMode;
  const startupHint = isVoiceSupported
    ? (isListening ? 'Say a mode name. You can also say mute, unmute, restart, or help.' : 'Tap the microphone to start voice mode selection.')
    : 'Voice commands unavailable. Use mode buttons below.';

  return (
    <div style={layoutStyles.root}>
      <Navbar onNavigate={handleSafeNavigate} />

      {/* ── STATUS BAR ── */}
      <div style={{
        ...layoutStyles.statusBar,
        background: isSystemActive ? 'rgba(0,30,10,0.85)' : 'rgba(20,20,40,0.85)',
        borderBottom: isSystemActive ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(170,199,255,0.15)',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: isSystemActive ? '#4ADE80' : '#60A5FA',
          boxShadow: isSystemActive ? '0 0 8px #4ADE80' : '0 0 8px #60A5FA',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: isSystemActive ? '#4ADE80' : '#AAC7FF' }}>
          {systemStatus}
        </span>

        {!isSystemActive && isVoiceSupported && (
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
            background: isListening ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.07)',
            color: isListening ? '#A78BFA' : '#888', border: isListening ? '1px solid #7C3AED' : '1px solid #333',
          }}>
            {isListening ? '● MIC LIVE' : 'MIC READY'}
          </span>
        )}

        {currentMode === "PATHFINDER" && isSystemActive && (
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
            background: isPathSafe ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.2)',
            color: isPathSafe ? '#4ADE80' : '#F87171',
            border: isPathSafe ? '1px solid #166534' : '1px solid #991B1B',
          }}>
            {isPathSafe ? 'PATH CLEAR' : '⚠ OBSTACLE'}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={handleMuteToggle} style={{
            ...layoutStyles.statusBtn,
            background: isMuted ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.07)',
            color: isMuted ? '#F87171' : '#AAC7FF',
            border: isMuted ? '1px solid #991B1B' : '1px solid #333',
          }}>
            <Icon name={isMuted ? 'volume_off' : 'volume_up'} fill size={13} />
            {isMuted ? 'UNMUTE' : 'MUTE'}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── fills remaining height */}
      <div style={layoutStyles.mainArea}>

        {/* LEFT / CAMERA COLUMN */}
        <div style={layoutStyles.cameraColumn}>
          <div
            style={layoutStyles.videoWrapper}
            onDoubleClick={() => {
              setCurrentMode("SILENT");
              setIsMuted(true);
              handleScreenInteraction();
            }}
          >
            <video ref={videoRef} autoPlay playsInline muted style={layoutStyles.video} />
            <canvas ref={canvasRef} style={layoutStyles.canvas} />

            {/* Startup overlay */}
            {!isSystemActive && (
              <div style={layoutStyles.overlay}>
                <div style={layoutStyles.startupCard}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: isListening ? 'rgba(167,139,250,0.2)' : 'rgba(170,199,255,0.1)',
                    border: isListening ? '2px solid #7C3AED' : '2px solid rgba(170,199,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isListening ? 'breathe 1.5s ease-in-out infinite' : 'none',
                  }}>
                    <Icon name={isListening ? 'mic' : 'assistant'} size={24} fill={isListening} style={{ color: isListening ? '#A78BFA' : '#AAC7FF' }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Welcome to Drishti</h2>
                    <p style={{ margin: 0, fontSize: 13, color: '#888', lineHeight: 1.5 }}>{startupHint}</p>
                    {voiceError && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#F87171' }}>{voiceError}</p>}
                    {lastHeard && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#A78BFA', fontStyle: 'italic' }}>Heard: "{lastHeard}"</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button onClick={() => restartVoiceSelection({ withPrompt: true })} style={layoutStyles.startupPrimary}>
                      <Icon name="mic" size={16} />
                      {isListening ? 'Listening...' : 'Voice Select'}
                    </button>
                    <button onClick={() => handleManualModeSelection('NORMAL')} style={layoutStyles.startupSecondary}>
                      <Icon name="play_arrow" size={16} />
                      Normal Mode
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {Object.keys(MODES).filter(k => k !== 'SILENT').slice(0, 5).map(k => (
                      <span key={k} style={layoutStyles.modeChip}>{MODES[k].label.replace(/\bMode\b/g, '').trim()}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pathfinder badge */}
            {isSystemActive && currentMode === "PATHFINDER" && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                padding: '8px 18px', borderRadius: 99, fontWeight: 800, fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8, zIndex: 10,
                background: isPathSafe ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                color: isPathSafe ? '#052e16' : '#450a0a',
                boxShadow: isPathSafe ? '0 0 20px rgba(74,222,128,0.4)' : '0 0 20px rgba(248,113,113,0.4)',
              }}>
                <Icon name={isPathSafe ? 'check_circle' : 'warning'} fill size={18} />
                {isPathSafe ? 'SAFE PATH' : 'OBSTACLE DETECTED'}
              </div>
            )}
          </div>

          {/* ── MODE SELECTOR (below camera) ── */}
          <div style={layoutStyles.modeBar}>
            <div style={layoutStyles.modeScroll}>
              {Object.keys(MODES).map(m => (
                <button key={m} onClick={() => handleManualModeSelection(m)} style={{
                  ...layoutStyles.modeBtn,
                  background: currentMode === m ? MODES[m].color || '#3E90FF' : 'rgba(255,255,255,0.06)',
                  color: currentMode === m ? '#fff' : '#888',
                  border: currentMode === m ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  fontWeight: currentMode === m ? 800 : 500,
                }}>
                  {MODES[m].label.replace(/\bMode\b/g, '').trim() || m}
                </button>
              ))}
            </div>
          </div>

          {/* ── STATS FOOTER ── */}
          <div style={layoutStyles.statsBar}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={layoutStyles.stat}><span style={layoutStyles.statLabel}>FPS</span> <span style={layoutStyles.statVal}>{fps}</span></span>
              <span style={layoutStyles.stat}><span style={layoutStyles.statLabel}>MODE</span> <span style={{ ...layoutStyles.statVal, color: '#AAC7FF' }}>{modeLabel}</span></span>
              <span style={layoutStyles.stat}><span style={layoutStyles.statLabel}>CONF</span> <span style={layoutStyles.statVal}>{confidence}%</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 160 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
                <div style={{ width: `${confidence}%`, height: '100%', borderRadius: 2, background: '#3E90FF', transition: 'width 0.3s' }} />
              </div>
            </div>
            <button onClick={handleMuteToggle} style={{ ...layoutStyles.iconBtn, color: isMuted ? '#F87171' : '#AAC7FF' }}>
              <Icon name={isMuted ? 'volume_off' : 'volume_up'} fill size={18} />
            </button>
            <button onClick={() => setIsLogExpanded(v => !v)} style={{ ...layoutStyles.iconBtn, color: '#888' }}>
              <Icon name={isLogExpanded ? 'close' : 'history'} size={18} />
            </button>
          </div>
        </div>

        {/* RIGHT / LOG COLUMN — always visible on desktop, slide-up on mobile */}
        <div style={{
          ...layoutStyles.logColumn,
          transform: isLogExpanded ? 'translateY(0)' : undefined,
        }}>
          <div style={layoutStyles.logHeader}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#AAC7FF' }}>Perception Log</span>
            <button onClick={() => setIsLogExpanded(v => !v)} style={{ ...layoutStyles.iconBtn, color: '#555' }}>
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* Voice input display */}
          {lastHeard && (
            <div style={layoutStyles.lastHeardBadge}>
              <Icon name="mic" size={12} style={{ color: '#A78BFA' }} />
              <span style={{ fontSize: 11, color: '#A78BFA', fontStyle: 'italic' }}>"{lastHeard}"</span>
            </div>
          )}

          <div style={layoutStyles.logScroll}>
            {eventLog.length === 0 && (
              <div style={{ color: '#444', textAlign: 'center', marginTop: 40, fontSize: 12 }}>
                {isSystemActive ? "Scanning environment..." : "Waiting for mode selection"}
              </div>
            )}
            {eventLog.map(log => {
              const style = getLogEntryStyle(log);
              return (
                <div key={log.id} style={{
                  display: 'flex', gap: 10, padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: `${style.dot}22`, border: `1px solid ${style.dot}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name={style.icon} size={14} style={{ color: style.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: log.type === 'voice' ? '#C4B5FD' : '#CCC', wordBreak: 'break-word' }}>
                      {log.text}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#444' }}>{log.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile log overlay toggle */}
      <button
        onClick={() => setIsLogExpanded(v => !v)}
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 50,
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(30,30,50,0.9)', border: '1px solid rgba(170,199,255,0.2)',
          color: '#AAC7FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          // Hide on desktop via media query workaround (inline styles can't do that, so we use a data attr)
        }}
        className="log-mobile-fab"
      >
        <Icon name={isLogExpanded ? 'close' : 'history'} size={20} />
      </button>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }

        /* Hide FAB on desktop */
        @media (min-width: 768px) { .log-mobile-fab { display: none !important; } }

        /* On mobile: log column is a slide-up sheet */
        @media (max-width: 767px) {
          .camera-log-col {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            top: auto !important;
            width: 100% !important;
            max-height: 55vh !important;
            border-radius: 20px 20px 0 0 !important;
            transform: translateY(100%);
            transition: transform 0.3s ease !important;
            z-index: 40 !important;
          }
          .camera-log-col.expanded {
            transform: translateY(0) !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── MODES color map (fallback for mode buttons) ──
Object.assign(MODES, {
  NORMAL: { ...MODES.NORMAL, color: '#3E90FF' },
  HOME: { ...MODES.HOME, color: '#5E5CE6' },
  OUTDOOR: { ...MODES.OUTDOOR, color: '#32D74B' },
  SHOPPING: { ...MODES.SHOPPING, color: '#FF9F0A' },
  SOCIAL: { ...MODES.SOCIAL, color: '#BF5AF2' },
  PATHFINDER: { ...MODES.PATHFINDER, color: '#0A84FF' },
  EMERGENCY: { ...MODES.EMERGENCY, color: '#FF3B30' },
  SILENT: { ...MODES.SILENT, color: '#636366' },
});

const layoutStyles = {
  root: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0A0A0F',
    color: '#FFF',
    overflow: 'hidden',
    fontFamily: 'monospace, system-ui',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    flexShrink: 0,
    backdropFilter: 'blur(10px)',
    minHeight: 36,
  },
  statusBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 99,
    fontSize: 10, fontWeight: 700, letterSpacing: 1,
    cursor: 'pointer', transition: 'all 0.2s',
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0, // critical: lets flex children shrink properly
  },
  cameraColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 0,
    background: '#000',
    cursor: 'pointer',
  },
  video: {
    width: '100%', height: '100%', objectFit: 'cover', display: 'block',
  },
  canvas: {
    position: 'absolute', inset: 0,
    width: '100%', height: '100%', objectFit: 'cover', zIndex: 2,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute', inset: 0, zIndex: 10,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  startupCard: {
    background: 'rgba(20,20,35,0.95)',
    border: '1px solid rgba(170,199,255,0.15)',
    borderRadius: 16, padding: '28px 24px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    maxWidth: 340, width: '90%',
    backdropFilter: 'blur(20px)',
  },
  startupPrimary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 99,
    background: 'rgba(167,139,250,0.15)', border: '1px solid #7C3AED',
    color: '#C4B5FD', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  startupSecondary: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 99,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#AAC7FF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  modeChip: {
    padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700,
    background: 'rgba(255,255,255,0.07)', color: '#666',
    border: '1px solid rgba(255,255,255,0.1)', textTransform: 'uppercase', letterSpacing: 1,
  },
  modeBar: {
    flexShrink: 0,
    background: 'rgba(15,15,25,0.95)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    padding: '8px 12px',
  },
  modeScroll: {
    display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2,
    scrollbarWidth: 'none',
  },
  modeBtn: {
    padding: '6px 14px', borderRadius: 99,
    fontSize: 11, letterSpacing: 0.5,
    whiteSpace: 'nowrap', cursor: 'pointer',
    transition: 'all 0.2s', flexShrink: 0,
  },
  statsBar: {
    flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '6px 14px',
    background: 'rgba(10,10,20,0.95)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  stat: { display: 'flex', gap: 5, alignItems: 'baseline' },
  statLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#444', textTransform: 'uppercase' },
  statVal: { fontSize: 13, fontWeight: 900, color: '#EEE' },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 6, borderRadius: 8,
  },
  logColumn: {
    width: 280,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(12,12,20,0.98)',
    borderLeft: '1px solid rgba(255,255,255,0.07)',
    overflow: 'hidden',
    // On mobile this becomes a fixed sheet via the className + CSS above
  },
  logHeader: {
    flexShrink: 0,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  lastHeardBadge: {
    flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: 6,
    margin: '6px 14px',
    padding: '6px 10px', borderRadius: 8,
    background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
  },
  logScroll: {
    flex: 1, overflowY: 'auto',
    padding: '4px 14px',
    scrollbarWidth: 'thin', scrollbarColor: '#222 transparent',
  },
};