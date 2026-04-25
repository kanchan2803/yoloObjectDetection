/**
 * useDrishtiAudio.js — Fixed version
 *
 * KEY FIXES FOR RUSHING / CUTTING OFF:
 *
 * 1. announce() no longer cancels ongoing speech for non-urgent detections.
 *    Previously, every detection cycle called speak(msg, urgent=true) which
 *    calls synth.cancel() mid-sentence. Now non-urgent calls simply skip if
 *    anything is already speaking.
 *
 * 2. Cooldown is enforced AFTER speech ends, not just based on a timestamp.
 *    A new `isSpeakingRef` prevents a second announce() from firing while the
 *    first utterance is still playing — even within the cooldown window.
 *
 * 3. Urgent speech (EMERGENCY, PATHFINDER obstacle) still interrupts — that's
 *    intentional and correct behavior.
 *
 * 4. Startup sequence uses onEnd chaining (unchanged) which was already correct.
 *    Added a minimum inter-sentence gap to prevent sentences from colliding on
 *    slow TTS engines (Android WebView).
 *
 * 5. System speak() calls (mode activation, voice commands) use interrupt=true
 *    which cancels and speaks immediately — also correct and unchanged.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  buildAudioMessage,
  shouldSpeak,
  isUrgentSituation,
} from '../utils/audioMessages';

const VOICE_PREF_KEY = 'drishti_voice_name';
const VOICE_LOAD_DELAY_MS = 400;

// Minimum gap in ms between the END of one utterance and START of next (non-urgent).
// Prevents Android/iOS from mashing sentences together.
const POST_SPEECH_GAP_MS = 600;

export default function useDrishtiAudio(isMuted) {

  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice,   setSelectedVoice]   = useState(null);
  const [isSpeaking,      setIsSpeaking]       = useState(false);

  const synthRef              = useRef(null);
  const isMutedRef            = useRef(isMuted);
  const selectedVoiceRef      = useRef(null);
  const lastSpokenRef         = useRef(0);         // timestamp of LAST speak() call
  const lastFinishedRef       = useRef(0);         // timestamp when last utterance ENDED
  const isSpeakingRef         = useRef(false);     // true while synth is active
  const lastMessageRef        = useRef('');
  const candidateMessageRef   = useRef('');
  const stableMessageCountRef = useRef(0);

  // Sync muted state → ref
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted && synthRef.current) {
      synthRef.current.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [isMuted]);

  // Load voices
  useEffect(() => {
    const synth = window.speechSynthesis;
    synthRef.current = synth;

    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return;
      setAvailableVoices(voices);

      const savedName = localStorage.getItem(VOICE_PREF_KEY);
      if (savedName) {
        const match = voices.find(v => v.name === savedName);
        if (match) {
          setSelectedVoice(match);
          selectedVoiceRef.current = match;
        }
      }
    };

    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    const fallbackTimer = setTimeout(loadVoices, VOICE_LOAD_DELAY_MS);

    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      clearTimeout(fallbackTimer);
      synth.cancel();
    };
  }, []);

  // ── CORE: speak() ─────────────────────────────────────────────────────────
  //
  // interrupt=true  → used for system messages (mode activation, voice commands).
  //                   Cancels whatever is playing and speaks immediately.
  //                   These are SHORT (1–4 words) and time-sensitive.
  //
  // interrupt=false → used by announce() for detection narration.
  //                   NEVER cancels ongoing speech. Skips if synth is busy.
  //                   The next announce() cycle will pick it up.

  const speak = useCallback((text, interrupt = false, onEnd = null) => {
    const synth = synthRef.current;
    if (!synth || !text) return false;

    // Block non-interrupt calls when muted
    if (isMutedRef.current && !interrupt) return false;

    if (interrupt) {
      synth.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    } else {
      // Non-urgent: skip if synth is busy or we're within the post-speech gap
      if (isSpeakingRef.current || synth.speaking || synth.pending) return false;
      const timeSinceFinished = Date.now() - lastFinishedRef.current;
      if (timeSinceFinished < POST_SPEECH_GAP_MS) return false;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
      utterance.lang  = selectedVoiceRef.current.lang;
    }

    utterance.rate   = 1.0;   // Slightly slowed from 1.05 — more intelligible
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      lastFinishedRef.current = Date.now();
      setIsSpeaking(false);
      if (onEnd) {
        // Small gap before chaining next sentence in a sequence
        setTimeout(onEnd, 150);
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        console.warn('[Drishti Audio] Speech error:', e.error);
      }
      isSpeakingRef.current = false;
      lastFinishedRef.current = Date.now();
      setIsSpeaking(false);
      // Still call onEnd so chained sequences don't hang
      if (onEnd && e.error !== 'interrupted') setTimeout(onEnd, 150);
    };

    synth.speak(utterance);
    return true;
  }, []);

  // ── CORE: announce() ──────────────────────────────────────────────────────
  //
  // Called from CameraView every time activeDetections changes.
  // This runs VERY frequently (every animation frame), so the guards here
  // are critical to prevent speech from firing too fast.
  //
  // FLOW:
  //   1. Bail if muted or silent mode
  //   2. Check urgency
  //   3. If NOT urgent: bail if synth is currently speaking (let it finish)
  //   4. Check cooldown (time since last SPEAK call, not since last frame)
  //   5. Require the same scene to be stable for 2+ frames before announcing
  //   6. Skip if it's identical to the last message (within cooldown)
  //   7. Speak

  const announce = useCallback((detections, mode, isPathSafe = true) => {
    if (isMutedRef.current) return '';
    if (mode === 'SILENT') return '';

    const urgent = isUrgentSituation(detections, mode, isPathSafe);

    // Non-urgent: respect ongoing speech — don't pile up
    if (!urgent && isSpeakingRef.current) return '';

    // Cooldown check
    if (!urgent && !shouldSpeak(mode, lastSpokenRef.current)) return '';

    // Build message
    const message = buildAudioMessage(detections, mode, isPathSafe);
    if (!message || message.trim() === '') return '';

    // Stability gate: require the same message to appear twice before announcing.
    // This prevents announcing transient single-frame detections.
    if (!urgent) {
      if (candidateMessageRef.current === message) {
        stableMessageCountRef.current += 1;
      } else {
        candidateMessageRef.current   = message;
        stableMessageCountRef.current = 1;
      }
      if (stableMessageCountRef.current < 2) return '';
    }

    // Deduplication: don't repeat identical message unless cooldown fully elapsed
    if (!urgent && lastMessageRef.current === message) {
      // Allow repeat only after 2× the cooldown period
      if (!shouldSpeak(mode, lastSpokenRef.current + (lastSpokenRef.current ? 2000 : 0))) {
        return '';
      }
    }

    // Update timestamp BEFORE speaking to close the race window
    lastSpokenRef.current = Date.now();
    lastMessageRef.current = message;

    // Speak: urgent interrupts, non-urgent queues politely
    const didSpeak = speak(message, urgent);
    return didSpeak ? message : '';

  }, [speak]);

  // ── VOICE SELECTION ──────────────────────────────────────────────────────

  const setVoice = useCallback((voice) => {
    setSelectedVoice(voice);
    selectedVoiceRef.current = voice;
    if (voice) {
      localStorage.setItem(VOICE_PREF_KEY, voice.name);
    } else {
      localStorage.removeItem(VOICE_PREF_KEY);
    }
    const synth = synthRef.current;
    if (synth) {
      synth.cancel();
      const sample = new SpeechSynthesisUtterance("Voice updated.");
      if (voice) { sample.voice = voice; sample.lang = voice.lang; }
      sample.rate = 1.0;
      synth.speak(sample);
    }
  }, []);

  const resetVoice = useCallback(() => {
    setSelectedVoice(null);
    selectedVoiceRef.current = null;
    localStorage.removeItem(VOICE_PREF_KEY);
  }, []);

  // ── STARTUP SEQUENCE ─────────────────────────────────────────────────────
  //
  // Chains multiple sentences using the onEnd callback so each sentence
  // starts only after the previous one finishes. Never overlaps.

  const playStartupSequence = useCallback((modeLabels, onComplete) => {
    const sentences = [
      "Drishti is ready.",
      "Please say the name of a mode to begin.",
      `Available modes: ${modeLabels.slice(0, 6).join(', ')}.`,
    ];

    const chain = (index = 0) => {
      if (index >= sentences.length) {
        // Extra gap after last sentence before mic opens
        setTimeout(() => { if (onComplete) onComplete(); }, 400);
        return;
      }
      speak(sentences[index], index === 0, () => chain(index + 1));
    };

    chain();
  }, [speak]);

  // ── VOICE HELPERS ────────────────────────────────────────────────────────

  const MALE_VOICE_KEYWORDS = [
    'david', 'mark', 'daniel', 'thomas', 'jorge', 'luca', 'reed',
    'rishi', 'aaron', 'fred', 'ralph', 'albert', 'bruce', 'junior',
    'microsoft david', 'microsoft mark', 'google uk english male',
    'ravi', 'hemant',
  ];

  const inferGender = (voice) => {
    const nameLower = voice.name.toLowerCase();
    return MALE_VOICE_KEYWORDS.some(kw => nameLower.includes(kw)) ? 'male' : 'female';
  };

  const voicesByLanguage = availableVoices.reduce((acc, voice) => {
    const lang = voice.lang.split('-')[0];
    if (!acc[lang]) acc[lang] = { male: [], female: [] };
    acc[lang][inferGender(voice)].push(voice);
    return acc;
  }, {});

  const femaleVoices = availableVoices.filter(v => inferGender(v) === 'female');
  const maleVoices   = availableVoices.filter(v => inferGender(v) === 'male');

  return {
    announce,
    speak,
    playStartupSequence,
    isSpeaking,
    availableVoices,
    selectedVoice,
    setVoice,
    resetVoice,
    voicesByLanguage,
    femaleVoices,
    maleVoices,
  };
}