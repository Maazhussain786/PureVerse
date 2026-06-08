import fs from 'fs';
import path from 'path';

export interface WatchProgress {
  userId: string;
  mediaId: string;
  timestamp: number; // Current playback time in seconds
  duration: number; // Total duration in seconds
  progressPercentage: number;
  lastUpdated: string;
}

const DB_PATH = path.join(__dirname, '../../data');
const DB_FILE = path.join(DB_PATH, 'progress_db.json');

// In-memory cache for fast reads/writes
let progressMap: Map<string, Map<string, WatchProgress>> = new Map();

// Initialize DB file
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf-8');
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      for (const [userId, records] of Object.entries(data)) {
        const userMap = new Map<string, WatchProgress>();
        for (const [mediaId, progress] of Object.entries(records as any)) {
          userMap.set(mediaId, progress as WatchProgress);
        }
        progressMap.set(userId, userMap);
      }
    } catch (e) {
      console.error('Failed to parse progress_db.json', e);
    }
  }
}

// Persist memory map to disk
function saveDB() {
  const exportData: Record<string, Record<string, WatchProgress>> = {};
  for (const [userId, userMap] of progressMap.entries()) {
    exportData[userId] = {};
    for (const [mediaId, progress] of userMap.entries()) {
      exportData[userId][mediaId] = progress;
    }
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(exportData, null, 2), 'utf-8');
}

// Run init immediately
initDB();

/**
 * Updates the watch progress for a user and media item.
 */
export async function updateProgress(
  userId: string = 'default_user', // Mock user since auth isn't fully integrated
  mediaId: string,
  timestamp: number,
  duration: number
): Promise<WatchProgress> {
  let userMap = progressMap.get(userId);
  if (!userMap) {
    userMap = new Map();
    progressMap.set(userId, userMap);
  }

  const progressPercentage = duration > 0 ? (timestamp / duration) * 100 : 0;

  const progressObj: WatchProgress = {
    userId,
    mediaId,
    timestamp,
    duration,
    progressPercentage: Math.min(100, progressPercentage),
    lastUpdated: new Date().toISOString(),
  };

  userMap.set(mediaId, progressObj);
  
  // Persist asynchronously to avoid blocking
  setImmediate(() => saveDB());

  return progressObj;
}

/**
 * Retrieves the watch progress for a specific user and media item.
 */
export async function getProgress(userId: string = 'default_user', mediaId: string): Promise<WatchProgress | null> {
  const userMap = progressMap.get(userId);
  if (!userMap) return null;
  return userMap.get(mediaId) || null;
}
