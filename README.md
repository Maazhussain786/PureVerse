# PureVerse

> **⚠️ STATUS: UNDER CONSTRUCTION ⚠️**  
> This project is currently in active development. The core architecture is scaffolded, but full metadata integration and streaming resolution logic are still being actively implemented.

---

## 🌌 Overview
**PureVerse** is a cross-platform, high-performance media streaming and tracking ecosystem. It is designed to aggregate movies, TV series, and anime into a unified, ultra-smooth interface. 

The platform operates using a **Backend-For-Frontend (BFF)** architecture with zero subscription dependencies, utilizing public scrapers and legal metadata engines.

## 🛠️ Tech Stack
- **Backend API Gateway**: Node.js, Express, TypeScript, Socket.io (for Watch Parties)
- **Web Client**: Next.js 16, React, Tailwind CSS v4, Framer Motion
- **Mobile Client**: Flutter, Riverpod, clean-architecture, Chewie (Video Player)

## 📁 Repository Structure
- `/backend` - The Node.js API Gateway that normalizes data from TMDB/Jikan and scrapes streaming links.
- `/web` - The Next.js web application featuring a glassmorphic, premium dark theme.
- `/mobile` - The Flutter mobile application engineered for 60+ FPS playback and native performance.

## 🚀 Getting Started

### 1. Run the Backend API
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:5000
```

### 2. Run the Next.js Web Portal
```bash
cd web
npm install
npm run dev
# Runs on http://localhost:3000
```

### 3. Run the Flutter Mobile App
```bash
cd mobile
flutter pub get
flutter run
```

## 📝 Recent Updates
- Bypassed Tailwind CSS compilation bugs causing missing padding/margin classes using targeted inline styles.
- Fully polished Watch Party UI (Invite Modal, Settings Modal, Chat Panel, Video Controls).
- Fixed overlapping layouts on the Profile Page, My List Page, and Global Search overlay.
- Corrected Hero Section layout bugs for excessively long cinematic titles on the Details page.
- Created granular commits separating changes by component architecture.

## 📋 Features (WIP)
- [x] Cross-platform architecture scaffolded
- [x] Premium Dark-themed Glassmorphic UI initialized
- [x] Unified Media Item data model
- [x] Socket.io Room Coordinator for Watch Parties
- [ ] TMDB API Integration for real Movies/Series metadata
- [ ] Jikan API Integration for Anime metadata
- [ ] Scraper engine (VidSrc/Consumet) for stream resolution
- [ ] Cross-platform media synchronization
