import { PRIORITY_MAP } from '../components/DrishtiConstants';

/**
 * Advanced Spatial Awareness Engine
 * Calculates distance, direction, and safe path logic
 */

export const processDetections = (indices, boxes, scores, classes, currentMode, cocoClasses) => {
  const detections = [];
  let isPathClear = true;

  // 1. Convert Raw Data to Objects & Apply Priority
  const detectedObjects = indices.map((idx) => {
    const [cx, cy, w, h] = boxes[idx];
    const label = cocoClasses[classes[idx]];
    const confidence = scores[idx];
    const area = w * h;
    const priority = PRIORITY_MAP[label] || PRIORITY_MAP["default"];

    return { idx, label, cx, cy, w, h, area, confidence, priority };
  });

  // 2. Sort by Priority (Person > Vehicle > Other) then by Area (Closest first)
  detectedObjects.sort((a, b) => b.priority - a.priority || b.area - a.area);

  detectedObjects.forEach((obj) => {
    // Determine Distance based on width/height ratio of a 640x640 frame
    let distance = "Far";
    if (obj.w > 450 || obj.h > 450) distance = "Very Near";
    else if (obj.w > 250 || obj.h > 250) distance = "Near";
    else if (obj.w < 100 && obj.h < 100) distance = "Very Far";

    // Determine Direction (Horizontal Split)
    let direction = "Center";
    if (obj.cx < 128) direction = "Far Left";
    else if (obj.cx < 256) direction = "Left";
    else if (obj.cx > 512) direction = "Far Right";
    else if (obj.cx > 384) direction = "Right";

    // --- SAFE PATH LOGIC ---
    // A "Permanent Box" in the center: Width 200px to 440px, Height from 300px down.
    // If an object's bounding box intersects significantly with this zone, path is blocked.
    const inSafetyZone = (obj.cx > 180 && obj.cx < 460) && (obj.h > 200);
    if (inSafetyZone && (distance === "Very Near" || distance === "Near")) {
      isPathClear = false;
    }

    detections.push({
      ...obj,
      distance,
      direction,
      displayText: `${distance} ${obj.label} at ${direction}`,
    });
  });

  return { detections, isPathClear };
};

/**
 * Formats the count mode announcement
 */
export const getCountAnnouncement = (detections) => {
  const counts = {};
  detections.forEach(d => {
    counts[d.label] = (counts[d.label] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([label, count]) => `${count} ${label}${count > 1 ? 's' : ''}`)
    .join(", ");
};