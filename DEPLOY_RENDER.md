# Render Deployment

This repo is production-ready for a three-service Render setup:

1. `frontend` as a Static Site
2. `backend` as a Web Service
3. `python-service` as a Web Service

## 1. Frontend

- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Environment variables:

- `VITE_API_BASE_URL=https://<your-backend-service>.onrender.com`

## 2. Backend

- Root directory: `backend`
- Build command: `npm ci`
- Start command: `npm start`

Environment variables:

- `PORT=10000`
- `MONGO_URI=<your-mongodb-connection-string>`
- `MONGO_DB_NAME=drishti`
- `JWT_SECRET=<strong-random-secret>`
- `PYTHON_SERVICE_URL=https://<your-python-service>.onrender.com`
- `CORS_ORIGIN=https://<your-frontend-site>.onrender.com`

Important:

- The backend stores uploaded files in `backend/uploads`.
- On Render, local disk is not durable across redeploys unless you attach a persistent disk.
- For real production use, prefer object storage like S3 or Cloudinary. If you stay with local uploads, attach a persistent disk to the backend service.

## 3. Python Service

- Root directory: `python-service`
- Build command: `pip install -r requirements`
- Start command: `python app.py`

Environment variables:

- `PORT=10001`
- `MONGO_URI=<your-mongodb-connection-string>`
- `MONGO_DB_NAME=drishti`

## Notes

- The frontend now reads its backend URL from `VITE_API_BASE_URL`.
- The backend now reads its Python face-service URL from `PYTHON_SERVICE_URL`.
- Face identification from the browser is proxied through the backend, so the frontend does not need to know the Python service URL.
- Face registration now sends base64 image data to the Python service, so it no longer depends on local cross-service file paths.

## Post-deploy checks

1. Open the frontend URL.
2. Register a user and sign in.
3. Upload an object image.
4. Upload a person image and confirm the backend can reach the Python service.
5. Open the camera view over HTTPS and confirm install prompt / PWA install works.
6. Refresh and verify the app still loads offline after the first visit.
