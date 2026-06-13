# Deploying the PureVerse backend to DigitalOcean

Always-on Node process (long-lived Socket.io + JSON data store) on a single
Droplet, with automatic HTTPS via Caddy. Your $200 credit easily covers this.

> **Why a Droplet and not Render free tier:** the Droplet disk is *persistent*,
> so `data/db.json` (users, sessions, history) survives restarts and redeploys.
> No database migration needed to get durable data.

---

## 1. Create the Droplet
DigitalOcean → **Create → Droplets**
- Image: **Ubuntu 24.04 LTS**
- Plan: **Basic → Regular → $12/mo (2 GB RAM / 1 vCPU)** is plenty to start
- Authentication: **SSH key** (add yours; more secure than a password)
- Pick a region near your users → **Create Droplet**
- Note the Droplet's **public IPv4 address**.

## 2. Point a domain at it (required for HTTPS)
Android release builds and Google sign-in both require **HTTPS**, and Caddy
needs a real hostname to issue a certificate.
- If you own a domain: create an **A record** `api.yourdomain.com → <Droplet IP>`.
- No domain? Use a free one at https://www.duckdns.org — e.g.
  `pureverse.duckdns.org` pointed at the Droplet IP.

Wait until `ping api.yourdomain.com` resolves to the Droplet IP before step 6.

## 3. SSH in and install Docker
```bash
ssh root@<Droplet IP>
curl -fsSL https://get.docker.com | sh
```

## 4. Get the code
```bash
git clone https://github.com/Maazhussain786/PureVerse.git
cd PureVerse/backend
```

## 5. Configure secrets
```bash
cp .env.example .env
nano .env
```
Fill in:
| Key | Value |
|-----|-------|
| `TMDB_ACCESS_TOKEN` | your TMDB v4 Read Access Token |
| `GOOGLE_CLIENT_ID`  | `553856787593-itv0geik72fmkq7par00j8o4rljiqjl6.apps.googleusercontent.com` (comma-separate more later for the Android client) |
| `SCRAPER_PROXY_URL` | optional |

`PORT` is not needed — the container listens on 5000 internally and Caddy
fronts it on 443.

## 6. Set your domain in the Caddyfile
```bash
nano Caddyfile      # replace api.example.com with your real hostname
```

## 7. Launch
```bash
docker compose up -d --build
```
Check it:
```bash
docker compose ps          # both services "Up"
docker compose logs -f backend
curl https://api.yourdomain.com/api/party/rooms   # -> JSON, valid TLS
```

## 8. Point the apps at the new backend
- **Web (Vercel):** set `NEXT_PUBLIC_API_URL = https://api.yourdomain.com/api`, redeploy.
- **Flutter app:** built to read `--dart-define=API_URL=...` (wired in a later phase).

## 9. Add the domain to Google OAuth
In Google Cloud Console → your OAuth client → **Authorized JavaScript origins**,
add `https://api.yourdomain.com` only if you serve any GIS flow from it
(usually not needed — the web origin stays `https://pure-verse.vercel.app`).

---

## Updating after a code change
```bash
cd PureVerse/backend && git pull && docker compose up -d --build
```
`./data/db.json` is untouched by rebuilds.

## Backups (recommended)
```bash
# one-off
cp data/db.json ~/db-$(date +%F).json
# or enable DigitalOcean weekly Droplet backups (+20% of Droplet cost)
```

## Later: upgrade to Managed Postgres
Only needed if you outgrow a single instance or want point-in-time backups.
It's a rewrite of `userStore.ts` against a `pg` schema — a separate task, not
required for launch.
