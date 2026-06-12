# PureVerse — Deployment Guide

One repo, three deploy targets. **Do not split the repo** — Vercel and Render
both deploy a subfolder via a "Root Directory" setting, and the mobile app
isn't hosted at all (it ships as an APK).

```
PureVerse/
├── web/       → Vercel        (Next.js frontend)
├── backend/   → Render/Railway (Express + Socket.io API)
└── mobile/    → APK build      (Flutter app — no hosting)
```

The frontend and mobile app both talk to the **backend's public URL**, so deploy
the backend first.

---

## 1. Backend → Render (deploy this first)

The backend needs a **always-on Node process** (long-lived Socket.io server +
in-memory party rooms + a JSON data file). It **cannot run on Vercel**
serverless. Render, Railway, Fly.io, or any VPS works.

### Render steps
1. New → **Blueprint**, select this repo (it reads `backend/render.yaml`).
   *Or* New → **Web Service** manually with:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
2. Set environment variables:
   | Key | Required | Notes |
   |-----|----------|-------|
   | `TMDB_ACCESS_TOKEN` | ✅ | TMDB v4 Read Access Token (Bearer) |
   | `GOOGLE_CLIENT_ID` | optional | only for Google sign-in; must match the web value |
   | `SCRAPER_PROXY_URL` | optional | outbound proxy for anime scrapers |
   | `PORT` | auto | Render injects this; the app reads `process.env.PORT` |
3. Deploy. Note the public URL, e.g. `https://pureverse-backend.onrender.com`.

### ⚠️ Data persistence
Users, sessions, watchlists, and history live in `backend/data/db.json`.
On Render's **free** tier the filesystem is **ephemeral** — that file resets on
every redeploy/restart, and the instance **sleeps after ~15 min idle** (first
request is slow; active watch parties drop). To keep data:
- Upgrade to a paid instance and attach a **persistent disk** at the data dir
  (see the commented `disk:` block in `render.yaml`), **or**
- Migrate the JSON store to a managed DB (Postgres/Redis) — a later task.

For a demo/portfolio deploy, the free tier is fine as long as you accept the reset.

---

## 2. Web → Vercel

1. New Project → import this repo.
2. **Root Directory:** `web`  (Vercel auto-detects Next.js).
3. Environment variables:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://<your-backend>.onrender.com/api`  ← note the `/api` suffix |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | your Google OAuth client id (optional) |
4. Deploy.

Without `NEXT_PUBLIC_API_URL`, the build falls back to `http://localhost:5000/api`
and the live site can't reach anything. The socket client derives its URL by
stripping `/api`, so this one var wires up both REST and watch-party sockets.

> The `web/src/app/api/proxy/*` routes are Next.js serverless functions and run
> on Vercel automatically — no extra config.

---

## 3. Mobile (Flutter) → APK

Not hosted. Point it at the deployed backend, then build.

1. In `mobile/lib/core/network/api_client.dart`, change `baseUrl` from the
   emulator default (`http://10.0.2.2:5000/api`) to your deployed backend
   (`https://<your-backend>.onrender.com/api`). Best practice: read it from a
   build-time define so debug=emulator / release=prod, e.g.
   `--dart-define=API_URL=...`.
2. Build: `flutter build apk --release` → `build/app/outputs/flutter-apk/`.

> Android blocks cleartext HTTP in release builds, so the production backend
> **must be HTTPS** (Render gives you HTTPS automatically).

---

## CORS
The backend currently allows all origins (`origin: '*'`) for both REST and
sockets — fine for launch. To lock it down, restrict it to your Vercel domain.

## Quick wiring checklist
- [ ] Backend deployed, HTTPS URL noted
- [ ] `TMDB_ACCESS_TOKEN` set on the backend
- [ ] `NEXT_PUBLIC_API_URL = https://…/api` set on Vercel
- [ ] (optional) Google client id set on **both** sides, with your Vercel domain
      added to the Google OAuth "Authorized JavaScript origins"
- [ ] Mobile `baseUrl` points at the HTTPS backend before building the APK
