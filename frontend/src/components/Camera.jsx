import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';

// The standard 80 classes that YOLO is trained to recognize
const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
  "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
  "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

export default function Camera() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // App States
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Mutable Refs for the Animation Loop
  const modelRef = useRef(null);
  const lastSpokenTime = useRef(0);
  const isMutedRef = useRef(false);

  // Sync the React state with the mutable ref so the loop can read it without restarting
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // 1. Initialization (Load Model & Start Camera)
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        // Load the AI from the public folder
        const model = await tf.loadGraphModel('/yolo11n_web_model/model.json');
        modelRef.current = model;
        setIsModelLoaded(true);
        console.log("Offline AI Model Loaded");
      } catch (err) {
        console.error("Failed to load model:", err);
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" } // Forces back camera on mobile
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (err) {
        console.error("Error accessing camera:", err);
        setHasCameraPermission(false);
      }
    };

    loadModel();
    startCamera();

    // Cleanup: Stop the camera if the user leaves this page
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. The Core Inference Loop
  useEffect(() => {
    let animationId;

    const detectFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const model = modelRef.current;

      // Only run if everything is loaded and the video has a valid frame
      if (isModelLoaded && video && video.readyState === 4 && model) {
        const ctx = canvas.getContext('2d');
        
        // Prevent canvas flickering by only updating size when needed
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        tf.engine().startScope(); // Manage WebGL Memory

        try {
          // Pre-processing
          const tfImg = tf.browser.fromPixels(video);
          const resized = tf.image.resizeBilinear(tfImg, [640, 640]);
          const casted = resized.cast('float32');
          const expanded = casted.expandDims(0);
          const inputTensor = expanded.div(255.0);

          // Inference
          const results = model.execute(inputTensor);
          const output = Array.isArray(results) ? results[0] : results;
          
          // Post-processing (Format Matrix & Dynamic Shape Handling)
          const [boxes, scores, classes] = tf.tidy(() => {
            let transRes = output;
            if (output.shape[1] === 84) {
              transRes = output.transpose([0, 2, 1]); // Flip if wide matrix
            }
            const boxesData = tf.slice(transRes, [0, 0, 0], [1, -1, 4]);
            const classScores = tf.slice(transRes, [0, 0, 4], [1, -1, 80]);
            
            const maxScores = classScores.max(2);
            const maxClassIndices = classScores.argMax(2);
            return [boxesData.squeeze(), maxScores.squeeze(), maxClassIndices.squeeze()];
          });

          // Non-Maximum Suppression (Filter weak/overlapping boxes)
          const nmsIndices = await tf.image.nonMaxSuppressionAsync(boxes, scores, 20, 0.4, 0.25);

          const boxesArray = boxes.arraySync();
          const scoresArray = scores.arraySync();
          const classesArray = classes.arraySync();
          const nmsArray = nmsIndices.arraySync();

          // Clear previous frame's drawings
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const scaleX = canvas.width / 640;
          const scaleY = canvas.height / 640;

          // Process each detected object
          nmsArray.forEach((i) => {
            const [cx, cy, w, h] = boxesArray[i];
            const confidence = (scoresArray[i] * 100).toFixed(1);
            const label = COCO_CLASSES[classesArray[i]];

            // --- Spatial Awareness Math ---
            let direction = "Center";
            if (cx < 640 / 3) direction = "Left";
            else if (cx > (640 / 3) * 2) direction = "Right";

            let distance = "";
            if (w > 640 * 0.4) distance = "Very Close";

            // --- Audio Assistant Logic ---
            const currentTime = Date.now();
            // Check if unmuted AND 3 seconds have passed since last speech
            if (!isMutedRef.current && (currentTime - lastSpokenTime.current > 3000)) {
              const sentence = `${distance} ${label}, ${direction}`;
              const utterance = new SpeechSynthesisUtterance(sentence);
              utterance.rate = 1.2;
              window.speechSynthesis.speak(utterance);
              lastSpokenTime.current = currentTime;
            }

            // --- Draw Bounding Boxes ---
            const x1 = (cx - w / 2) * scaleX;
            const y1 = (cy - h / 2) * scaleY;
            const boxWidth = w * scaleX;
            const boxHeight = h * scaleY;

            // Turn box RED if the object is very close, otherwise NEON GREEN
            const boxColor = distance === "Very Close" ? "#FF3B30" : "#32D74B";

            ctx.beginPath();
            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(x1, y1, boxWidth, boxHeight);

            // Draw sleek label background
            ctx.fillStyle = boxColor;
            const text = `${label} ${confidence}%`;
            const textWidth = ctx.measureText(text).width;
            ctx.roundRect(x1, y1 - 30, textWidth + 16, 30, [8, 8, 0, 0]);
            ctx.fill();
            
            // Draw label text
            ctx.fillStyle = "#000000";
            ctx.font = "bold 16px system-ui, sans-serif";
            ctx.fillText(text, x1 + 8, y1 - 8);
          });

        } catch (err) {
          console.error("Inference Error:", err);
        }

        tf.engine().endScope(); // Free Memory
      }

      // Loop it!
      animationId = requestAnimationFrame(detectFrame);
    };

    detectFrame();
    
    // Cleanup: Stop the animation loop if the component unmounts
    return () => cancelAnimationFrame(animationId);
  }, [isModelLoaded]);

  // 3. UI Render
  return (
    <div style={styles.container}>
      
      {/* Floating Status Badge */}
      <div style={styles.statusBadge}>
        <div style={{
          ...styles.statusDot, 
          backgroundColor: isModelLoaded ? "#32D74B" : "#FF9F0A"
        }} />
        <span style={styles.statusText}>
          {isModelLoaded ? "AI Active" : "Loading AI..."}
        </span>
      </div>

      {hasCameraPermission === false && (
        <div style={styles.errorOverlay}>
          <p>Camera access denied. Please enable it in your browser settings.</p>
        </div>
      )}

      {/* Fullscreen Video Area */}
      <div style={styles.cameraWrapper}>
        <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>

      {/* Bottom Control Bar */}
      <div style={styles.controlBar}>
        <button 
          style={{...styles.button, backgroundColor: isMuted ? "#FF3B30" : "#38383A"}}
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? "🔇 Muted" : "🔊 Active"}
        </button>
        
        <button 
          style={{...styles.button, backgroundColor: "#0A84FF", marginLeft: "10px"}}
          onClick={() => navigate('/profile')}
        >
          ⚙️ Settings
        </button>
      </div>

    </div>
  );
}

