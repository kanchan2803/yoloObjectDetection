import { useState, useEffect, useRef } from 'react';
import { apiUrl, assetUrl } from '../config/api';

export default function useCustomObjects() {
  const [customObjects, setCustomObjects] = useState([]);
  // Each entry: { label, imageBitmap }
  const loadedRefs = useRef([]);
  const personRefs = useRef([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const load = async () => {
      // 1. Fetch the user's saved objects from your backend
      const res = await fetch(apiUrl('/api/objects'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const objects = await res.json();

      // 2. For each object, fetch the image and decode it into an ImageBitmap
      //    ImageBitmap is what lets us draw into a canvas for pixel comparison
      const loaded = await Promise.all(
        objects.map(async (obj) => {
          try {
            const imgUrl = assetUrl(obj.imagePath);
            const imgRes = await fetch(imgUrl);
            const blob = await imgRes.blob();
            const bitmap = await createImageBitmap(blob);
          return { label: obj.label, bitmap, type: obj.type || 'object' };
          } catch {
            return null;
          }
        })
      );

      const all = loaded.filter(Boolean);
      loadedRefs.current = all.filter(o => o.type === 'object');
      personRefs.current = all.filter(o => o.type === 'person');
      setCustomObjects(all);
    };

    load();
  }, []);

  // 3. Given a canvas crop of a detected region, compare it against all
  //    loaded reference images and return the best match above threshold
  const matchCrop = (cropCanvas, threshold = 0.55) => {
    if (loadedRefs.current.length === 0) return null;

    const SIZE = 32; // Downscale to 32x32 for fast comparison
    const ctx = cropCanvas.getContext('2d');
    const cropData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);

    // Resize crop to 32x32 using an offscreen canvas
    const cropSmall = new OffscreenCanvas(SIZE, SIZE);
    const cropCtx = cropSmall.getContext('2d');
    cropCtx.drawImage(cropCanvas, 0, 0, SIZE, SIZE);
    const cropPixels = cropCtx.getImageData(0, 0, SIZE, SIZE).data;

    let bestScore = 0;
    let bestLabel = null;

    for (const obj of loadedRefs.current) {
      // Draw the reference image into a 32x32 offscreen canvas
      const refSmall = new OffscreenCanvas(SIZE, SIZE);
      const refCtx = refSmall.getContext('2d');
      refCtx.drawImage(obj.bitmap, 0, 0, SIZE, SIZE);
      const refPixels = refCtx.getImageData(0, 0, SIZE, SIZE).data;

      // Compute normalized cross-correlation on grayscale values
      // This measures how visually similar two image patches are
      const score = computeSimilarity(cropPixels, refPixels, SIZE);
      if (score > bestScore) {
        bestScore = score;
        bestLabel = obj.label;
      }
    }

    return bestScore >= threshold ? { label: bestLabel, score: bestScore } : null;
  };

  return { customObjects, personRefs, matchCrop };
}

// Normalized cross-correlation: returns 0 (no match) to 1 (perfect match)
function computeSimilarity(pixelsA, pixelsB, size) {
  const n = size * size;
  let sumA = 0, sumB = 0;

  // Convert to grayscale and compute means
  const grayA = new Float32Array(n);
  const grayB = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const pi = i * 4;
    grayA[i] = 0.299 * pixelsA[pi] + 0.587 * pixelsA[pi+1] + 0.114 * pixelsA[pi+2];
    grayB[i] = 0.299 * pixelsB[pi] + 0.587 * pixelsB[pi+1] + 0.114 * pixelsB[pi+2];
    sumA += grayA[i];
    sumB += grayB[i];
  }

  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = grayA[i] - meanA;
    const db = grayB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const denom = Math.sqrt(denA * denB);
  return denom === 0 ? 0 : (num / denom + 1) / 2; // Normalize to [0, 1]
}
