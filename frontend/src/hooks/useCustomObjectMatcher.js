import { useEffect, useMemo, useState } from 'react';
import { prepareCustomObjectReferences } from '../utils/customObjectMatcher';

const API_BASE_URL = 'http://localhost:5000';

export default function useCustomObjectMatcher() {
  const [references, setReferences] = useState([]);
  const [isMatcherReady, setIsMatcherReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadReferences = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setReferences([]);
        setIsMatcherReady(true);
        return;
      }

      setIsMatcherReady(false);

      try {
        const response = await fetch(`${API_BASE_URL}/api/objects`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch custom objects');
        }

        const objects = await response.json();
        const normalizedObjects = objects.map((object) => ({
          ...object,
          imageUrl: `${API_BASE_URL}/${String(object.imagePath || '').replace(/\\/g, '/')}`,
        }));

        const prepared = await prepareCustomObjectReferences(normalizedObjects);
        if (!isCancelled) {
          setReferences(prepared);
        }
      } catch (error) {
        console.error('Unable to load custom object references', error);
        if (!isCancelled) {
          setReferences([]);
        }
      } finally {
        if (!isCancelled) {
          setIsMatcherReady(true);
        }
      }
    };

    loadReferences();

    return () => {
      isCancelled = true;
    };
  }, []);

  return useMemo(() => ({
    references,
    isMatcherReady,
  }), [references, isMatcherReady]);
}