// Sleek, Accessible, Mobile-First Styles
const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#000000",
    height: "100dvh", 
    width: "100vw",
    overflow: "hidden",
    position: "relative",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  statusBadge: {
    position: "absolute",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: "rgba(30, 30, 30, 0.8)",
    backdropFilter: "blur(10px)",
    padding: "8px 16px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    zIndex: 20, 
    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "600",
  },
  errorOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.9)",
    color: "#FF3B30",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    textAlign: "center",
    zIndex: 50,
  },
  cameraWrapper: {
    flex: 1, 
    position: "relative",
    width: "100%",
    backgroundColor: "#1C1C1E",
  },
  video: {
    position: "absolute",
    top: 0, left: 0,
    width: "100%", height: "100%",
    objectFit: "cover",
  },
  canvas: {
    position: "absolute",
    top: 0, left: 0,
    width: "100%", height: "100%",
    objectFit: "cover",
    zIndex: 10,
  },
  controlBar: {
    height: "100px",
    backgroundColor: "#1C1C1E",
    borderTop: "1px solid #38383A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: "20px", 
    zIndex: 20,
  },
  button: {
    border: "none",
    padding: "16px 32px",
    borderRadius: "30px",
    color: "#FFFFFF",
    fontSize: "18px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
    transition: "background-color 0.2s",
  }
};