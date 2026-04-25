/**
 * useDrishtiAudio.js
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   The single source of truth for ALL audio output in Drishti.
 *   No other file should ever call window.speechSynthesis directly.
 *
 * RESPONSIBILITIES:
 *   1. Manage the TTS engine (speak, cancel, queue)
 *   2. Load and expose available system voices
 *   3. Persist user's voice preference to localStorage
 *   4. Decide WHEN to speak (cooldown + urgency logic)
 *   5. Export one clean announce() function for CameraView to call
 *
 * WHAT THIS HOOK DOES NOT DO:
 *   - It does not build sentences (that's audioMessages.js)
 *   - It does not handle mic input or speech recognition (that's useDrishtiVoice.jsx)
 *   - It does not know about YOLO or detection logic (that's useDrishtiAI.jsx)
 *
 * OFFLINE COMPATIBILITY:
 *   window.speechSynthesis is a browser-native API.
 *   It uses voices installed on the device/OS — no network needed.
 *   Works fully offline on Android, iOS, Windows, macOS, Linux.
 *
 * USAGE in CameraView.jsx:
 *   const audio = useDrishtiAudio(isMuted);
 *
 *   // In your detection effect:
 *   audio.announce(activeDetections, currentMode, isPathSafe);
 *
 *   // For system messages (startup, mode change):
 *   audio.speak("Normal mode activated.");
 *
 *   // For UI (voice picker):
 *   audio.availableVoices   → array of SpeechSynthesisVoice
 *   audio.selectedVoice     → currently selected voice object
 *   audio.setVoice(voice)   → persist + apply new voice
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  buildAudioMessage,
  shouldSpeak,
  isUrgentSituation,
} from '../utils/audioMessages';

// ─── CONSTANTS ────────────────────────────────────────────────────

// localStorage key where the user's voice preference is saved.
// We store the voice's `.name` property (a string) because
// SpeechSynthesisVoice objects themselves can't be serialized to JSON.
const VOICE_PREF_KEY = 'drishti_voice_name';

// How long (ms) to wait after page load before trying to read voices.
// WHY: On most browsers, speechSynthesis.getVoices() returns an empty
// array on the first call because voices load asynchronously.
// The 'voiceschanged' event fires when they're ready, but on some
// browsers (especially Chrome on Android) it fires before React has
// mounted. This small delay is a safe fallback.
const VOICE_LOAD_DELAY_MS = 300;


// ─── HOOK ─────────────────────────────────────────────────────────

/**
 * @param {boolean} isMuted - If true, all audio output is suppressed.
 *                            The hook still tracks state; it just skips
 *                            the actual speak() call when muted.
 */
