import * as tf from '@tensorflow/tfjs';
import { COCO_CLASSES } from '../components/DrishtiConstants';

const MATCH_SIZE = 32;
const MATCH_THRESHOLD = 0.9;

let sharedYoloModelPromise = null;

function createCanvas(size = MATCH_SIZE) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function buildFeatureVector(imageSource) {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imageSource, 0, 0, MATCH_SIZE, MATCH_SIZE);

  const { data } = ctx.getImageData(0, 0, MATCH_SIZE, MATCH_SIZE);
  const grayscale = [];
  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    redTotal += r;
    greenTotal += g;
    blueTotal += b;
    grayscale.push((0.299 * r) + (0.587 * g) + (0.114 * b));
  }

  const pixelCount = MATCH_SIZE * MATCH_SIZE;
  grayscale.push(redTotal / pixelCount, greenTotal / pixelCount, blueTotal / pixelCount);

  const magnitude = Math.sqrt(grayscale.reduce((sum, value) => sum + (value * value), 0)) || 1;
  return grayscale.map((value) => value / magnitude);
}

function cosineSimilarity(vectorA, vectorB) {
  let total = 0;
  for (let i = 0; i < vectorA.length; i += 1) {
    total += vectorA[i] * vectorB[i];
  }
  return total;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function loadSharedYoloModel() {
  if (!sharedYoloModelPromise) {
    sharedYoloModelPromise = tf.loadGraphModel('/yolo11n_web_model/model.json');
  }
  return sharedYoloModelPromise;
}

export async function inferBaseLabelFromImage(imageSource) {
  const model = await loadSharedYoloModel();

  const [rawBoxes, scoresArray, classesArray] = tf.tidy(() => {
    const input = tf.browser.fromPixels(imageSource)
      .resizeBilinear([640, 640])
      .cast('float32')
      .expandDims(0)
      .div(255.0);

    const output = model.execute(input);
    const reshaped = output.squeeze().transpose([1, 0]);
    const boxes = tf.slice(reshaped, [0, 0], [-1, 4]);
    const rawScores = tf.slice(reshaped, [0, 4], [-1, 80]);

    return [
      boxes.arraySync(),
      rawScores.max(1).arraySync(),
      rawScores.argMax(1).arraySync(),
    ];
  });

  const nmsBoxes = rawBoxes.map(([cx, cy, w, h]) => [
    cy - (h / 2),
    cx - (w / 2),
    cy + (h / 2),
    cx + (w / 2),
  ]);

  const nmsIndicesTensor = await tf.image.nonMaxSuppressionAsync(
    nmsBoxes,
    scoresArray,
    5,
    0.45,
    0.2
  );

  const indices = nmsIndicesTensor.arraySync();
  nmsIndicesTensor.dispose();

  if (indices.length === 0) {
    return 'unknown';
  }

  const bestIndex = indices
    .map((index) => ({ index, score: scoresArray[index], area: rawBoxes[index][2] * rawBoxes[index][3] }))
    .sort((a, b) => b.score - a.score || b.area - a.area)[0]?.index;

  return COCO_CLASSES[classesArray[bestIndex]] || 'unknown';
}

export async function prepareCustomObjectReferences(objects = []) {
  const prepared = await Promise.all(objects.map(async (object) => {
    try {
      const image = await loadImage(object.imageUrl);
      return {
        ...object,
        baseLabel: (object.baseLabel || 'unknown').toLowerCase(),
        featureVector: buildFeatureVector(image),
      };
    } catch (error) {
      console.warn('Unable to prepare custom reference image', object.label, error);
      return null;
    }
  }));

  return prepared.filter(Boolean);
}

function cropDetection(videoElement, detection) {
  const canvas = createCanvas();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const halfWidth = detection.w / 2;
  const halfHeight = detection.h / 2;
  const sourceX = Math.max(0, ((detection.cx - halfWidth) / 640) * videoElement.videoWidth);
  const sourceY = Math.max(0, ((detection.cy - halfHeight) / 640) * videoElement.videoHeight);
  const sourceWidth = Math.max(1, (detection.w / 640) * videoElement.videoWidth);
  const sourceHeight = Math.max(1, (detection.h / 640) * videoElement.videoHeight);

  ctx.drawImage(
    videoElement,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    MATCH_SIZE,
    MATCH_SIZE
  );

  return canvas;
}

export function applyCustomObjectLabels(detections, references, videoElement) {
  if (!videoElement || !references.length) return detections;

  return detections.map((detection) => {
    const candidates = references.filter((reference) => reference.baseLabel === detection.label);
    if (!candidates.length) {
      return detection;
    }

    const crop = cropDetection(videoElement, detection);
    const featureVector = buildFeatureVector(crop);

    let bestMatch = null;
    let bestScore = -1;

    for (const candidate of candidates) {
      const score = cosineSimilarity(featureVector, candidate.featureVector);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (!bestMatch || bestScore < MATCH_THRESHOLD) {
      return {
        ...detection,
        baseLabel: detection.label,
        displayLabel: detection.label,
      };
    }

    return {
      ...detection,
      baseLabel: detection.label,
      displayLabel: bestMatch.label,
      matchedObjectId: bestMatch._id,
      matchScore: bestScore,
    };
  });
}
