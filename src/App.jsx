import { useEffect, useRef, useState } from 'react';
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

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const modelRef = useRef(null);
  const lastSpokenTime = useRef(0);

  useEffect(() => {
    // 1. Load the TensorFlow AI Model
    const loadModel = async () => {
      try {
        await tf.ready(); // Wait for WebGL backend to initialize
        // Fetch the model from the public folder
        const model = await tf.loadGraphModel('/yolo11n_web_model/model.json');
        modelRef.current = model;
        setIsModelLoaded(true);
        console.log("AI Model Loaded Successfully!");
      } catch (err) {
        console.error("Failed to load model:", err);
      }
    };

    // 2. Start the Camera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
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

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 3. The Core Inference Loop (Runs continuously)
  useEffect(() => {
    let animationId;

    const detectFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const model = modelRef.current;

      // Only run if everything is loaded and video is playing
      if (isModelLoaded && video && video.readyState === 4 && model) {
        const ctx = canvas.getContext('2d');

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        }

        // START TFJS Memory Management
        tf.engine().startScope();

        try {
          // 1. Pre-process
          const tfImg = tf.browser.fromPixels(video);
          const resized = tf.image.resizeBilinear(tfImg, [640, 640]);
          const casted = resized.cast('float32');
          const expanded = casted.expandDims(0);
          const inputTensor = expanded.div(255.0);

          // 2. Run Inference
          const results = model.execute(inputTensor);
          
          // 3. Extract the correct tensor (handles if model returns an array)
          const output = Array.isArray(results) ? results[0] : results;
          
          // 4. Post-process (Dynamically handles both matrix shapes!)
          const [boxes, scores, classes] = tf.tidy(() => {
            let transRes = output;
            
            // If the matrix is short and wide [1, 84, 8400], flip it. 
            // If it's already [1, 8400, 84], leave it alone.
            if (output.shape[1] === 84) {
              transRes = output.transpose([0, 2, 1]);
            }

            const boxesData = tf.slice(transRes, [0, 0, 0], [1, -1, 4]); // x, y, w, h
            const classScores = tf.slice(transRes, [0, 0, 4], [1, -1, 80]); // probabilities
            
            const maxScores = classScores.max(2);
            const maxClassIndices = classScores.argMax(2);
            
            return [boxesData.squeeze(), maxScores.squeeze(), maxClassIndices.squeeze()];
          });

          // 5. Filter out weak overlapping boxes (Set to 25% confidence)
          const nmsIndices = await tf.image.nonMaxSuppressionAsync(
            boxes, scores, 20, 0.4, 0.25 
          );

          const boxesArray = boxes.arraySync();
          const scoresArray = scores.arraySync();
          const classesArray = classes.arraySync();
          const nmsArray = nmsIndices.arraySync();

          // Debugging log: See exactly how many objects the AI found this frame!
          if (nmsArray.length > 0) {
              console.log(`Detected ${nmsArray.length} objects this frame.`);
          }

          // 6. Draw the boxes
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const scaleX = canvas.width / 640;
          const scaleY = canvas.height / 640;

          nmsArray.forEach((i) => {
            const [cx, cy, w, h] = boxesArray[i];
            const confidence = (scoresArray[i] * 100).toFixed(1);
            const label = COCO_CLASSES[classesArray[i]];

            // 1. Calculate Direction
            let direction = "Center";
            if (cx < 640 / 3) {
              direction = "Left";
            } else if (cx > (640 / 3) * 2) {
              direction = "Right";
            }

            // 2. Calculate Distance (Basic Approximation)
            // If the box takes up more than 40% of the screen width, it's very close!
            let distance = "";
            if (w > 640 * 0.4) {
              distance = "Very Close";
            }

            // 3. The Speech Engine (With a 3-second cooldown)
            const currentTime = Date.now();
            if (currentTime - lastSpokenTime.current > 3000) { // 3000 milliseconds = 3 seconds
              
              // Build the sentence
              const sentence = `${distance} ${label}, ${direction}`;
              console.log("Speaking: ", sentence);
              
              // Trigger the browser's voice
              const utterance = new SpeechSynthesisUtterance(sentence);
              utterance.rate = 1.2; // Speak slightly faster than normal
              window.speechSynthesis.speak(utterance);
              
              // Reset the cooldown timer
              lastSpokenTime.current = currentTime;
            }

            const x1 = (cx - w / 2) * scaleX;
            const y1 = (cy - h / 2) * scaleY;
            const boxWidth = w * scaleX;
            const boxHeight = h * scaleY;

            console.log(`Drawing ${label} at X: ${x1}, Y: ${y1}, Width: ${boxWidth}`);

            // Draw Box
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 4;
            ctx.strokeRect(x1, y1, boxWidth, boxHeight);

            // Draw Label
            ctx.fillStyle = "#00FF00";
            const text = `${label} ${confidence}%`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillRect(x1, y1 - 25, textWidth + 10, 25);
            ctx.fillStyle = "#000000";
            ctx.font = "18px Arial";
            ctx.fillText(text, x1 + 5, y1 - 7);
          });

        } catch (err) {
          console.error("Inference Error:", err);
        }

        // END TFJS Memory Management
        tf.engine().endScope();
      }

      // Loop it for the next frame
      animationId = requestAnimationFrame(detectFrame);
    };

    detectFrame();

    return () => cancelAnimationFrame(animationId);
  }, [isModelLoaded]);

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>
        {isModelLoaded ? "🟢 System Active (Offline)" : "🟠 Loading AI Model..."}
      </h2>
      
      {hasCameraPermission === false && (
        <p style={{ color: "red" }}>Camera access denied. Please enable it in your browser settings.</p>
      )}

      <div style={styles.cameraWrapper}>
        <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#121212",
    color: "white",
    minHeight: "100vh",
    fontFamily: "sans-serif",
  },
  header: {
    margin: "20px 0",
  },
  cameraWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: "800px",
    aspectRatio: "4/3",
    backgroundColor: "black",
    borderRadius: "8px",
    overflow: "hidden",
  },
  video: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    zIndex: 10,
  }
};

export default App;