export default function useDrishtiAudio(isMuted) {

  // ── State ──────────────────────────────────────────────────────
  //
  // availableVoices: the full list returned by the browser.
  //   We store all of them so the UI can show a complete picker.
  //   On desktop this is often 40–80 voices. On Android maybe 5–15.
  const [availableVoices, setAvailableVoices] = useState([]);

  // selectedVoice: the SpeechSynthesisVoice object the user has chosen.
  //   null means "use browser default" which is always the first voice.
  const [selectedVoice, setSelectedVoice] = useState(null);

  // isSpeaking: true while the TTS engine has an active utterance.
  //   Exposed so the UI can show a visual speaking indicator if needed.
  const [isSpeaking, setIsSpeaking] = useState(false);


  // ── Refs ───────────────────────────────────────────────────────
  //
  // WHY refs instead of state for these?
  //   The announce() function runs inside a requestAnimationFrame loop
  //   (via useDrishtiAI). If we read React state inside there, we'd
  //   capture stale closures — the value seen inside the loop would be
  //   frozen at the time the effect ran, not the current live value.
  //   Refs are mutable objects; reading .current always gives the
  //   latest value regardless of when the closure was created.

  // Tracks when the last announcement was spoken (Date.now() timestamp).
  // Used by shouldSpeak() to enforce per-mode cooldowns.
  const lastSpokenRef = useRef(0);

  // Mirror of isMuted as a ref so the animation loop can read it live.
  const isMutedRef = useRef(isMuted);

  // Mirror of selectedVoice as a ref for the same reason.
  const selectedVoiceRef = useRef(null);
  const lastMessageRef = useRef('');
  const candidateMessageRef = useRef('');
  const stableMessageCountRef = useRef(0);

  // The synth object itself. We grab it once and keep it in a ref.
  // WHY not just call window.speechSynthesis inline everywhere?
  //   Cleaner, and on some SSR setups window may not exist at module
  //   load time. Accessing inside useEffect is safe.
  const synthRef = useRef(null);


  // ── Sync isMuted → ref ─────────────────────────────────────────
  //
  // Every time the React state `isMuted` changes (user taps the mute
  // button in CameraView), we mirror it into the ref so the animation
  // loop sees the new value immediately without a re-render cycle.
  useEffect(() => {
    isMutedRef.current = isMuted;
    // If the user just muted, cancel whatever is currently speaking.
    if (isMuted && synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, [isMuted]);


  // ── Initialize synth + load voices ────────────────────────────
  //
  // This effect runs once on mount.
  // It sets up the synth ref and loads available voices.
  //
  // VOICE LOADING FLOW:
  //   1. Immediately try getVoices() — may or may not have results yet.
  //   2. Listen for the 'voiceschanged' event which fires when voices
  //      are fully loaded. This is the reliable moment.
  //   3. In loadVoices(), restore the user's saved preference if any.
  //
  // IMPORTANT: On iOS Safari, 'voiceschanged' never fires reliably.
  //   The VOICE_LOAD_DELAY_MS fallback handles that.

  useEffect(() => {
    const synth = window.speechSynthesis;
    synthRef.current = synth;

    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices.length === 0) return; // Not ready yet, wait for event

      setAvailableVoices(voices);

      // Restore saved preference
      // We saved the voice NAME (a string) to localStorage.
      // Now we find the matching SpeechSynthesisVoice object from
      // the freshly loaded voices array.
      const savedName = localStorage.getItem(VOICE_PREF_KEY);
      if (savedName) {
        const match = voices.find(v => v.name === savedName);
        if (match) {
          setSelectedVoice(match);
          selectedVoiceRef.current = match;
        }
      }
    };

    // Try immediately (works in Firefox, some versions of Chrome)
    loadVoices();

    // Listen for the reliable async event
    synth.addEventListener('voiceschanged', loadVoices);

    // iOS Safari fallback
    const fallbackTimer = setTimeout(loadVoices, VOICE_LOAD_DELAY_MS);

    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      clearTimeout(fallbackTimer);
      // Cancel any ongoing speech when component unmounts
      // (e.g. user navigates away from the camera page)
      synth.cancel();
    };
  }, []);


  // ─── CORE: speak() ────────────────────────────────────────────
  //
  // This is the ONLY place in the entire app that calls synth.speak().
  //
  // PARAMETERS:
  //   text       - The string to speak
  //   interrupt  - If true, cancel current speech before speaking.
  //                Use for urgent alerts. Default false for queuing.
  //   onEnd      - Optional callback fired when the utterance finishes.
  //                Used by the startup sequence to chain sentences.
  //
  // RATE & PITCH:
  //   rate: 1.05 — slightly faster than default (1.0) so information
  //   comes through quickly without sounding rushed. Visually impaired
  //   users who use screen readers are often accustomed to faster speech.
  //   You can expose this as a user preference later.
  //
  //   pitch: 1.0 — natural. Changing pitch changes the voice character
  //   and can make it harder to understand. Leave at default unless the
  //   user explicitly requests it.
  //
  // VOLUME:
  //   We use 1.0 (maximum). The user controls device volume externally.
  //   Do not reduce volume in software — visually impaired users in
  //   noisy environments need maximum clarity.

  const speak = useCallback((text, interrupt = false, onEnd = null) => {
    const synth = synthRef.current;
    if (!synth) return false;

    // Never speak when muted — but still allow system messages
    // (startup sequence, mode announcements) to pass through.
    // Those callers set interrupt=true to signal they're intentional.
    // Regular detection announcements leave interrupt=false.
    // We block only the non-interrupt ones when muted.
    if (isMutedRef.current && !interrupt) return false;

    if (interrupt) {
      synth.cancel();
      setIsSpeaking(false);
    }

    // Detection updates should never pile up in the browser queue.
    // If something is already speaking, we skip this non-urgent line
    // and wait for the next inference cycle to produce a fresher message.
    if (!interrupt && (synth.speaking || synth.pending)) {
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Apply selected voice if user has picked one
    // selectedVoiceRef.current is null → browser uses its default
    if (selectedVoiceRef.current) {
      utterance.voice = selectedVoiceRef.current;
      // IMPORTANT: also set lang to match the voice
      // Without this, some browsers ignore the voice setting
      utterance.lang = selectedVoiceRef.current.lang;
    }

    utterance.rate   = 1.05;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => {
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };
    utterance.onerror = (e) => {
      // 'interrupted' is not a real error — it means synth.cancel() was called
      // Don't log it as an error; it's expected when we interrupt.
      if (e.error !== 'interrupted') {
        console.warn('[Drishti Audio] Speech error:', e.error);
      }
      setIsSpeaking(false);
    };

    synth.speak(utterance);
    return true;
  }, []); // No deps — everything is accessed via refs


  // ─── CORE: announce() ─────────────────────────────────────────
  //
  // This is what CameraView calls every time activeDetections changes.
  //
  // FLOW:
  //   1. Check mute state — bail early if muted
  //   2. Determine if the situation is urgent (needs to interrupt)
  //   3. Check cooldown — bail if not enough time has passed
  //      UNLESS it's urgent, in which case we skip the cooldown
  //   4. Build the message string using audioMessages.js
  //   5. Speak it
  //
  // WHY cooldown is bypassed for urgent situations:
  //   Imagine the user is walking. NORMAL mode is cooldown=3s.
  //   At t=0s we say "chair to your left".
  //   At t=1s a car suddenly appears very close ahead.
  //   We should NOT wait until t=3s to warn them.
  //   isUrgentSituation() catches this and we interrupt immediately.

  const announce = useCallback((detections, mode, isPathSafe = true) => {
    // Muted — never announce detections (system messages still work
    // because they call speak() directly with interrupt=true)
    if (isMutedRef.current) return '';

    // Silent mode — no audio
    if (mode === 'SILENT') return '';

    const urgent = isUrgentSituation(detections, mode, isPathSafe);

    // Check cooldown — skip if urgent
    if (!urgent && !shouldSpeak(mode, lastSpokenRef.current)) return '';

    // Build the natural language message
    const message = buildAudioMessage(detections, mode, isPathSafe);

    // Nothing to say (empty detections in non-pathfinder mode, etc.)
    if (!message || message.trim() === '') return '';

    if (!urgent) {
      if (candidateMessageRef.current === message) {
        stableMessageCountRef.current += 1;
      } else {
        candidateMessageRef.current = message;
        stableMessageCountRef.current = 1;
      }

      // Require the scene summary to repeat once before announcing it.
      // This reduces noisy frame-to-frame changes from interrupting the user.
      if (stableMessageCountRef.current < 2) {
        return '';
      }
    } else {
      candidateMessageRef.current = message;
      stableMessageCountRef.current = 2;
    }

    // Avoid repeating the exact same sentence back to back in the loop.
    if (!urgent && lastMessageRef.current === message && !shouldSpeak(mode, lastSpokenRef.current)) {
      return '';
    }

    // Update the last spoken timestamp BEFORE speaking
    // WHY before? If we update after, and speak() is async, another
    // announce() call could slip in between and double-speak.
    lastSpokenRef.current = Date.now();
    lastMessageRef.current = message;

    // Speak — interrupt if urgent so we don't wait for current sentence to end
    const didSpeak = speak(message, urgent);
    return didSpeak ? message : '';

  }, [speak]); // speak is stable (useCallback with no deps)


  // ─── VOICE SELECTION ──────────────────────────────────────────
  //
  // setVoice() is called from the voice picker UI (in Profile or a
  // settings panel). It does three things:
  //   1. Updates React state (re-renders the picker to show selection)
  //   2. Updates the ref (so speak() uses the new voice immediately)
  //   3. Saves to localStorage (persists across app restarts)
  //
  // VOICE CATEGORIES:
  //   We expose helper arrays so the UI can group voices into
  //   "Female", "Male", and by language — making the picker usable.
  //   The browser gives us voice.name strings like:
  //     "Google हिन्दी"  (Hindi, likely female)
  //     "Microsoft David - English (United States)"  (male)
  //     "Samantha"  (macOS female)
  //   There is NO official gender field in the Web Speech API.
  //   We infer gender from common naming conventions — imperfect but
  //   the only offline option available.

  const setVoice = useCallback((voice) => {
    setSelectedVoice(voice);
    selectedVoiceRef.current = voice;
    if (voice) {
      localStorage.setItem(VOICE_PREF_KEY, voice.name);
    } else {
      localStorage.removeItem(VOICE_PREF_KEY);
    }
    // Confirm the change with a short spoken sample
    // We speak it with interrupt=true so it plays immediately
    const synth = synthRef.current;
    if (synth) {
      synth.cancel();
      const sample = new SpeechSynthesisUtterance("Voice updated.");
      if (voice) {
        sample.voice = voice;
        sample.lang  = voice.lang;
      }
      sample.rate = 1.05;
      synth.speak(sample);
    }
  }, []);

  // Reset to browser default
  const resetVoice = useCallback(() => {
    setSelectedVoice(null);
    selectedVoiceRef.current = null;
    localStorage.removeItem(VOICE_PREF_KEY);
  }, []);


  // ─── VOICE HELPERS FOR UI ─────────────────────────────────────
  //
  // These are derived values — computed from availableVoices.
  // They don't need to be state; they're just filtered/mapped arrays.
  //
  // GENDER INFERENCE:
  //   We look for common male names in the voice.name string.
  //   Everything that doesn't match a known male pattern we call female
  //   (or neutral). This is a heuristic, not a guarantee.
  //   Example male names across OS voice libraries:
  //     David, Mark, Daniel, Thomas, Jorge, Luca, Reed, Rishi, Aaron
  //
  // LANGUAGE GROUPING:
  //   voice.lang is a BCP-47 tag like "en-US", "hi-IN", "fr-FR".
  //   We extract the base language ("en", "hi", "fr") for grouping.

  const MALE_VOICE_KEYWORDS = [
    'david', 'mark', 'daniel', 'thomas', 'jorge', 'luca', 'reed',
    'rishi', 'aaron', 'fred', 'ralph', 'albert', 'bruce', 'junior',
    'microsoft david', 'microsoft mark', 'google uk english male',
    'ravi', 'hemant', 'kalpana', // Common Indian TTS male names
  ];

  const inferGender = (voice) => {
    const nameLower = voice.name.toLowerCase();
    return MALE_VOICE_KEYWORDS.some(kw => nameLower.includes(kw))
      ? 'male'
      : 'female';
  };

  // Voices grouped by language then gender — ready for a picker UI
  const voicesByLanguage = availableVoices.reduce((acc, voice) => {
    const lang = voice.lang.split('-')[0]; // "en-US" → "en"
    if (!acc[lang]) acc[lang] = { male: [], female: [] };
    acc[lang][inferGender(voice)].push(voice);
    return acc;
  }, {});

  // Flat arrays for simpler UIs (just show all female or all male)
  const femaleVoices = availableVoices.filter(v => inferGender(v) === 'female');
  const maleVoices   = availableVoices.filter(v => inferGender(v) === 'male');


  // ─── STARTUP SEQUENCE ─────────────────────────────────────────
  //
  // The startup sequence needs to speak multiple sentences in order,
  // each one starting only after the previous one finishes.
  //
  // WHY is this here and not in useDrishtiVoice?
  //   useDrishtiVoice handles MIC INPUT (speech recognition).
  //   useDrishtiAudio handles AUDIO OUTPUT (speech synthesis).
  //   The startup sequence is output — it belongs here.
  //   useDrishtiVoice can call audio.playStartupSequence() when ready.
  //
  // HOW CHAINING WORKS:
  //   speak(text, interrupt, onEnd) accepts an onEnd callback.
  //   We chain calls: speak sentence 1 → onEnd → speak sentence 2 → etc.
  //   This is more reliable than setTimeout() delays because it waits
  //   for actual speech completion, not an estimated duration.

  const playStartupSequence = useCallback((modeLabels, onComplete) => {
    // Speak sentences in order using recursive chaining
    const chain = (sentences, index = 0) => {
      if (index >= sentences.length) {
        if (onComplete) onComplete();
        return;
      }
      // First sentence interrupts anything playing; rest queue up
      speak(sentences[index], index === 0, () => chain(sentences, index + 1));
    };

    const sentences = [
      "Drishti is ready. Camera and microphone are active.",
      "Please say the name of a mode to begin.",
      `Available modes are: ${modeLabels.join(', ')}.`,
    ];

    chain(sentences);
  }, [speak]);


  // ─── RETURN ───────────────────────────────────────────────────
  //
  // We expose only what callers need:
  //
  //   announce()          → CameraView detection loop
  //   speak()             → CameraView/useDrishtiVoice for system messages
  //   playStartupSequence() → useDrishtiVoice when camera is ready
  //   isSpeaking          → UI (show a waveform indicator, etc.)
  //   availableVoices     → Voice picker in Profile/Settings
  //   selectedVoice       → Voice picker to show current selection
  //   setVoice()          → Voice picker on selection
  //   resetVoice()        → Voice picker "reset to default" button
  //   voicesByLanguage    → Grouped picker UI
  //   femaleVoices        → Simple gender picker
  //   maleVoices          → Simple gender picker

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
