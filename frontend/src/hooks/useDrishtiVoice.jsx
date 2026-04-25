import { useEffect, useMemo, useRef, useState } from 'react';
import { MODES } from '../components/DrishtiConstants';

const MODE_ALIASES = {
  NORMAL: ['normal', 'regular', 'default'],
  HOME: ['home', 'indoor', 'house'],
  OUTDOOR: ['outdoor', 'outside', 'street', 'travel'],
  SHOPPING: ['shopping', 'shop', 'store', 'market'],
  SOCIAL: ['social', 'people', 'friends'],
  PATHFINDER: ['pathfinder', 'path', 'navigation', 'navigate'],
  EMERGENCY: ['emergency', 'danger', 'alert', 'help'],
  SILENT: ['silent', 'mute', 'stop', 'pause'],
};

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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
}) {
  const recognitionRef = useRef(null);
  const shouldResumeListeningRef = useRef(false);
  const retryTimeoutRef = useRef(null);

  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [lastHeard, setLastHeard] = useState('');

  const isVoiceSupported = useMemo(() => Boolean(getSpeechRecognitionConstructor()), []);

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const stopListening = () => {
    shouldResumeListeningRef.current = false;
    clearRetryTimeout();

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setIsListening(false);
  };

  const activateMode = (modeKey) => {
    const nextMode = MODES[modeKey] ? modeKey : 'NORMAL';
    const label = MODES[nextMode]?.label || nextMode;

    shouldResumeListeningRef.current = false;
    clearRetryTimeout();
    setVoiceError('');
    setCurrentMode(nextMode);
    setIsMuted(nextMode === 'SILENT');
    stopListening();
    speak(`${label} activated.`, true);

    if (onModeActivated) {
      onModeActivated(nextMode);
    }
  };

  const resolveModeFromTranscript = (transcript) => {
    const normalized = normalizeTranscript(transcript);
    if (!normalized) return null;

    for (const [modeKey, aliases] of Object.entries(MODE_ALIASES)) {
      if (aliases.some((alias) => normalized.includes(alias))) {
        return modeKey;
      }
    }

    for (const [modeKey, mode] of Object.entries(MODES)) {
      const modeName = normalizeTranscript(mode.label);
      if (modeName && normalized.includes(modeName)) {
        return modeKey;
      }
    }

    return null;
  };

  const handleVoiceCommand = (transcript) => {
    const normalized = normalizeTranscript(transcript);
    if (!normalized) return;

    setLastHeard(transcript.trim());

    if (normalized.includes('help') || normalized.includes('what can i say')) {
      speak('You can say normal, home, outdoor, shopping, social, pathfinder, emergency, silent, mute, unmute, or restart.', true);
      return;
    }

    if (normalized.includes('restart') || normalized.includes('start again')) {
      if (onRestartSelection) {
        onRestartSelection();
      } else {
        restartVoiceSelection({ withPrompt: true });
      }
      return;
    }

    if (normalized.includes('unmute') || normalized.includes('resume voice')) {
      if (onToggleMute) {
        onToggleMute(false, true);
      }
      speak('Narration resumed.', true);
      return;
    }

    if (
      normalized.includes('mute') ||
      normalized.includes('quiet') ||
      normalized.includes('stop speaking')
    ) {
      if (onToggleMute) {
        onToggleMute(true, true);
      }
      speak('Narration muted. Say unmute to hear updates again.', true);
      return;
    }

    const modeKey = resolveModeFromTranscript(normalized);
    if (modeKey) {
      activateMode(modeKey);
      return;
    }

    speak('Mode not recognized. Say normal, home, outdoor, shopping, social, pathfinder, emergency, or silent.', true);
  };

  const scheduleRestart = () => {
    clearRetryTimeout();
    retryTimeoutRef.current = setTimeout(() => {
      if (shouldResumeListeningRef.current) {
        startListening({ announceRetry: false });
      }
    }, 800);
  };

  const startListening = ({ announceRetry = true } = {}) => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      setVoiceError('Voice commands are not supported in this browser. Use the mode buttons below.');
      return false;
    }

    if (recognitionRef.current || isListening) {
      return true;
    }

    clearRetryTimeout();
    shouldResumeListeningRef.current = true;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVoiceError('');
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const latestResult = event.results[event.results.length - 1];
        const transcript = latestResult?.[0]?.transcript || '';
        if (latestResult?.isFinal) {
          handleVoiceCommand(transcript);
        } else {
          setLastHeard(transcript.trim());
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);

        if (event.error === 'no-speech') {
          setVoiceError('Listening again. Say a mode name when you are ready.');
          if (announceRetry) {
            speak('I did not hear anything. Please say a mode name.', true);
          }
          scheduleRestart();
          return;
        }

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          shouldResumeListeningRef.current = false;
          setVoiceError('Microphone access is blocked. Allow mic access or choose a mode manually.');
          return;
        }

        setVoiceError('Voice control paused. Tap the microphone button to try again.');
        scheduleRestart();
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
        if (shouldResumeListeningRef.current) {
          scheduleRestart();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      return true;
    } catch (error) {
      recognitionRef.current = null;
      setIsListening(false);
      setVoiceError('Voice control could not start. Tap the microphone button to try again.');
      return false;
    }
  };

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
      startListening({ announceRetry: false });
    }
  };

  const launchModeSelection = () => {
    setCurrentMode('SILENT');
    setIsMuted(true);
    setLastHeard('');

    playStartupSequence(
      Object.values(MODES)
        .filter((mode) => mode.id !== 'SILENT')
        .map((mode) => mode.label.replace(/\bMode\b/g, '').trim()),
      () => {
        startListening({ announceRetry: false });
      }
    );
  };

  const handleScreenInteraction = () => {
    restartVoiceSelection({ withPrompt: true });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() !== 's') return;
      handleScreenInteraction();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stopListening();
      clearRetryTimeout();
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
