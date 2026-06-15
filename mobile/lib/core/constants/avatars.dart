// ─── PureVerse avatar system (mirrors web/src/app/lib/avatars.ts) ──────────
// DiceBear (https://www.dicebear.com): every (style, seed) pair deterministically
// renders unique artwork, so the catalog is effectively infinite and users can
// type their own seed to mint a personal avatar.
//
// DiceBear serves SVG (the web <img> renders it directly), but Flutter's Image
// can't decode SVG without an extra package — so we STORE the same SVG url as
// the web (cross-platform consistent) and render the PNG variant on device via
// [renderableAvatar].

class AvatarCategory {
  final String key;
  final String label;
  final String style; // DiceBear style id
  final List<String> seeds;
  const AvatarCategory(this.key, this.label, this.style, this.seeds);
}

const String _dicebear = 'https://api.dicebear.com/9.x';

String avatarUrl(String style, String seed) =>
    '$_dicebear/${Uri.encodeComponent(style)}/svg'
    '?seed=${Uri.encodeComponent(seed)}'
    '&backgroundType=gradientLinear&backgroundColor=064e3b,0f766e,134e4a&radius=50';

/// Default avatar for a brand-new user — seeded by their name so it's stable.
String defaultAvatar(String seed) =>
    avatarUrl('adventurer', seed.trim().isEmpty ? 'PureVerse' : seed);

/// Flutter can't render DiceBear's SVG, so swap to the PNG endpoint for display.
/// Web-set SVG avatars and locally-minted ones both render this way; non-DiceBear
/// urls pass through unchanged.
String renderableAvatar(String url) {
  if (url.contains('api.dicebear.com') && url.contains('/svg?')) {
    return url.replaceFirst('/svg?', '/png?');
  }
  return url;
}

const List<String> _heroes = [
  'Kira', 'Aoi', 'Ren', 'Yuki', 'Sora', 'Hana', 'Kaito', 'Mei',
  'Riku', 'Akira', 'Nami', 'Shiro', 'Kenji', 'Sakura', 'Hiro', 'Emi',
  'Tatsu', 'Rin', 'Daichi', 'Yuna', 'Kazu', 'Mio', 'Haru', 'Aya',
];
const List<String> _legends = [
  'Mugen', 'Raiden', 'Ezra', 'Nova', 'Orion', 'Vega', 'Atlas', 'Lyra',
  'Zephyr', 'Kael', 'Iris', 'Dante', 'Luna', 'Axel', 'Suki', 'Jin',
  'Mira', 'Kuro', 'Asuka', 'Leo', 'Noir', 'Hikari', 'Ryo', 'Ivy',
];
const List<String> _pixels = [
  'Bit', 'Pixel', 'Retro', 'Arcade', 'Glitch', 'Neon', 'Combo', 'Turbo',
  'Blaster', 'Quest', 'Sprite', 'Chip', 'Zelda', 'Mecha', 'Drift', 'Boss',
  'Coin', 'Laser', 'Hyper', 'Vortex', 'Crystal', 'Ghost', 'Ninja', 'Storm',
];
const List<String> _bots = [
  'Unit-7', 'Proto', 'Cyber', 'Gizmo', 'Servo', 'Watt', 'Volt', 'Nano',
  'Echo', 'Pulse', 'Omega', 'Astro', 'Cog', 'Spark', 'Titan', 'Zero',
  'Delta', 'Ion', 'Quark', 'Robo', 'Synth', 'Flux', 'Byte', 'Core',
];

const List<AvatarCategory> avatarCategories = [
  AvatarCategory('heroes', 'Anime Heroes', 'adventurer', _heroes),
  AvatarCategory('portraits', 'Portraits', 'lorelei', _legends),
  AvatarCategory('chibi', 'Chibi', 'big-ears', _heroes),
  AvatarCategory('sketch', 'Sketch', 'notionists', _legends),
  AvatarCategory('pixel', 'Pixel', 'pixel-art', _pixels),
  AvatarCategory('mecha', 'Mecha', 'bottts-neutral', _bots),
  AvatarCategory('emoji', 'Emoji', 'fun-emoji', _pixels),
  AvatarCategory('abstract', 'Abstract', 'shapes', _bots),
];
