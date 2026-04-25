/**
 * useDrishtiVoice.jsx — Fixed version
 *
 * KEY FIXES:
 * 1. handleVoiceCommand now uses a stable ref (commandHandlerRef) so it can
 *    call restartVoiceSelection even though that function is defined below it.
 *    Previously this was a closure temporal dead zone bug causing silent failures.
 *
 * 2. Recognition restart logic now uses a flag (shouldResumeListeningRef) that
 *    is set to false before stopListening(), preventing ghost restarts.
 *
 * 3. onVoiceLog callback added — every recognized utterance is sent to the log
 *    so users can see what Drishti heard, confirmed or not.
 *
 * 4. No re-instantiation while a recognition instance exists. The old code could
 *    create two simultaneous instances if onend fired while isListening was stale.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MODES } from '../components/DrishtiConstants';

const MODE_ALIASES = {
  NORMAL:     ['normal', 'regular', 'default', 'standard'],
  HOME:       ['home', 'indoor', 'house', 'inside'],
  OUTDOOR:    ['outdoor', 'outside', 'street', 'travel'],
  SHOPPING:   ['shopping', 'shop', 'store', 'market'],
  SOCIAL:     ['social', 'people', 'friends', 'conversation'],
  PATHFINDER: ['pathfinder', 'path', 'navigation', 'navigate', 'finder'],
  EMERGENCY:  ['emergency', 'danger', 'alert', 'help'],
  SILENT:     ['silent', 'mute', 'stop', 'pause', 'quiet'],
};

function getSpeechRecognitionConstructor() {
  return (typeof window !== 'undefined')
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;
}

function normalizeTranscript(transcript = '') {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function useDrishtiVoice({
  setCurrentMode,
  setIsMuted,
  onModeActivated,
  speak,
  playStartupSequence,
  onRestartSelection,
  onToggleMute,
  onVoiceLog,        // NEW: (text: string) => void  — called with what was heard
}) {
  const recognitionRef       = useRef(null);
  const shouldResumeRef      = useRef(false);   // controls auto-restart
  const retryTimeoutRef      = useRef(null);
  const commandHandlerRef    = useRef(null);    // stable ref to avoid closure stale bug
  const restartRef           = useRef(null);    // stable ref to restartVoiceSelection

  const [isListening,    setIsListening]    = useState(false);
  const [voiceError,     setVoiceError]     = useState('');
  const [lastHeard,      setLastHeard]      = useState('');

  const isVoiceSupported = useMemo(() => Boolean(getSpeechRecognitionConstructor()), []);

  // ── helpers ──────────────────────────────────────────────────────────────

  const clearRetry = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  /**
   * Hard stop — kills recognition instance and disables auto-restart.
   * Safe to call multiple times.
   */
  const stopListening = () => {
    shouldResumeRef.current = false;
    clearRetry();
    if (recognitionRef.current) {
      try {
        // Remove onend BEFORE calling stop() to prevent the onend → scheduleRestart
        // chain from firing one final time after we've deliberately stopped.
        recognitionRef.current.onend   = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (_) { /* already stopped */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  /**
   * Schedule a fresh recognition instance after a short delay.
   * Only runs if shouldResumeRef is still true.
   */
  const scheduleRestart = () => {
    clearRetry();
    retryTimeoutRef.current = setTimeout(() => {
      if (shouldResumeRef.current && !recognitionRef.current) {
        startListening({ announceRetry: false });
      }
    }, 1000);
  };

  // ── mode activation ───────────────────────────────────────────────────────

  const activateMode = (modeKey) => {
    const nextMode = MODES[modeKey] ? modeKey : 'NORMAL';
    const label    = MODES[nextMode]?.label || nextMode;

    stopListening(); // must come before setCurrentMode to prevent restart race
    setVoiceError('');
    setCurrentMode(nextMode);
    setIsMuted(nextMode === 'SILENT');
    speak(`${label} activated.`, true);
    if (onModeActivated) onModeActivated(nextMode);
    if (onVoiceLog) onVoiceLog(`▶ Mode activated: ${label}`, 'system');
  };

  const resolveModeFromTranscript = (normalized) => {
    for (const [modeKey, aliases] of Object.entries(MODE_ALIASES)) {
      if (aliases.some(alias => normalized.includes(alias))) return modeKey;
    }
    for (const [modeKey, mode] of Object.entries(MODES)) {
      const modeName = normalizeTranscript(mode.label);
      if (modeName && normalized.includes(modeName)) return modeKey;
    }
    return null;
  };

  // ── command handler ───────────────────────────────────────────────────────
  // Defined as a regular function (not arrow, not useCallback) and stored in a
  // ref so recognition.onresult can always call the *latest* version without
  // React closure staleness. This is the fix for the original silent-failure bug.

  function handleVoiceCommand(transcript) {
    const normalized = normalizeTranscript(transcript);
    if (!normalized) return;

    setLastHeard(transcript.trim());
    if (onVoiceLog) onVoiceLog(`🎙 "${transcript.trim()}"`, 'voice');

    // ── help ──
    if (normalized.includes('help') || normalized.includes('what can i say')) {
      speak('You can say normal, home, outdoor, shopping, social, pathfinder, emergency, silent, mute, unmute, or restart.', true);
      return;
    }

    // ── restart ──
    if (normalized.includes('restart') || normalized.includes('start again') || normalized.includes('reset')) {
      if (restartRef.current) restartRef.current({ withPrompt: true });
      return;
    }

    // ── unmute ──
    if (normalized.includes('unmute') || normalized.includes('resume voice') || normalized.includes('resume narration')) {
      if (onToggleMute) onToggleMute(false);
      speak('Narration resumed.', true);
      if (onVoiceLog) onVoiceLog('✅ Unmuted', 'system');
      return;
    }

    // ── mute ──
    if (normalized.includes('mute') || normalized.includes('quiet') || normalized.includes('stop speaking')) {
      if (onToggleMute) onToggleMute(true);
      speak('Narration muted. Say unmute to hear updates again.', true);
      if (onVoiceLog) onVoiceLog('🔇 Muted', 'system');
      return;
    }

    // ── deactivate / stop system ──
    if (normalized.includes('deactivate') || normalized.includes('stop system') || normalized.includes('turn off')) {
      speak('Drishti deactivating. Say restart to resume.', true);
      if (onVoiceLog) onVoiceLog('⏹ System deactivated by voice', 'system');
      setCurrentMode('SILENT');
      setIsMuted(true);
      return;
    }

    // ── mode selection ──
    const modeKey = resolveModeFromTranscript(normalized);
    if (modeKey) {
      activateMode(modeKey);
      return;
    }

    // ── unknown ──
    speak('Mode not recognized. Say normal, home, outdoor, shopping, pathfinder, emergency, or silent.', true);
    if (onVoiceLog) onVoiceLog(`❓ Not recognized: "${transcript.trim()}"`, 'system');
  }

  // Keep commandHandlerRef current every render so onresult always has latest
  commandHandlerRef.current = handleVoiceCommand;

  // ── startListening ───────────────────────────────────────────────────────

  const startListening = ({ announceRetry = true } = {}) => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      setVoiceError('Voice commands are not supported in this browser. Use the mode buttons below.');
      return false;
    }

    // Guard: don't create a second instance if one is already running
    if (recognitionRef.current) return true;

    clearRetry();
    shouldResumeRef.current = true;

    let recognition;
    try {
      recognition = new SpeechRecognition();
    } catch (err) {
      setVoiceError('Could not start voice recognition. Use mode buttons.');
      return false;
    }

    // Settings: continuous + interim so we can show live "lastHeard" updates
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 3;
    recognition.lang            = 'en-IN'; // works well for Indian English + global English

    recognition.onstart = () => {
      setVoiceError('');
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      // We process ALL results, not just the latest, to handle quick utterances
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result     = event.results[i];
        const transcript = result[0]?.transcript || '';

        if (result.isFinal) {
          // Final result: pass to command handler via stable ref
          commandHandlerRef.current?.(transcript);
        } else {
          // Interim: just show it in the UI as "currently hearing"
          setLastHeard(transcript.trim());
        }
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      recognitionRef.current = null;

      if (event.error === 'no-speech') {
        // This fires frequently on silence — it's normal, just restart quietly
        if (shouldResumeRef.current) scheduleRestart();
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        shouldResumeRef.current = false;
        setVoiceError('Microphone blocked. Allow mic access or choose a mode manually.');
        return;
      }

      if (event.error === 'aborted') {
        // We caused this intentionally via recognition.stop() — not an error
        return;
      }

      setVoiceError(`Voice error: ${event.error}. Tap mic to retry.`);
      if (shouldResumeRef.current) scheduleRestart();
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      // Auto-restart only if we haven't been deliberately stopped
      if (shouldResumeRef.current) scheduleRestart();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      setVoiceError('Could not start listening. Tap mic to retry.');
      return false;
    }

    return true;
  };

  // ── restartVoiceSelection ────────────────────────────────────────────────

  const restartVoiceSelection = ({ withPrompt = true } = {}) => {
    stopListening();
    setCurrentMode('SILENT');
    setIsMuted(true);
    setLastHeard('');

    if (withPrompt) {
      speak('Listening for mode selection.', true, () => {
        startListening({ announceRetry: false });
      });
    } else {
      // Small delay so any in-flight TTS doesn't collide with mic open
      setTimeout(() => startListening({ announceRetry: false }), 300);
    }
  };

  // Store in ref so commandHandlerRef can call it without stale closure
  restartRef.current = restartVoiceSelection;

  // ── launchModeSelection ──────────────────────────────────────────────────

  const launchModeSelection = () => {
    setCurrentMode('SILENT');
    setIsMuted(true);
    setLastHeard('');

    const modeLabels = Object.values(MODES)
      .filter(m => m.id !== 'SILENT')
      .map(m => m.label.replace(/\bMode\b/g, '').trim());

    playStartupSequence(modeLabels, () => {
      // Start listening only after the entire startup sequence finishes speaking
      startListening({ announceRetry: false });
    });
  };

  const handleScreenInteraction = () => restartVoiceSelection({ withPrompt: true });

  // ── keyboard shortcut ────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key.toLowerCase() === 's') handleScreenInteraction();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      stopListening();
      clearRetry();
    };
  }, []);

  return {
    isListening,
    isVoiceSupported,
    voiceError,
    lastHeard,
    startListening,
    stopListening,
    launchModeSelection,
    restartVoiceSelection,
    handleScreenInteraction,
  };
}