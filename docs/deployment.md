# Deployment Guide: Render (Backend) & Vercel (Frontend)

This guide explains how to deploy the Stellar Bounty Board backend to Render and the frontend to Vercel. It includes required environment variables, health check paths, and troubleshooting tips.

---

## Backend Deployment: Render

### 1. Create a New Web Service
- Go to [Render](https://render.com/).
- Click **New Web Service** and connect your fork of this repo.
- Select the `backend/` directory as the root.
- Set the build command: `npm install && npm run build`
- Set the start command: `npm start`

### 2. Environment Variables
- (If needed) Add any required environment variables. By default, none are strictly required for local JSON persistence.
- If you add secrets (e.g., for future Postgres or API keys), add them here.

### 3. Health Check Path
- Set health check path to: `/api/health`
- A healthy response is `{ "service": "stellar-bounty-board-backend", "status": "ok", ... }`

### 4. Root Directory
- Use `backend/` as the root directory for the Render service.

### 5. Troubleshooting
- If deploy fails, check logs for missing dependencies or build errors.
- Ensure the port is set to `3001` (or use `process.env.PORT` as Render provides).
- If you add a database, update environment variables and connection logic.

---

## Frontend Deployment: Vercel

### 1. Import Project
- Go to [Vercel](https://vercel.com/).
- Click **New Project** and import your fork of this repo.
- Set the root directory to `frontend/`.

### 2. Environment Variables
- If your backend is public, set `VITE_API_BASE_URL` to your Render backend URL (e.g., `https://your-backend.onrender.com/api`).
- Example:
  - `VITE_API_BASE_URL=https://your-backend.onrender.com/api`
- Add any other frontend secrets as needed.

### 3. Build & Output Settings
- Build command: `npm run build`
- Output directory: `dist`

### 4. Troubleshooting
- If API calls fail, check CORS and proxy settings.
- Make sure the backend is deployed and accessible from Vercel.
- Update the API base URL in your environment variables if the backend URL changes.

---

## Required Environment Variables

### Backend (Render)
- None required for default setup.
- If you add a database or secrets, document them here.

### Frontend (Vercel)
- `VITE_API_BASE_URL` (required): URL of your deployed backend API (e.g., `https://your-backend.onrender.com/api`)

---

## Health Check Paths
- Backend: `/api/health` (should return status `ok`)
- Frontend: `/` (should load the React dashboard)

---

## Common Deployment Issues & Fixes
- **Build fails:** Check Node.js version (18+), install all dependencies, and verify build commands.
- **API not reachable:** Confirm backend is live and CORS is configured.
- **Env vars not set:** Double-check environment variable names and values in Render/Vercel dashboards.
- **Frontend shows blank:** Ensure correct output directory (`dist`) and that the API URL is set.

---

## Need Help?
- Check the [ONBOARDING.md](../ONBOARDING.md) for local setup.
- Open an issue or discussion in the repo for deployment help.
