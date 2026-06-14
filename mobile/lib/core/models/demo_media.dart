// Sample playable media for the native-player preview.
//
// The production catalogue only exposes third-party iframe embeds (no direct
// stream URLs, audio tracks or subtitle tracks — see the player architecture
// notes), so the custom player is demonstrated against public HLS/VTT test
// assets. Each DemoMedia declares the audio (dub) and subtitle options that
// actually exist for it, so the player's menus are built dynamically and only
// show what's available — e.g. a Hindi dub appears only where it's defined.

/// One selectable audio / dub language. In this demo each dub is a separate
/// stream; in production these would be alternate audio renditions of one HLS.
class AudioOption {
  final String label; // e.g. "Japanese", "English (Dub)"
  final String language; // ISO code, e.g. "ja", "en", "hi"
  final String url; // HLS/MP4 stream for this audio
  const AudioOption(this.label, this.language, this.url);
}

/// One selectable subtitle track (external WebVTT).
class SubtitleOption {
  final String label; // e.g. "English"
  final String language; // ISO code
  final String url; // .vtt URL
  const SubtitleOption(this.label, this.language, this.url);
}

class DemoMedia {
  final String title;
  final String subtitle; // short descriptor shown in the chooser
  final List<AudioOption> audioTracks;
  final List<SubtitleOption> subtitleTracks;

  const DemoMedia({
    required this.title,
    required this.subtitle,
    required this.audioTracks,
    required this.subtitleTracks,
  });
}

// ─── Public test assets (fast, multi-bitrate HLS so quality variants appear
// and adaptive streaming keeps buffering low) ───
// Vidstack sprite-fight clip ships matching multi-language WebVTT subtitles.
const _spriteHls = 'https://files.vidstack.io/sprite-fight/hls/stream.m3u8';

// Distinct fast multi-bitrate HLS streams, used to stand in for separate dubs.
const _muxBunny = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
const _muxTos = 'https://test-streams.mux.dev/tos_ismc/main.m3u8';
const _sintel = 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8';

const demoCatalog = <DemoMedia>[
  // Subtitle-rich title: one audio, many subtitle languages (note: no Hindi).
  DemoMedia(
    title: 'Sprite Fight',
    subtitle: 'Movie demo · multiple subtitle languages',
    audioTracks: [
      AudioOption('Original', 'en', _spriteHls),
    ],
    subtitleTracks: [
      SubtitleOption('English', 'en', 'https://files.vidstack.io/sprite-fight/subs/english.vtt'),
      SubtitleOption('Spanish', 'es', 'https://files.vidstack.io/sprite-fight/subs/spanish.vtt'),
      SubtitleOption('French', 'fr', 'https://files.vidstack.io/sprite-fight/subs/french.vtt'),
    ],
  ),

  // Dub-rich "anime" title: multiple audio languages incl. a Hindi dub that the
  // movie above does NOT have — proving the menu is built per-title.
  DemoMedia(
    title: 'Aniverse Test Anime',
    subtitle: 'Anime demo · Japanese / English / Hindi dubs',
    audioTracks: [
      AudioOption('Japanese', 'ja', _muxBunny),
      AudioOption('English (Dub)', 'en', _sintel),
      AudioOption('Hindi (Dub)', 'hi', _muxTos),
    ],
    subtitleTracks: [
      SubtitleOption('English', 'en', 'https://files.vidstack.io/sprite-fight/subs/english.vtt'),
      SubtitleOption('Spanish', 'es', 'https://files.vidstack.io/sprite-fight/subs/spanish.vtt'),
    ],
  ),

  // Tracks-in-the-manifest title (Tears of Steel ships alternate audio + subs).
  DemoMedia(
    title: 'Tears of Steel',
    subtitle: 'Movie demo · adaptive HLS',
    audioTracks: [
      AudioOption('English', 'en', _muxTos),
    ],
    subtitleTracks: [
      SubtitleOption('English', 'en', 'https://files.vidstack.io/sprite-fight/subs/english.vtt'),
    ],
  ),
];
