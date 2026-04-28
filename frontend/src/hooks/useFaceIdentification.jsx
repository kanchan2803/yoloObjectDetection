import { useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../config/api';

export default function useFaceIdentification() {
  const { user } = useAuth();
  // Throttle: only send one request per second maximum
  const lastCallRef = useRef(0);
  const token = localStorage.getItem('token');

  const identifyFace = useCallback(async (videoElement, detection) => {
    if (!user) return null;

    const now = Date.now();
    if (now - lastCallRef.current < 1000) return null; // Throttle to 1 req/sec
    lastCallRef.current = now;

    try {
      const vW = videoElement.videoWidth;
      const vH = videoElement.videoHeight;
      const scaleX = vW / 640;
      const scaleY = vH / 640;

      // Crop just the bounding box region from the video frame
      const x = Math.max(0, (detection.cx - detection.w / 2) * scaleX);
      const y = Math.max(0, (detection.cy - detection.h / 2) * scaleY);
      const w = Math.min(vW - x, detection.w * scaleX);
      const h = Math.min(vH - y, detection.h * scaleY);

      // Draw crop to offscreen canvas then encode as base64 JPEG
      const cropCanvas = new OffscreenCanvas(w, h);
      const ctx = cropCanvas.getContext('2d');
      ctx.drawImage(videoElement, x, y, w, h, 0, 0, w, h);

      // Convert to blob then base64
      const blob = await cropCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      const res = await fetch(apiUrl('/api/identify-face'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: base64
        })
      });

      const data = await res.json();
      console.log('[Face ID]', data.match 
  ? `Matched: ${data.match.label} at ${data.match.confidence}%` 
  : 'No match / no face found');
      return data.match; // { label, confidence } or null

    } catch (err) {
      // Python service offline — fail silently
      return null;
    }
  }, [user]);

  return { identifyFace };
}
