const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (rawApiBaseUrl || 'http://localhost:5000').replace(/\/+$/, '');

export function apiUrl(path) {
  if (!path.startsWith('/')) {
    return `${API_BASE_URL}/${path}`;
  }

  return `${API_BASE_URL}${path}`;
}

export function assetUrl(path) {
  const normalizedPath = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${API_BASE_URL}/${normalizedPath}`;
}
