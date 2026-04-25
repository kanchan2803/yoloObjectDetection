import { useEffect, useRef, useState } from 'react';
import { MODES } from '../components/DrishtiConstants';

export default function useDrishtiVoice(currentMode, setCurrentMode, isMuted, setIsMuted, onModeActivated) {
  const recognitionRef = useRef(null);
  const synth = window.speechSynthesis;
  const [isListening, setIsListening] = useState(false);

  // 1. Core Speech Function with Callback
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechQueue = useRef([]);

  // // 1. Core Speech Function with Queuing Logic
  // const speak = (text, interrupt = false, onEndCallback = null) => {
  //   if (interrupt) {
  //     synth.cancel();
  //     speechQueue.current = []; // Clear queue on priority interrupt
  //     setIsSpeaking(false);
  //   }

  //   // Add message to queue
  //   speechQueue.current.push({ text, onEndCallback });

  //   const processQueue = () => {
  //     if (speechQueue.current.length === 0 || synth.speaking) return;

  //     const nextItem = speechQueue.current.shift();
  //     const utterance = new SpeechSynthesisUtterance(nextItem.text);
  //     utterance.rate = 1.1;
  //     utterance.pitch = 1.0;

  //     utterance.onstart = () => setIsSpeaking(true);
      
  //     utterance.onend = () => {
  //       setIsSpeaking(false);
  //       if (nextItem.onEndCallback) nextItem.onEndCallback();
  //       setTimeout(processQueue, 150);
  //     };

  //     utterance.onerror = () => setIsSpeaking(false);
  //     synth.speak(utterance);
  //   };

  //   processQueue();
  // };

  const speak = (text, interrupt = true, onEndCallback = null) => {
    if (interrupt) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    
    if (onEndCallback) {
      utterance.onend = onEndCallback;
    }
    
    synth.speak(utterance);
    return utterance;
  };

  // 2. Modified Startup Sequence
  const playStartupSequence = async () => {
    const speakReady = (msg) => new Promise(resolve => speak(msg, true, resolve));
    const speakNext = (msg) => new Promise(resolve => speak(msg, false, resolve));

    await speakReady("Hi, this is Drishti. Camera and microphone active.");
    await speakNext("Choose a mode. Available options are:");
    
    for (const modeKey of Object.keys(MODES)) {
      if (modeKey === "SILENT") continue;
      await speakNext(MODES[modeKey].label);
    }
    
    speak("Speak the name of a mode now.", false, () => {
        startListening();
    });
  };

  // 3. Voice Command Handler
  const handleVoiceCommand = (transcript) => {
    const command = transcript.toLowerCase();
    for (const [key, mode] of Object.entries(MODES)) {
      if (command.includes(mode.label.toLowerCase()) || command.includes(key.toLowerCase())) {
        activateMode(key);
        return;
      }
    }
  };

  // Helper to unify activation logic
  const activateMode = (key) => {
    setCurrentMode(key);
    const label = MODES[key]?.label || key;
    speak(`${label} activated. System starting.`);
    setIsMuted(key === "SILENT");
    stopListening();
    if (onModeActivated) onModeActivated();
  };

  // 4. Recognition Lifecycle
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || isListening) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      handleVoiceCommand(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // 5. NEW: Keyboard Listener for 'S' key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 's') {
        // Force system into Silent mode state
        setCurrentMode("SILENT");
        setIsMuted(true);
        synth.cancel();
        speak("Silent mode activated. Listening for new mode.", true, () => {
          startListening();
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeActivated]); // Dependencies ensure fresh callback access

  // 6. UPDATED: Interaction logic (Now triggers state change)
  const handleScreenInteraction = () => {
    // Stop everything and prepare for new command
    setCurrentMode("SILENT");
    setIsMuted(true);
    speak("System paused. Listening for command.", true, () => {
      startListening();
    });
  };

  return { speak, playStartupSequence, handleScreenInteraction, isListening, stopListening };
}

// import { useEffect, useRef, useState } from 'react';
// import { MODES } from '../components/DrishtiConstants';

// export default function useDrishtiVoice(currentMode, setCurrentMode, isMuted, setIsMuted, onModeActivated) {
//   const recognitionRef = useRef(null);
//   const synth = window.speechSynthesis;
//   const [isListening, setIsListening] = useState(false);

//   // 1. Core Speech Function with Callback
//   const speak = (text, interrupt = true, onEndCallback = null) => {
//     if (interrupt) synth.cancel();
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.rate = 1.1;
//     utterance.pitch = 1.0;
    
//     if (onEndCallback) {
//       utterance.onend = onEndCallback;
//     }
    
//     synth.speak(utterance);
//     return utterance;
//   };

//   // 2. Modified Startup Sequence
//   const playStartupSequence = async () => {
//     // We use promises to ensure one sentence finishes before the next starts
//     const speakReady = (msg) => new Promise(resolve => speak(msg, true, resolve));
//     const speakNext = (msg) => new Promise(resolve => speak(msg, false, resolve));

//     await speakReady("Hi, this is Drishti. Camera and microphone active.");
//     await speakNext("Choose a mode. Available options are:");
    
