import { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { MODES, COCO_CLASSES } from '../components/DrishtiConstants';
import { processDetections } from '../utils/DrishtiLogic';
import useCustomObjects from './useCustomObjects';

export default function useDrishtiAI(videoRef, speak, lastSpokenRef) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [fps, setFps] = useState(0);
  const [activeDetections, setActiveDetections] = useState([]);
  const [isPathSafe, setIsPathSafe] = useState(true);
  const [confidence, setConfidence] = useState(0);

  const { customObjects, matchCrop } = useCustomObjects();
  
  const modelRef = useRef(null);
  const lastTime = useRef(Date.now());
  const requestRef = useRef();

  // 1. Initialize Neural Engine
  useEffect(() => {
    const initEngine = async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        
        // Ensure the model path is correct for your project structure
        const model = await tf.loadGraphModel('/yolo11n_web_model/model.json');
        modelRef.current = model;
        setIsModelLoaded(true);
        console.log("Drishti Neural Engine: Online (High Sensitivity)");
      } catch (err) {
        console.error("Neural Engine Initialization Failed:", err);
      }
    };
    initEngine();
    
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // 2. The Main Inference Loop
  const runInference = async (currentMode) => {
    const video = videoRef.current;
    
    if (!modelRef.current || !video || video.readyState !== 4) {
      requestRef.current = requestAnimationFrame(() => runInference(currentMode));
      return;
    }

    const now = Date.now();
    setFps(Math.round(1000 / (now - lastTime.current)));
    lastTime.current = now;

    try {
      const [rawBoxes, scoresArray, classesArray] = tf.tidy(() => {
        // Pre-processing: 640x640 is the YOLO standard
        const img = tf.browser.fromPixels(video)
          .resizeBilinear([640, 640])
          .cast('float32')
          .expandDims(0)
          .div(255.0);

        const output = modelRef.current.execute(img);
        const reshaped = output.squeeze().transpose([1, 0]);

        // Slicing [cx, cy, w, h] and scores
        const boxes = tf.slice(reshaped, [0, 0], [-1, 4]);
        const rawScores = tf.slice(reshaped, [0, 4], [-1, 80]);

        return [
          boxes.arraySync(), 
          rawScores.max(1).arraySync(), 
          rawScores.argMax(1).arraySync()
        ];
      });

      // Prepare boxes for NMS: YOLO [cx, cy, w, h] -> TFJS [y1, x1, y2, x2]
      const nmsBoxes = rawBoxes.map(([cx, cy, w, h]) => [
        cy - h / 2, 
        cx - w / 2, 
        cy + h / 2, 
        cx + w / 2
      ]);

      const config = MODES[currentMode] || MODES.NORMAL;

      // --- SENSITIVITY TWEAKS ---
      const nmsIndicesTensor = await tf.image.nonMaxSuppressionAsync(
        nmsBoxes, 
        scoresArray, 
        50,           // INCREASED: from 20 to 50 to see more simultaneous objects
        0.5,          // IOU: Allows slightly more overlapping boxes for dense scenes
        config.minConfidence || 0.25 // Using the new lower thresholds
      );
      
      const indices = nmsIndicesTensor.arraySync();
      nmsIndicesTensor.dispose();

      // 3. Process Detections
      const { detections, isPathClear } = processDetections(
        indices, 
        rawBoxes, 
        scoresArray, 
        classesArray, 
        currentMode, 
        COCO_CLASSES
      );

// 4. Smart Filtering & Mode-Specific Logic
      let filtered = detections.filter(d => {
        const isWhitelisted = config.activeClasses.length === 0 || config.activeClasses.includes(d.label);
        const isHighConfidence = d.confidence > 0.75; 
        return isWhitelisted || isHighConfidence;
      });

      // --- ADVANCED: COUNT MODE ENGINE ---
      if (currentMode === "COUNT" && filtered.length > 0) {
        const tally = {};
        filtered.forEach(det => {
          tally[det.label] = (tally[det.label] || 0) + 1;
        });

        // Convert tally to a single string: "2 people, 3 chairs"
        const countSummary = Object.entries(tally)
          .map(([label, count]) => `${count} ${label}${count > 1 ? 's' : ''}`)
          .join(", ");
        
        // Create a single virtual detection for the voice to read
        filtered = [{
          ...filtered[0],
          displayText: `I see ${countSummary}`,
          label: "count_summary"
        }];
      }

      // --- CUSTOM OBJECT MATCHING ---
// For each YOLO detection, crop that region from the video frame and
// check if it visually matches any user-uploaded reference image
if (customObjects.length > 0 && video.readyState === 4) {
  const matchCanvas = document.createElement('canvas');
  const matchCtx = matchCanvas.getContext('2d');

  filtered = filtered.map(det => {
    if (det.label === 'person') return det;
    
    // Convert YOLO's center+size coords to pixel coords on the actual video
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const scaleX = vW / 640;
    const scaleY = vH / 640;

    const x = (det.cx - det.w / 2) * scaleX;
    const y = (det.cy - det.h / 2) * scaleY;
    const w = det.w * scaleX;
    const h = det.h * scaleY;

    // Draw only the bounding-box region into a temp canvas
    matchCanvas.width = w;
    matchCanvas.height = h;
    matchCtx.drawImage(video, x, y, w, h, 0, 0, w, h);

    // Compare that crop against user reference images
    const match = matchCrop(matchCanvas);
    if (match) {
      // Override the YOLO label with the user's custom label
      return {
        ...det,
        label: match.label,
        displayText: `${det.distance} ${match.label} at ${det.direction} (yours)`,
        isCustom: true
      };
    }
    return det;
  });
}

setActiveDetections(filtered);

if (currentMode === "PATHFINDER") {
        // 1. Identify objects in the "Critical Corridor" (Center 40%)
        const criticalObjects = filtered.filter(d => {
          const centerX = d.cx / 640;
          return centerX > 0.3 && centerX < 0.7;
        });

        const isNowSafe = criticalObjects.length === 0;

        // --- ADDED: Only process audio if NOT silent and NOT muted ---
        const shouldSpeak = !isMuted && currentMode !== "SILENT";

        if (!isNowSafe) {
          // 2. Generate the spatial description
          const descriptions = criticalObjects.map(d => {
            const relX = d.cx / 640;
            const relY = d.cy / 640;
            let horizontal = relX < 0.33 ? "at left" : relX > 0.66 ? "at right" : "ahead";
            let vertical = relY > 0.66 ? "down" : relY < 0.33 ? "up" : "";
            return `${d.label} ${horizontal} ${vertical}`.trim();
          });

          const uniqueDesc = [...new Set(descriptions)].slice(0, 2);
          const alertMsg = `Path not clear because ${uniqueDesc.join(", ")}`;

          // CHECK shouldSpeak HERE
            if (shouldSpeak && (isPathSafe || (Date.now() - lastSpokenRef.current > 3500))) {
                speak(alertMsg, true);
                lastSpokenRef.current = Date.now();
                }
            } else {
                // CHECK shouldSpeak HERE
                if (shouldSpeak && !isPathSafe) {
                speak("Path clear ahead", true);
                lastSpokenRef.current = Date.now();
                }
            }
            setIsPathSafe(isNowSafe);
            }


    // // 5. Mode-Specific Safety Logic
    //   if (currentMode === "PATHFINDER") {
    //     const laneWidth = 0.4; // Center 40% of the screen
    //     const isObstacleInWay = filtered.some(d => {
    //       const left = (d.cx - d.w / 2) / 640;
    //       const right = (d.cx + d.w / 2) / 640;
    //       // Check if the object overlaps with the center lane [0.3 to 0.7]
    //       return right > 0.3 && left < 0.7;
    //     });

    //     // Trigger voice only on state change to avoid spam
    //     if (!isObstacleInWay && !isPathSafe) {
    //       speak("Path is now clear.");
    //     } else if (isObstacleInWay && isPathSafe) {
    //       speak("Obstacle in corridor.");
    //     }
        
    //     setIsPathSafe(!isObstacleInWay);
    //   } else {
    //     // Fallback to your original logic for other modes
    //     setIsPathSafe(isPathClear);
    //   }
      
      if (filtered.length > 0) {
        const avgConf = filtered.reduce((acc, curr) => acc + curr.confidence, 0) / filtered.length;
        setConfidence(Math.round(avgConf * 100));
      } else {
        setConfidence(0);
      }

    } catch (err) {
      console.error("Inference Engine Error:", err);
    }

    // Continue the loop
    requestRef.current = requestAnimationFrame(() => runInference(currentMode));
  };

  return { isModelLoaded, fps, activeDetections, isPathSafe, confidence, runInference };
}