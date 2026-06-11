import { UserRecord } from '../models/user';
import { allUsers, pushNotification, updateUser, findUserByNameOrEmail } from './userStore';
import { fetchTvAirInfo } from './metadataService';

// ─── Episode-release notifications ────────────────────────
// For every tv/anime title the user follows (watchlist or favorites) we
// check TMDB's last_episode_to_air. When a new episode key appears since
// the last check, the user gets an "episode" notification (or a "season"
// notification when the season number jumped).

const CHECK_INTERVAL_MS = 1000 * 60 * 15; // per-user throttle
const MAX_SERIES_PER_CHECK = 25;

function withinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return false;
  return Date.now() - t < days * 86400000 && t <= Date.now() + 86400000;
}

export async function refreshEpisodeNotifications(user: UserRecord, force = false): Promise<number> {
  if (!user.preferences.notifyNewEpisodes) return 0;
  if (!force && Date.now() - user.lastEpisodeCheckAt < CHECK_INTERVAL_MS) return 0;
  user.lastEpisodeCheckAt = Date.now();
  updateUser(user);

  // Followed = union of watchlist + favorites, series only, TMDB ids only
  const seen = new Set<string>();
  const followed = [...user.watchlist, ...user.favorites].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return (item.type === 'tv' || item.type === 'anime') && item.id.startsWith('tmdb_');
  });

  let created = 0;
  const batch = followed.slice(0, MAX_SERIES_PER_CHECK);
  const results = await Promise.allSettled(
    batch.map((item) => fetchTvAirInfo(item.id.replace('tmdb_', '')))
  );

  results.forEach((result, idx) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    const info = result.value;
    const item = batch[idx];
    const last = info.lastEpisode;
    if (!last) return;

    const epKey = `S${last.season}E${last.episode}`;
    const prevKey = user.episodeNotifyMeta[item.id];

    if (prevKey === undefined) {
      // First time we see this series — set a baseline without notifying,
      // otherwise every newly-watchlisted show would fire a stale alert.
      user.episodeNotifyMeta[item.id] = epKey;
      return;
    }
    if (prevKey === epKey) return;
    // Only alert for episodes that aired recently (avoids stale catalog moves)
    if (!withinDays(last.airDate, 14)) {
      user.episodeNotifyMeta[item.id] = epKey;
      return;
    }

    const prevSeason = parseInt(prevKey.match(/^S(\d+)/)?.[1] || '0', 10);
    const isNewSeason = last.season > prevSeason && last.episode === 1;

    pushNotification(user, {
      kind: isNewSeason ? 'season' : 'episode',
      title: isNewSeason
        ? `${info.name} — Season ${last.season} is here!`
        : `New episode: ${info.name}`,
      body: isNewSeason
        ? `Season ${last.season} just premiered. Start watching now.`
        : `S${last.season} E${last.episode}${last.name ? ` — ${last.name}` : ''} is now available.`,
      image: info.posterUrl || item.posterUrl,
      link: `/watch/${item.type}/${item.id}?season=${last.season}&episode=${last.episode}`,
    });
    user.episodeNotifyMeta[item.id] = epKey;
    created++;
  });

  updateUser(user);
  return created;
}

// Background sweep over all users (cheap — TMDB responses are cached 30 min)
export function startNotificationSweep() {
  const SWEEP_MS = 1000 * 60 * 30;
  setInterval(async () => {
    for (const user of allUsers()) {
      try {
        await refreshEpisodeNotifications(user);
      } catch (err: any) {
        console.error('[Notify] sweep failed for', user.id, err?.message);
      }
    }
  }, SWEEP_MS).unref();
}

// ─── Party invites ────────────────────────────────────────
export function sendPartyInvite(
  fromUser: UserRecord,
  toQuery: string,
  roomCode: string,
  roomName: string,
  mediaTitle?: string
): boolean {
  const target = findUserByNameOrEmail(toQuery);
  if (!target || target.id === fromUser.id) return false;
  if (!target.preferences.notifyPartyInvites) return true; // silently respected
  pushNotification(target, {
    kind: 'party_invite',
    title: `${fromUser.name} invited you to a Watch Party`,
    body: `Join "${roomName}"${mediaTitle ? ` to watch ${mediaTitle}` : ''} — tap to enter the room.`,
    link: `/party/${roomCode}`,
  });
  return true;
}