//     for (const modeKey of Object.keys(MODES)) {
//       if (modeKey === "SILENT") continue;
//       await speakNext(MODES[modeKey].label);
//     }
    
//     speak("Speak the name of a mode now.", false, () => {
//         startListening();
//     });
//   };

//   const handleVoiceCommand = (transcript) => {
//     const command = transcript.toLowerCase();
//     for (const [key, mode] of Object.entries(MODES)) {
//       if (command.includes(mode.label.toLowerCase()) || command.includes(key.toLowerCase())) {
//         setCurrentMode(key);
//         speak(`${mode.label} activated. System starting.`);
//         setIsMuted(key === "SILENT");
//         stopListening();
//         if (onModeActivated) onModeActivated(); // Notify CameraView to start inference
//         return;
//       }
//     }
//   };

//   const startListening = () => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (!SpeechRecognition || isListening) return;
//     const recognition = new SpeechRecognition();
//     recognition.continuous = true;
//     recognition.lang = 'en-US';
//     recognition.onstart = () => setIsListening(true);
//     recognition.onresult = (event) => {
//       const transcript = event.results[event.results.length - 1][0].transcript;
//       handleVoiceCommand(transcript);
//     };
//     recognition.onend = () => setIsListening(false);
//     recognitionRef.current = recognition;
//     recognition.start();
//   };

//   const stopListening = () => {
//     if (recognitionRef.current) recognitionRef.current.stop();
//   };

//   const handleScreenInteraction = () => {
//     speak("System paused. Listening for command.", true, startListening);
//   };

//   return { speak, playStartupSequence, handleScreenInteraction, isListening, stopListening };
// }

// import { useEffect, useRef, useState } from 'react';
// import { MODES } from '../components/DrishtiConstants';

// export default function useDrishtiVoice(currentMode, setCurrentMode, isMuted, setIsMuted) {
//   const recognitionRef = useRef(null);
//   const synth = window.speechSynthesis;
//   const [isListening, setIsListening] = useState(false);

//   // 1. Core Speech Function
//   const speak = (text, interrupt = true) => {
//     if (interrupt) synth.cancel();
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.rate = 1.1;
//     utterance.pitch = 1.0;
//     synth.speak(utterance);
//     return utterance;
//   };

//   // 2. The Startup Sequence (Greeting + Mode List)
//   const playStartupSequence = async () => {
//     speak("Hi, this is Drishti. Camera and microphone active.");
    
//     // Small delay to let the user settle
//     await new Promise(r => setTimeout(r, 2500));
    
//     speak("Choose a mode. Available options are:");
    
//     // Announce each mode clearly
//     for (const modeKey of Object.keys(MODES)) {
//       if (modeKey === "SILENT") continue;
//       speak(MODES[modeKey].label, false);
//       await new Promise(r => setTimeout(r, 1200));
//     }
    
//     speak("Speak the name of a mode now.");
//     startListening();
//   };

//   // 3. Command Handler
//   const handleVoiceCommand = (transcript) => {
//     const command = transcript.toLowerCase();
//     console.log("Drishti Heard:", command);

//     for (const [key, mode] of Object.entries(MODES)) {
//       if (command.includes(mode.label.toLowerCase()) || command.includes(key.toLowerCase())) {
//         setCurrentMode(key);
//         speak(`${mode.label} activated. System starting.`);
        
//         if (key === "SILENT") setIsMuted(true);
//         else setIsMuted(false);
        
//         stopListening();
//         return;
//       }
//     }

//     if (command.includes("stop") || command.includes("silent")) {
//       setCurrentMode("SILENT");
//       setIsMuted(true);
//       speak("Silent mode activated.");
//     }
//   };

//   // 4. Recognition Lifecycle
//   const startListening = () => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (!SpeechRecognition || isListening) return;

//     const recognition = new SpeechRecognition();
//     recognition.continuous = true;
//     recognition.interimResults = false;
//     recognition.lang = 'en-US';

//     recognition.onstart = () => setIsListening(true);
//     recognition.onresult = (event) => {
//       const transcript = event.results[event.results.length - 1][0].transcript;
//       handleVoiceCommand(transcript);
//     };
//     recognition.onend = () => setIsListening(false);

//     recognitionRef.current = recognition;
//     recognition.start();
//   };

//   const stopListening = () => {
//     if (recognitionRef.current) {
//       recognitionRef.current.stop();
//     }
//   };

//   // 5. Interaction Listeners (Keyboard + Double Tap)
//   useEffect(() => {
//     const handleKeyDown = (e) => {
//       if (e.key.toLowerCase() === 's') {
//         setCurrentMode("SILENT");
//         setIsMuted(true);
//         speak("Silent mode activated. Listening for new mode.");
//         startListening();
//       }
//     };

//     window.addEventListener('keydown', handleKeyDown);
//     return () => window.removeEventListener('keydown', handleKeyDown);
//   }, []);

//   const handleScreenInteraction = () => {
//     // This is called by the double-tap logic in the main view
//     speak("System paused. Listening for command.");
//     startListening();
//   };

//   return { speak, playStartupSequence, handleScreenInteraction, isListening };
// }