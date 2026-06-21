# PureVerse / Aniverse — The Complete Plain-English Guide

> A full tour of how this whole project works, written so anyone can follow it —
> no coding background needed. Diagrams, flowcharts, and simple analogies included.

---

## Table of contents

1. [The big idea (in one paragraph)](#1-the-big-idea)
2. [The single most important concept: you don't store any video](#2-the-most-important-concept)
3. [The 4 pieces of the project](#3-the-4-pieces)
4. [Where all the information comes from](#4-where-everything-comes-from)
5. [The Backend "brain" — explained service by service](#5-the-backend-brain)
6. [The Website — pages and what they do](#6-the-website)
7. [The Mobile app](#7-the-mobile-app)
8. [The Android ad-block app](#8-the-android-ad-block-app)
9. [Key journeys (step-by-step flowcharts)](#9-key-journeys)
   - 9a. Opening the homepage
   - 9b. Searching
   - 9c. **Watching an episode (the big one)**
   - 9d. Why a brand-new episode is "late"
   - 9e. Signing in and syncing your stuff
   - 9f. Watch Party
   - 9g. "New episode!" notifications
10. [How your data is stored](#10-how-data-is-stored)
11. [Caching & timing (why some things take time)](#11-caching--timing)
12. [Where it all runs (deployment)](#12-deployment)
13. [Glossary — every term in plain English](#13-glossary)

---

## 1. The big idea

**PureVerse** (the code folder is called *Aniverse*) is a streaming **website + phone app** for
movies, TV series, and anime — like a Netflix-style front door. You browse posters, click a
title, and a video player opens.

The twist: PureVerse **does not own or store any movies or episodes**. It is a smart
"middle-man" that:

1. Pulls **information** about shows (titles, posters, episode lists, ratings) from public
   databases, and
2. Points your player at **other websites** that already host the actual video.

Think of it as a **really nice TV guide + universal remote**. The guide tells you what exists
and what it's about; the remote tunes you into whichever "channel" (video provider) actually
has the episode playing.

---

## 2. The most important concept

### 🟢 PureVerse never holds the video file. It only builds a link to someone else's player.

This one fact explains ~80% of how the project behaves, so let's make it crystal clear.

When you click "Play" on *FROM* Season 4, Episode 9, the backend does **not** go find a video
file. It simply **builds a web address** like this:

```
https://player.videasy.net/tv/12345/4/9
```

…and drops that address into a little embedded window (an **iframe**) on the page. Everything
you then see — the play button, the quality menu, the ads — is coming from *that other website*
(here, Videasy), not from PureVerse.

```
   YOU click Play
        │
        ▼
 ┌──────────────────────────┐        ┌───────────────────────────────┐
 │  PureVerse                │        │  Videasy / VidSrc / VidFast…  │
 │  "Here's the address of   │ ─────▶ │  (these actually have the      │
 │   a player that has this  │        │   video and stream it to you)  │
 │   episode."               │        │                               │
 └──────────────────────────┘        └───────────────────────────────┘
        │                                         │
        │   builds the URL only                   │  sends the real video
        ▼                                         ▼
        └──────────────►  the embedded player window  ◄───────────────┘
```

**Why this matters for you:**
- If a video won't play, it's almost always the *other* website's problem, not yours.
- A brand-new episode appears on PureVerse only once those other websites have it (see §9d).
- PureVerse stays small, cheap, and legal-ish to run because it stores no media.

There are a few small exceptions for anime (the backend sometimes looks up the *correct* anime
player link), but even then it never stores the video — it just finds the right link.

---

## 3. The 4 pieces

The project is one repository split into four parts. Three are "apps you use," and one is the
shared "brain" they all talk to.

```
                         ┌──────────────────────────────┐
                         │        THE BRAIN              │
                         │   /backend  (Node.js API)     │
                         │                               │
                         │  • Looks up show info         │
                         │  • Builds player links        │
                         │  • Stores your account        │
                         │  • Runs Watch Parties         │
                         └───────────────┬───────────────┘
                                         │  (everyone asks the brain
                                         │   for data over the internet)
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
   ┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
   │  /web              │    │  /mobile           │    │  /android          │
   │  The website       │    │  The phone app     │    │  Ad-blocking        │
   │  (Next.js/React)   │    │  (Flutter)         │    │  WebView shell      │
   │                    │    │                    │    │  (Kotlin)          │
   │  Runs in a browser │    │  iPhone & Android  │    │  Wraps the website  │
   │                    │    │                    │    │  in an APK that     │
   │                    │    │                    │    │  strips ads         │
   └────────────────────┘    └────────────────────┘    └────────────────────┘
```

| Folder | What it is | Built with | Who uses it |
|--------|-----------|------------|-------------|
| `/backend` | The brain / server (a.k.a. "API") | Node.js, Express, TypeScript, Socket.io | The other 3 apps |
| `/web` | The website | Next.js 16, React, Tailwind CSS | Anyone in a browser |
| `/mobile` | The phone app | Flutter (Dart), Riverpod | iPhone / Android users |
| `/android` | A native ad-blocking wrapper | Kotlin + Android WebView | Mobile users who want ad-free embeds |

**Key point:** the website and the phone app are basically two different "faces." Both ask the
**same backend** the same questions. So when you fix something in the backend, both faces benefit.

---

## 4. Where everything comes from

PureVerse is a mix-board: it blends several free public services. Here's the full list and what
each one provides.

```
                         ┌───────────────────────────────┐
                         │          BACKEND               │
                         │  (asks each source as needed)  │
                         └───────────────────────────────┘
   ┌───────────────┬──────────────┬───────────────┬──────────────┬───────────────┐
   ▼               ▼              ▼               ▼              ▼               ▼
┌────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────────────┐  ┌──────────┐
│ TMDB   │   │ MyAnime  │   │ Embed     │   │ anikoto  │   │ OpenSubtitles│  │ HiAnime  │
│        │   │ List/    │   │ providers │   │(megaplay)│   │              │  │(aniwatch)│
│ Movie/ │   │ Jikan    │   │           │   │          │   │  Subtitle    │  │ OFF by   │
│ TV/    │   │          │   │ The actual│   │ Anime    │   │  files for   │  │ default  │
│ anime  │   │ Anime IDs│   │ video     │   │ SUB/DUB  │   │  movies/TV   │  │ (broken  │
│ INFO   │   │ + titles │   │ players   │   │ players  │   │              │  │ upstream)│
└────────┘   └──────────┘   └───────────┘   └──────────┘   └──────────────┘  └──────────┘
   │
   └─ titles, posters, banners, episode lists, ratings, cast, genres, age ratings…
```

| Source | Gives PureVerse… | Notes |
|--------|------------------|-------|
| **TMDB** (themoviedb.org) | All the **info**: titles, posters, episode lists, cast, ratings, "what aired last" | The main metadata engine. Community-maintained. |
| **MyAnimeList / Jikan** | Anime **IDs** and titles | Used to find the right anime so the SUB/DUB players line up. |
| **Embed providers** | The **actual video player** | Videasy, VidLink, VidFast, VidSrc, VidSrc.cc, 2Embed, MultiEmbed, Vidnest. PureVerse just builds their URLs. |
| **anikoto / megaplay.buzz** | Real **anime SUB & DUB** player links | The backend looks up the correct episode link here, branded "PureVerse · SUB/DUB" in the UI. |
| **OpenSubtitles** | **Subtitle files** for movies/TV | Fetched after playback starts, converted to web-friendly `.vtt`. |
| **HiAnime (aniwatch)** | Direct anime streams (optional) | Turned **off** right now because the upstream site changed and broke it. Flips back on via a setting. |

---

## 5. The Backend brain

The backend lives in `/backend/src`. It is a **web server** that listens for questions ("give me
trending movies", "give me the player link for this episode") and answers with neatly formatted
data. The other apps never talk to TMDB or Videasy directly — they always go through this brain.

Here's the layout of the brain and what each part does:

```
backend/src/
├── server.ts            ← Starts everything; opens the door on port 5000
├── routes/index.ts      ← The "menu" of all questions the brain can answer (the API endpoints)
├── controllers/         ← The "receptionists" — take a request, call a service, send the answer
│   ├── mediaController       (trending, search, details, stream links, episodes…)
│   ├── authController        (sign in with Google / guest, log out)
│   ├── userController        (your watchlist, favorites, history, searches)
│   ├── notificationController(your "new episode" alerts)
│   ├── partyController       (watch party rooms)
│   └── rtcController         (voice-chat connection info)
├── services/            ← The "specialists" — the real work happens here
│   ├── metadataService       (talks to TMDB: info + episode lists)
│   ├── animeService          (anime IDs via MyAnimeList)
│   ├── anikotoStreamService  (finds real anime SUB/DUB player links)
│   ├── aniwatchService       (HiAnime direct streams — currently off)
│   ├── subtitleService       (OpenSubtitles → .vtt files)
│   ├── notificationService   (background "did a new episode air?" checker)
│   ├── partyService          (watch party room rules & state)
│   ├── authService           (verifies Google logins, merges guest data)
│   └── userStore             (saves everything to a file — see §10)
├── scrapers/vidsrc.ts   ← Builds the list of player links for a title (the "universal remote")
├── sockets/roomCoordinator.ts ← Live Watch Party engine (real-time messaging)
└── models/              ← Definitions of the data shapes (what a "user" or "episode" looks like)
```

### How a request flows through the brain

Every request follows the same simple path:

```
  App asks a question                      Brain answers
        │                                        ▲
        ▼                                        │
   ROUTE (the menu)  ──▶  CONTROLLER  ──▶  SERVICE  ──▶  (TMDB / providers / file)
   "/api/trending"       "receptionist"   "specialist"      outside world / storage
```

**Example:** the website asks `GET /api/media/details/tv/tmdb_123`
1. The **route** recognizes it and hands it to `getMediaDetails` (controller).
2. The controller calls `getTmdbDetails` (service in `metadataService`).
3. That service asks **TMDB**, reshapes the answer into PureVerse's tidy format, and **caches** it.
4. The answer travels back out to the website.

### The "menu" (main API endpoints)

These are the questions the brain can answer. You don't need to memorize them — just notice how
they map to things you see on screen.

| You see on screen… | The app quietly asks… |
|--------------------|------------------------|
| Homepage rows | `/api/trending`, `/api/latest/series`, `/api/popular/anime`, `/api/top-rated/movies` |
| Search results | `/api/search?q=from` |
| A title's page | `/api/media/details/tv/<id>` |
| The episode list | `/api/tv/<id>/season/<n>` |
| Clicking Play | `/api/media/stream/tv/<id>?season=4&episode=9` |
| Subtitles appearing | `/api/subtitles/tv/<id>?season=4&episode=9` |
| "More like this" | `/api/media/recommendations/tv/<id>` |
| Signing in | `/api/auth/google` or `/api/auth/guest` |
| Your watchlist/history syncing | `/api/user/...` |
| Notifications bell | `/api/user/notifications` |
| Watch party | `/api/party/...` + the live socket connection |

---

## 6. The Website

The website is in `/web`, built with **Next.js** (a popular React framework). It's the "premium
dark glassmorphic" face of PureVerse.

### The pages

```
web/src/app/
├── page.tsx              →  Homepage (hero + rows of posters)
├── movies/               →  Browse movies
├── series/               →  Browse TV series
├── anime/                →  Browse anime
├── search/               →  Search page
├── details/[type]/[id]/  →  A title's detail page (synopsis, cast, episodes, Play button)
├── watch/[type]/[id]/    →  The WATCH page (the video player) ← the heart of the site
├── history/              →  Continue watching
├── mylist/               →  Watchlist & favorites
├── profile/              →  Your account & preferences
└── party/[code]/         →  A live watch-party room
```

### What a page is made of ("components")

Pages are assembled from reusable building blocks in `web/src/app/components/`. A few important
ones:

- **Navbar / MobileTabBar** — top bar (desktop) and bottom tabs (phone).
- **HeroSection** — the big featured banner at the top of the homepage.
- **MediaRow / MediaCard** — the horizontal rows of poster cards you scroll through.
- **EpisodeBrowser / SeasonSelector** — pick a season and episode.
- **ServerSelector** — the "Switch Server" buttons (choose a different video provider).
- **party/** — the chat panel, member list, and voice-chat logic for watch parties.

### A sketch of the Watch page

This is what `watch/[type]/[id]/page.tsx` builds on screen:

```
┌───────────────────────────────────────────────────────────────┐
│  ← Back                                          Switch Server ⟳ │  ← buttons float on top
│                                                                 │
│                                                                 │
│                  ┌───────────────────────────┐                  │
│                  │                           │                  │
│                  │   EMBEDDED VIDEO PLAYER   │  ← this is an     │
│                  │   (Videasy / VidSrc /…)   │     iframe to     │
│                  │                           │     another site  │
│                  └───────────────────────────┘                  │
│                                                                 │
│  [◀ Prev]  [Next ▶]   Up next: "Episode 10"        Autoplay [●] │
│                                                     Watch Party  │
├───────────────────────────────────────────────────────────────┤
│  Series · ⭐ 7.8 · 2022 · Horror Mystery                         │
│  FROM                                                           │
│  Season 4 · Episode 9 — "The Way Things Are"                    │
│  Synopsis text here…            [+ My List] [♡ Favorite] [Share]│
├───────────────────────────────────────────────────────────────┤
│  Episodes (our own list — hidden when Videasy is active,        │
│  because Videasy has its own built-in episode panel)            │
├───────────────────────────────────────────────────────────────┤
│  Servers:  [Videasy] [VidLink] [VidFast] [VidSrc] [2Embed] …    │
├───────────────────────────────────────────────────────────────┤
│  More Like This:  ▸ poster ▸ poster ▸ poster ▸ poster           │
└───────────────────────────────────────────────────────────────┘
```

Two neat tricks worth knowing about this page:
- **Scroll-guard:** the embedded player normally "eats" your mouse wheel. After your cursor
  leaves the player once, a transparent layer lets you scroll the page; one click hands control
  back to the player.
- **Ad defense:** the player window is loaded in a restricted "sandbox" that blocks pop-up and
  redirect ads, while still allowing play + fullscreen.

---

## 7. The Mobile app

The phone app is in `/mobile`, built with **Flutter** (Google's toolkit for building iPhone and
Android apps from one codebase, using the Dart language). It talks to the **same backend** as the
website.

```
mobile/lib/
├── main.dart                 ←  App entry point
├── core/                     ←  Shared plumbing
│   ├── network/api_client    →  Talks to the backend (same endpoints as the web)
│   ├── theme, constants      →  Colors, fonts, the dark look
│   └── models/               →  Data shapes (mirror the backend's)
├── features/                 ←  One folder per screen/feature
│   ├── home/                 →  Homepage rows
│   ├── browse/ search/       →  Browse & search
│   ├── details/              →  Title detail page
│   ├── player/               →  The video player (an embedded web view)
│   ├── party/                →  Watch party (chat + voice + synced playback)
│   ├── auth/                 →  Google / guest sign-in
│   ├── library/ history/     →  Watchlist, favorites, continue-watching
│   └── profile/              →  Account & settings
└── shared/                   ←  Reusable widgets (poster cards, rails, headers)
```

**Two differences from the website:**
1. On mobile, the **default video provider is VidFast** (the website defaults to Videasy). The
   app picks its preferred server by name regardless of list order.
2. The player is a **WebView** (a mini-browser inside the app) showing the same kind of embed.

The mobile app uses **Riverpod** to manage state (a clean way to share data like "who's logged in"
across screens). It's structured with "clean architecture" — features are kept in separate,
self-contained folders.

---

## 8. The Android ad-block app

The `/android` folder is a small, separate **native Android app** written in Kotlin. Its only job:
open the PureVerse website inside a **WebView** (a browser component) that has a built-in
**ad-blocker** (`AdBlocker.kt`).

```
┌───────────────────────────────┐
│   Android APK (Kotlin)        │
│  ┌─────────────────────────┐  │
│  │  WebView                │  │
│  │  shows pureverse website │  │  ← every web request passes through
│  │                         │  │     AdBlocker, which cancels requests
│  │  ✂ ads blocked          │  │     to known ad/tracker domains
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

Why it exists: the embedded video providers are ad-heavy. A normal phone browser can't strip
those ads, but this wrapper can, giving a cleaner experience. It's built automatically in CI, and
its target website address must be set before shipping a real build.

---

## 9. Key journeys

Now let's walk through what actually happens, step by step, for the things you do every day.

### 9a. Opening the homepage

```
You open the site
      │
      ▼
Website asks the backend several questions at once:
  • /api/trending          (hot right now)
  • /api/latest/series     (newest episodes)
  • /api/popular/anime
  • /api/top-rated/movies
      │
      ▼
Backend checks its CACHE (a short-term memory).
  ├─ Already have a fresh answer?  → send it instantly
  └─ No? → ask TMDB, reshape it, save to cache, then send
      │
      ▼
Website fills the rows with poster cards.  You scroll. 🎬
```

### 9b. Searching

```
You type "from"
      │
      ▼
/api/search?q=from   (and a lighter /api/search/suggest for the dropdown)
      │
      ▼
Backend asks TMDB for movies/TV AND for anime, in parallel,
then merges + de-duplicates the two lists.
      │
      ▼
You can filter by type / genre / year / rating on the results page.
```

### 9c. Watching an episode — the big one

This is the flow that ties back to your earlier *FROM S4E9* question.

```
        You click "Play" on FROM, S4 E9
                     │
                     ▼
   Website calls:  /api/media/stream/tv/<id>?season=4&episode=9
                     │
                     ▼
   Backend's vidsrc.ts builds a LIST of player links (it does NOT
   check whether each one actually has the video — it just makes URLs):

        1. Videasy   → player.videasy.net/tv/<id>/4/9?…   ← default on web
        2. VidLink   → vidlink.pro/tv/<id>/4/9
        3. VidFast   → vidfast.pro/tv/<id>/4/9             ← default on mobile
        4. VidSrc    → vidsrc.to/embed/tv/<id>/4/9
        5. VidSrc.cc → vidsrc.cc/v2/embed/tv/<id>/4/9      ← often newest first
        6. 2Embed, 7. MultiEmbed …
                     │
                     ▼
   Website puts link #1 (Videasy) into the embedded player window.
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
  Provider HAS the episode    Provider DOESN'T have it yet
        │                          │
        ▼                          ▼
   Video plays. 🎉          Player is blank / spins / "unavailable"
                                   │
                                   ▼
                         You press "Switch Server" → tries the
                         next provider in the list. If ANY provider
                         has it, you'll find it here.
```

Meanwhile, separately and in the background:
- Subtitles are fetched (`/api/subtitles/...`) so they appear shortly after playback starts.
- Your progress is recorded (continue-watching) as the player reports its position.

### 9d. Why a brand-new episode is "late"

Remember §2: PureVerse only builds links; the providers own the video. So a fresh episode has
**two separate gates** before it works on your site:

```
  Episode airs on TV/streaming
            │
            ▼
  GATE 1 — Does it show in the LIST?
    Comes from TMDB. A volunteer has to add the episode there.
    Then your backend caches that list for up to 1 hour.
            │
            ▼
  GATE 2 — Does it actually PLAY?
    Comes from the embed providers (Videasy/VidSrc/…). They must
    rip & host the episode first. For premium-channel shows (like
    FROM on MGM+) this can take hours to a few days.
            │
            ▼
  Both gates open  →  the episode works on PureVerse.
```

**So when a new episode isn't up yet:**
- Not in the list → TMDB hasn't been updated, or your 1-hour cache hasn't refreshed.
- In the list but won't play → the providers haven't sourced the video yet. **This is the usual
  case, and it's out of your hands.** Try "Switch Server"; `VidSrc.cc`/`VidSrc` often get new
  episodes earliest.

The only delay *your own server* adds is that 1-hour metadata cache — never 18 hours. The long
wait is always the providers.

### 9e. Signing in and syncing your stuff

You can use PureVerse without an account (a "guest"). Signing in just lets your watchlist,
favorites, and history follow you to other devices.

```
  Sign in with Google                         Continue as Guest
        │                                            │
        ▼                                            ▼
  /api/auth/google                            /api/auth/guest
  Backend verifies the Google token           Backend makes a temporary
  with Google's servers.                      guest account.
        │                                            │
        └──────────────┬─────────────────────────────┘
                       ▼
        Any stuff you saved while logged out (in the browser's
        local storage) is MERGED into your account.
                       ▼
        Backend hands back a SESSION TOKEN (a long random string).
        The app stores it and sends it on future requests as proof
        of who you are. It lasts ~60 days and auto-renews with use.
```

After that, every "save to watchlist", "mark watched", etc. is sent to `/api/user/...` and stored
on the server, so it's the same on your phone and your laptop.

### 9f. Watch Party

A Watch Party lets several people watch the same thing **in sync**, with **text chat** and
optional **voice chat**. This uses a live, always-open connection (a "socket") instead of the
normal ask-and-answer requests.

```
  Host creates a party  →  gets a short room CODE (e.g. ABC123)
        │
        ▼
  Friends join with the code (and password, if set)
        │
        ▼
  ┌─────────────────────── LIVE ROOM (socket) ───────────────────────┐
  │                                                                  │
  │  Host presses Play/Pause/Seek  →  server tells EVERYONE          │
  │  to do the same, so playback stays in sync.                       │
  │                                                                  │
  │  Chat messages  →  broadcast to all members instantly.            │
  │                                                                  │
  │  Voice chat  →  a "mesh": each talker connects directly to each   │
  │  other (WebRTC). The server only helps them find each other.      │
  │                                                                  │
  │  AUTO-WAIT: if someone's video is buffering, the party            │
  │  auto-pauses for everyone until they catch up — and if one        │
  │  person is hopelessly slow, it gives up after a while and         │
  │  resumes the rest. (No more "stuck waiting for X forever".)       │
  │                                                                  │
  │  The host can also kick, mute, or time-out troublemakers.         │
  └──────────────────────────────────────────────────────────────────┘
```

The rules live in `partyService.ts`; the live messaging engine is `roomCoordinator.ts`.

### 9g. "New episode!" notifications

The backend runs a quiet background check on a timer.

```
  Every 30 minutes, the backend sweeps through all users.
        │
        ▼
  For each show in your Watchlist or Favorites (TV/anime only),
  it asks TMDB: "what's the latest episode that aired?"
        │
        ▼
  Is it newer than the last one we told this user about,
  AND did it air within the last 14 days?
        ├─ No  → do nothing
        └─ Yes → drop a notification in your bell:
                 "New episode: FROM — S4 E9 is now available"
                 (or "Season 4 is here!" for a new season)
```

This is why the bell can light up before the video actually plays — TMDB knows the episode aired
(Gate 1) even if the providers haven't hosted the video yet (Gate 2).

---

## 10. How data is stored

PureVerse keeps things deliberately simple. There is **no big database** — your account data lives
in a single JSON file.

```
backend/data/db.json
   │
   ├── users:    { every account, with watchlist, favorites, history,
   │               notifications, preferences, recent searches }
   └── sessions: { the login tokens and when they expire }
```

How it works (in `userStore.ts`):
- Everything is held **in memory** for speed.
- Changes are **written to the file** a half-second later (batched), using a safe
  "write-to-temp-then-rename" trick so the file can't get corrupted mid-write.
- On shutdown it flushes any pending writes so nothing is lost.

Short-term info (trending lists, show details, episode lists) is **not** stored here — it's kept
in a temporary **cache** that expires (see next section).

```
  Long-term, per-user (file)          Short-term, shared (cache, expires)
  ──────────────────────────          ───────────────────────────────────
  • your account                      • trending rows         (15 min)
  • watchlist / favorites             • search results        (10 min)
  • watch history                     • show details          (1 hour)
  • notifications                     • episode lists         (1 hour)
  • login sessions                    • anime id lookups      (up to a week)
```

---

## 11. Caching & timing

**Caching** = remembering an answer for a while so you don't re-ask TMDB every single time. It
makes the site fast and avoids hitting rate limits, but it means changes can take a little time to
appear.

```
  First person asks for "FROM details"
        │
        ▼
  Backend asks TMDB (slow-ish) → saves the answer in cache for 1 hour
        │
        ▼
  Everyone else for the next hour gets the SAVED answer instantly.
        │
        ▼
  After 1 hour the saved answer expires → next request re-asks TMDB.
```

| What | How long it's cached | What that means for you |
|------|----------------------|--------------------------|
| Trending rows | 15 minutes | Homepage refreshes its "hot" list every 15 min |
| Search results | 10 minutes | Repeated searches are instant for 10 min |
| Show details + episode lists | **1 hour** | A new episode can take up to 1 hour to appear in the list |
| Anime ID lookups | up to a week | Stable, rarely changes |
| Episode-notification check | every 30 min | "New episode" alerts arrive within ~30 min of TMDB knowing |

If you ever want new episodes to surface faster on *your* side, lowering the 1-hour details/episode
cache is the lever — but remember it won't make the **video** play any sooner, since that depends
entirely on the providers.

---

## 12. Deployment

Where each piece actually runs when it's live:

```
  ┌──────────────────────────────────────────────────────────────┐
  │  Backend (Node.js)  →  a server host (e.g. DigitalOcean /     │
  │                        Render). Needs API keys in its env:    │
  │                        TMDB token, Google client ID, etc.     │
  │                        Keeps db.json on disk.                  │
  ├──────────────────────────────────────────────────────────────┤
  │  Website (Next.js)  →  a web host (e.g. Vercel). Needs the    │
  │                        backend's address (NEXT_PUBLIC_API_URL).│
  ├──────────────────────────────────────────────────────────────┤
  │  Mobile (Flutter)   →  built into an Android APK / iOS app.   │
  │                        The backend URL is baked in at build.  │
  ├──────────────────────────────────────────────────────────────┤
  │  Android WebView    →  built into an ad-blocking APK in CI.   │
  └──────────────────────────────────────────────────────────────┘
```

The website on its own can't reach a backend that's only running on your laptop — that's why the
mobile/web builds need the real backend address configured. See `DEPLOYMENT.md` and
`backend/DEPLOY_DIGITALOCEAN.md` for the exact steps.

---

## 13. Glossary

Plain-English definitions for every term used above.

| Term | What it really means |
|------|----------------------|
| **Backend / API / "the brain"** | The server program that answers the apps' questions. |
| **Frontend** | The part you see and touch (website or app). |
| **Endpoint** | One specific question the backend can answer, e.g. `/api/trending`. |
| **TMDB** | The Movie Database — the public source of titles, posters, episode lists. |
| **MyAnimeList / Jikan** | Public anime database used to identify the right anime. |
| **Embed / iframe** | A small window on the page that shows *another* website's player. |
| **Provider / server** | An outside site (Videasy, VidSrc…) that actually hosts the video. |
| **Stream link** | The URL pointing at a provider's player for one episode. |
| **Cache** | Short-term memory of an answer, so it isn't re-fetched constantly. |
| **Subtitle (.vtt)** | A captions file; OpenSubtitles supplies it, backend converts it. |
| **Session token** | A long random string proving you're logged in (lasts ~60 days). |
| **Guest account** | A temporary account with no Google sign-in. |
| **Socket** | An always-open live connection — used for chat and watch-party sync. |
| **WebRTC mesh** | Direct phone-to-phone audio links for party voice chat. |
| **Auto-wait** | Party feature that pauses everyone for whoever is buffering. |
| **WebView** | A mini-browser embedded inside the mobile/Android app. |
| **Riverpod** | The tool Flutter uses to share data between screens. |
| **Sandbox** | Security limits on the embedded player that block pop-up ads. |
| **Cache TTL** | "Time To Live" — how long a cached answer stays fresh. |

---

### The one-sentence summary

> **PureVerse is a polished TV-guide-and-remote: it pulls show *information* from TMDB, builds
> *links* to outside video players, stores *your* watchlist/history in a small file, and adds
> social extras (watch parties, notifications) on top — but it never stores the videos
> themselves, which is why new episodes appear only once the outside providers have them.**
