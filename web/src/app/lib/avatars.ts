// ─── PureVerse avatar system ──────────────────────────────
// Powered by the DiceBear avatar library (https://www.dicebear.com) — a
// proper, scalable avatar service: every (style, seed) pair deterministically
// renders unique artwork, so the catalog below is effectively infinite and
// users can also type their own seed to mint a personal avatar.

export interface AvatarCategory {
  key: string;
  label: string;
  style: string; // DiceBear style id
  seeds: string[];
}

const DICEBEAR = "https://api.dicebear.com/9.x";

export function avatarUrl(style: string, seed: string): string {
  return `${DICEBEAR}/${encodeURIComponent(style)}/svg?seed=${encodeURIComponent(
    seed
  )}&backgroundType=gradientLinear&backgroundColor=064e3b,0f766e,134e4a&radius=50`;
}

// Default avatar for brand-new users (seeded by their name → stable)
export function defaultAvatar(seed: string): string {
  return avatarUrl("adventurer", seed || "PureVerse");
}

// Curated anime-flavored seed sets per style category
const HEROES = [
  "Kira", "Aoi", "Ren", "Yuki", "Sora", "Hana", "Kaito", "Mei",
  "Riku", "Akira", "Nami", "Shiro", "Kenji", "Sakura", "Hiro", "Emi",
  "Tatsu", "Rin", "Daichi", "Yuna", "Kazu", "Mio", "Haru", "Aya",
];
const LEGENDS = [
  "Mugen", "Raiden", "Ezra", "Nova", "Orion", "Vega", "Atlas", "Lyra",
  "Zephyr", "Kael", "Iris", "Dante", "Luna", "Axel", "Suki", "Jin",
  "Mira", "Kuro", "Asuka", "Leo", "Noir", "Hikari", "Ryo", "Ivy",
];
const PIXELS = [
  "Bit", "Pixel", "Retro", "Arcade", "Glitch", "Neon", "Combo", "Turbo",
  "Blaster", "Quest", "Sprite", "Chip", "Zelda", "Mecha", "Drift", "Boss",
  "Coin", "Laser", "Hyper", "Vortex", "Crystal", "Ghost", "Ninja", "Storm",
];
const BOTS = [
  "Unit-7", "Proto", "Cyber", "Gizmo", "Servo", "Watt", "Volt", "Nano",
  "Echo", "Pulse", "Omega", "Astro", "Cog", "Spark", "Titan", "Zero",
  "Delta", "Ion", "Quark", "Robo", "Synth", "Flux", "Byte", "Core",
];

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { key: "heroes", label: "Anime Heroes", style: "adventurer", seeds: HEROES },
  { key: "portraits", label: "Portraits", style: "lorelei", seeds: LEGENDS },
  { key: "chibi", label: "Chibi", style: "big-ears", seeds: HEROES },
  { key: "sketch", label: "Sketch", style: "notionists", seeds: LEGENDS },
  { key: "pixel", label: "Pixel", style: "pixel-art", seeds: PIXELS },
  { key: "mecha", label: "Mecha", style: "bottts-neutral", seeds: BOTS },
  { key: "emoji", label: "Emoji", style: "fun-emoji", seeds: PIXELS },
  { key: "abstract", label: "Abstract", style: "shapes", seeds: BOTS },
];
