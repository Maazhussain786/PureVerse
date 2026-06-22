# PureVerse

> A cross-platform streaming **website + phone app** for movies, TV series, and anime —
> a Netflix-style front door with watch parties, sync, and notifications.

PureVerse is a **Backend-For-Frontend (BFF)** media platform that aggregates movies, TV,
and anime into one polished, glassmorphic dark UI. It **stores no video itself** — it pulls
metadata from public databases and builds links into third-party embed players, acting as a
smart "TV guide + universal remote."

> 📖 For a complete, plain-English tour of how everything works (diagrams included), read
> **[PROJECT_GUIDE.md](./PROJECT_GUIDE.md)**.

---

## 🧩 The four pieces

| Folder | What it is | Built with |
|--------|-----------|------------|
| [`/backend`](./backend) | The API "brain" — metadata, stream links, accounts, watch parties | Node.js, Express, TypeScript, Socket.io |
| [`/web`](./web) | The website (premium dark glassmorphic UI) | Next.js 16, React, Tailwind CSS v4, Framer Motion |
| [`/mobile`](./mobile) | The iPhone/Android app | Flutter, Riverpod, `flutter_inappwebview` |
| [`/android`](./android) | Native ad-blocking WebView wrapper | Kotlin + Android WebView |

The web and mobile apps are two "faces" that talk to the **same backend**.

## 🔌 Where the data comes from

- **TMDB** — titles, posters, episode lists, cast, ratings (the main metadata engine)
- **MyAnimeList / Jikan** — anime IDs and titles for SUB/DUB matching
- **Embed providers** — Videasy, VidLink, VidFast, VidSrc, VidSrc.cc, 2Embed, MultiEmbed, Vidnest (the actual players)
- **anikoto / megaplay.buzz** — real anime SUB & DUB player links
- **OpenSubtitles** — subtitle files, converted to `.vtt`
- **HiAnime (aniwatch)** — direct anime streams (off by default; flips on via a setting)

## ✨ Features

- Browse trending / latest / popular / top-rated across movies, series, and anime
- Search with type / genre / year / rating filters
- Embedded player with **multi-server switching** and an **ad-block sandbox** that strips pop-up & redirect ads
- **Watch Parties** — synced playback + text chat + optional WebRTC mesh voice, with auto-wait on buffering and host moderation
- **New-episode notifications** for watchlisted shows (background TMDB sweep)
- Google or guest **sign-in**, with watchlist / favorites / history **synced across devices**
- Continue-watching, My List, profile & preferences
- Emerald + Cyber-Teal brand, glassmorphic dark theme

## 🚀 Getting started

### 1. Backend API
```bash
cd backend
npm install
npm run dev          # ts-node-dev, runs on http://localhost:5000
```
Set `TMDB_ACCESS_TOKEN` (and optionally `GOOGLE_CLIENT_ID`) in `backend/.env`.

### 2. Web portal
```bash
cd web
npm install
npm run dev          # http://localhost:3000
```
Point it at the backend with `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:5000/api`).

### 3. Mobile app
```bash
cd mobile
flutter pub get
flutter run
```
The backend URL is baked in at build time — see `mobile/lib/core/network/api_client.dart`.

## 🗄️ Data storage

No external database. Accounts, watchlists, history, and sessions live in a single
`backend/data/db.json` (held in memory, batched to disk with atomic writes). Short-lived
data (trending, details, episode lists) is cached in memory with per-type TTLs.

## ☁️ Deployment

| Piece | Target |
|-------|--------|
| Backend | Render / DigitalOcean (always-on Node process for Socket.io + JSON store) |
| Web | Vercel (set `NEXT_PUBLIC_API_URL` to `https://<backend>/api`) |
| Mobile | Flutter APK / iOS build (backend URL baked in) |
| Android ad-block | APK built in CI |

Deploy the backend first — both faces need its public HTTPS URL. Full steps:
**[DEPLOYMENT.md](./DEPLOYMENT.md)** and `backend/DEPLOY_DIGITALOCEAN.md`.
