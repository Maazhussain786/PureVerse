import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/stream_source.dart';
import '../../../../core/models/watch_history.dart';
import '../../../../core/services/stream_extractor.dart';
import '../../../../features/user/user_state.dart';
import '../../../../shared/providers/api_providers.dart';
import '../widgets/episode_picker_sheet.dart';
import '../widgets/player_controls.dart';
import 'embed_player_screen.dart';

enum _Phase { loadingSources, extracting, playing }

/// Real-catalogue player. Resolves a provider embed to a direct stream on the
/// device (see [StreamExtractor]) and plays it in the premium media_kit player.
/// Falls back to the iframe [EmbedPlayerScreen] when no direct stream can be
/// captured (e.g. DRM providers).
///
/// For series / anime it also offers in-player season + episode switching and
/// persists resume progress to the synced watch history.
class CatalogPlayerScreen extends ConsumerStatefulWidget {
  final String mediaType; // movie | tv | anime
  final String mediaId;
  final String title;
  final String posterUrl;
  final double rating;
  final int releaseYear;
  final int? totalSeasons;
  final int? season;
  final int? episode;
  final String? episodeTitle;

  const CatalogPlayerScreen({
    super.key,
    required this.mediaType,
    required this.mediaId,
    required this.title,
    this.posterUrl = '',
    this.rating = 0,
    this.releaseYear = 0,
    this.totalSeasons,
    this.season,
    this.episode,
    this.episodeTitle,
  });

  @override
  ConsumerState<CatalogPlayerScreen> createState() =>
      _CatalogPlayerScreenState();
}

class _CatalogPlayerScreenState extends ConsumerState<CatalogPlayerScreen> {
  late final Player _player = Player(
    configuration: const PlayerConfiguration(bufferSize: 64 * 1024 * 1024),
  );
  late final VideoController _controller = VideoController(_player);
  final List<StreamSubscription> _subs = [];

  _Phase _phase = _Phase.loadingSources;
  String _status = 'Loading…';
  List<StreamSource> _servers = const [];
  int _serverIndex = 0;
  ExtractedStream? _stream;

  // Mutable playback target (season/episode can change from inside the player).
  late int? _season = widget.season;
  late int? _episode = widget.episode;
  late String? _episodeTitle = widget.episodeTitle;
  bool get _isSeries =>
      widget.mediaType == 'tv' || widget.mediaType == 'anime';

  // Resume + progress persistence.
  Duration _resumeAt = Duration.zero;
  Timer? _progressTimer;
  bool _tuned = false;

  // Tracks surfaced by libmpv once a stream is playing.
  List<VideoTrack> _videoTracks = [];
  List<AudioTrack> _audioTracks = [];
  List<SubtitleTrack> _subTracks = [];
  String _qualityId = 'auto';
  String _audioId = 'auto';
  String _subKey = 'off'; // off | emb:<id> | ext:<url>

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _playing = false;
  bool _buffering = true;
  bool _dragging = false;

  bool _controlsVisible = true;
  Timer? _hideTimer;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

    _subs.add(_player.stream.position.listen((p) {
      if (mounted && !_dragging) setState(() => _position = p);
    }));
    _subs.add(_player.stream.duration.listen((d) {
      if (mounted) setState(() => _duration = d);
    }));
    _subs.add(_player.stream.playing.listen((p) {
      if (mounted) setState(() => _playing = p);
    }));
    _subs.add(_player.stream.buffering.listen((b) {
      if (mounted) setState(() => _buffering = b);
    }));
    _subs.add(_player.stream.tracks.listen((t) {
      if (!mounted) return;
      setState(() {
        _videoTracks = t.video
            .where((v) => v.id != 'auto' && v.id != 'no' && (v.h ?? 0) > 0)
            .toList();
        _audioTracks =
            t.audio.where((a) => a.id != 'auto' && a.id != 'no').toList();
        _subTracks =
            t.subtitle.where((s) => s.id != 'auto' && s.id != 'no').toList();
      });
    }));

    _resumeFromHistory();
    _start();
    _restartHideTimer();

    // Persist resume progress periodically while watching.
    _progressTimer = Timer.periodic(
        const Duration(seconds: 12), (_) => _saveProgress());
  }

  @override
  void dispose() {
    _saveProgress();
    _progressTimer?.cancel();
    _hideTimer?.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    _player.dispose();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  /// Seek to where this title was last left off (if under 95% watched).
  void _resumeFromHistory() {
    final key = historyKey(widget.mediaId, _season, _episode);
    int pos = 0;
    for (final h in ref.read(userStateProvider).history) {
      if (h.key == key && h.progress < 95) {
        pos = h.positionSec ?? 0;
        break;
      }
    }
    if (pos > 5) _resumeAt = Duration(seconds: pos);
  }

  /// Upsert the current position into watch history (keyed by id:season:episode).
  void _saveProgress() {
    final dur = _duration.inSeconds;
    final pos = _position.inSeconds;
    if (dur <= 0 || pos <= 0) return;
    final pct = ((pos / dur) * 100).clamp(0, 100).round();
    try {
      ref.read(userStateProvider.notifier).addToHistory(
            WatchHistoryItem.create(
              id: widget.mediaId,
              type: widget.mediaType,
              title: widget.title,
              posterUrl: widget.posterUrl,
              rating: widget.rating,
              releaseYear: widget.releaseYear,
              season: _season,
              episode: _episode,
              episodeTitle: _episodeTitle,
              progress: pct,
              positionSec: pos,
              durationSec: dur,
            ),
          );
    } catch (_) {/* provider may be gone during teardown */}
  }

  /// libmpv tuning for fast start + low rebuffering on mobile: hardware
  /// decoding, a generous read-ahead cache, and HTTP auto-reconnect so a
  /// dropped CDN segment resumes instead of stalling. Applied once.
  Future<void> _tunePlayer() async {
    if (_tuned) return;
    _tuned = true;
    final platform = _player.platform;
    if (platform is! NativePlayer) return;
    Future<void> set(String k, String v) async {
      try {
        await platform.setProperty(k, v);
      } catch (_) {/* unknown prop on this build — ignore */}
    }

    await set('hwdec', 'auto-safe'); // GPU decode, falls back to software
    await set('cache', 'yes');
    await set('demuxer-readahead-secs', '30'); // prefetch ~30s ahead
    await set('demuxer-max-back-bytes', '${16 * 1024 * 1024}');
    await set('network-timeout', '30');
    // Reconnect transparently on transient HTTP/CDN errors.
    await set('stream-lavf-o',
        'reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_delay_max=5');
  }

  // ─── Resolve → extract → play ───
  Future<void> _start() async {
    await _tunePlayer();
    if (!mounted) return;
    setState(() {
      _phase = _Phase.loadingSources;
      _status = 'Loading sources…';
    });
    try {
      final payload = await ref.read(apiClientProvider).getStream(
            widget.mediaType,
            widget.mediaId,
            season: _season,
            episode: _episode,
          );
      final embeds = payload.sources.where((s) => s.isEmbed).toList();
      if (embeds.isEmpty) {
        _fallback();
        return;
      }
      if (!mounted) return;
      setState(() => _servers = embeds);
      _extractServer(0);
    } catch (_) {
      _fallback();
    }
  }

  Future<void> _extractServer(int index) async {
    if (index < 0 || index >= _servers.length) {
      _fallback();
      return;
    }
    setState(() {
      _serverIndex = index;
      _phase = _Phase.extracting;
      _status = 'Finding a stream on ${_servers[index].server}…';
      _qualityId = 'auto';
      _audioId = 'auto';
      _subKey = 'off';
      _videoTracks = [];
      _audioTracks = [];
      _subTracks = [];
    });

    final result = await StreamExtractor.extract(_servers[index].url);
    if (!mounted) return;

    if (result == null) {
      // Try the next server, or give up to the iframe player.
      if (index + 1 < _servers.length) {
        _extractServer(index + 1);
      } else {
        _fallback();
      }
      return;
    }

    _stream = result;
    await _player.open(
      Media(result.url, httpHeaders: result.headers),
      play: true,
    );
    // Resume where the user left off (initial load only).
    if (_resumeAt > const Duration(seconds: 5)) {
      await _player.seek(_resumeAt);
    }
    if (!mounted) return;
    setState(() => _phase = _Phase.playing);
  }

  /// Hand off to the iframe player when no direct stream is available.
  void _fallback() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(
      builder: (_) => EmbedPlayerScreen(
        mediaType: widget.mediaType,
        mediaId: widget.mediaId,
        title: widget.title,
        posterUrl: widget.posterUrl,
        rating: widget.rating,
        releaseYear: widget.releaseYear,
        totalSeasons: widget.totalSeasons,
        season: _season,
        episode: _episode,
        episodeTitle: _episodeTitle,
      ),
    ));
  }

  // ─── Season / episode switching ───
  void _openEpisodes() {
    _hideTimer?.cancel();
    showEpisodePicker(
      context,
      mediaId: widget.mediaId,
      totalSeasons: widget.totalSeasons ?? 1,
      currentSeason: _season ?? 1,
      currentEpisode: _episode ?? 1,
      onSelect: _changeEpisode,
    ).whenComplete(_restartHideTimer);
  }

  void _changeEpisode(int season, int episode, String? title) {
    if (season == _season && episode == _episode) return;
    _saveProgress(); // checkpoint the outgoing episode
    setState(() {
      _season = season;
      _episode = episode;
      _episodeTitle = title;
      _resumeAt = Duration.zero;
      _position = Duration.zero;
      _duration = Duration.zero;
    });
    // Seed a fresh history entry so Continue Watching reflects the switch.
    ref.read(userStateProvider.notifier).addToHistory(
          WatchHistoryItem.create(
            id: widget.mediaId,
            type: widget.mediaType,
            title: widget.title,
            posterUrl: widget.posterUrl,
            rating: widget.rating,
            releaseYear: widget.releaseYear,
            season: season,
            episode: episode,
            episodeTitle: title,
          ),
        );
    _start();
  }

  // ─── Track selection ───
  void _selectQuality(VideoTrack t) {
    setState(() => _qualityId = t.id);
    _player.setVideoTrack(t);
    _restartHideTimer();
  }

  void _selectAudio(AudioTrack t) {
    setState(() => _audioId = t.id);
    _player.setAudioTrack(t);
    _restartHideTimer();
  }

  void _selectEmbeddedSub(SubtitleTrack? t) {
    setState(() => _subKey = t == null ? 'off' : 'emb:${t.id}');
    _player.setSubtitleTrack(t ?? SubtitleTrack.no());
    _restartHideTimer();
  }

  void _selectExternalSub(ExtractedSubtitle s) {
    setState(() => _subKey = 'ext:${s.url}');
    _player.setSubtitleTrack(
        SubtitleTrack.uri(s.url, title: s.label, language: s.language));
    _restartHideTimer();
  }

  // ─── Controls visibility ───
  void _togglePlay() {
    _player.playOrPause();
    _restartHideTimer();
  }

  void _skip(Duration delta) {
    var target = _position + delta;
    if (target < Duration.zero) target = Duration.zero;
    if (_duration > Duration.zero && target > _duration) target = _duration;
    _player.seek(target);
    setState(() => _position = target);
    _restartHideTimer();
  }

  void _restartHideTimer() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _playing && !_dragging) {
        setState(() => _controlsVisible = false);
      }
    });
  }

  void _toggleControls() {
    setState(() => _controlsVisible = !_controlsVisible);
    if (_controlsVisible) _restartHideTimer();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _phase == _Phase.playing ? _playerView() : _statusView(),
    );
  }

  Widget _statusView() {
    return SafeArea(
      child: Stack(
        children: [
          Align(
            alignment: Alignment.topLeft,
            child: PlayerIconButton(
              icon: Icons.arrow_back_rounded,
              tooltip: 'Back',
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const CircularProgressIndicator(color: AppColors.accent),
                const SizedBox(height: 18),
                Text(widget.title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600),
                    textAlign: TextAlign.center),
                const SizedBox(height: 6),
                Text(_status,
                    style: const TextStyle(
                        color: AppColors.textSecondary, fontSize: 12),
                    textAlign: TextAlign.center),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _playerView() {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _toggleControls,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Center(
            child: Video(
              controller: _controller,
              controls: NoVideoControls,
              fit: BoxFit.contain,
            ),
          ),
          if (_buffering && !_controlsVisible)
            const Center(
                child: CircularProgressIndicator(color: AppColors.accent)),
          AnimatedOpacity(
            opacity: _controlsVisible ? 1 : 0,
            duration: const Duration(milliseconds: 220),
            child: IgnorePointer(
              ignoring: !_controlsVisible,
              child: PlayerControlsOverlay(
                title: _episodeLabel(),
                playing: _playing,
                buffering: _buffering,
                position: _position,
                duration: _duration,
                onBack: () => Navigator.of(context).maybePop(),
                onTogglePlay: _togglePlay,
                onSkipBack: () => _skip(const Duration(seconds: -10)),
                onSkipFwd: () => _skip(const Duration(seconds: 10)),
                onOpenSettings: _openSettings,
                onOpenEpisodes: _isSeries ? _openEpisodes : null,
                onScrubStart: () {
                  _dragging = true;
                  _hideTimer?.cancel();
                },
                onScrubUpdate: (v) =>
                    setState(() => _position = Duration(milliseconds: v.toInt())),
                onScrubEnd: (v) {
                  _dragging = false;
                  _player.seek(Duration(milliseconds: v.toInt()));
                  _restartHideTimer();
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _episodeLabel() {
    if (_episode != null) {
      final s = _season != null ? 'S$_season ' : '';
      final t = (_episodeTitle != null && _episodeTitle!.isNotEmpty)
          ? '  •  $_episodeTitle'
          : '';
      return '${widget.title}  •  $s' 'E$_episode$t';
    }
    return widget.title;
  }

  // ─── Settings sheet (quality / audio / subtitles / servers) ───
  void _openSettings() {
    _hideTimer?.cancel();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.textMuted,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 18),

                _heading(Icons.high_quality_rounded, 'Quality'),
                const SizedBox(height: 10),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  PlayerChip(
                      label: 'Auto',
                      active: _qualityId == 'auto',
                      onTap: () {
                        Navigator.pop(context);
                        _selectQuality(VideoTrack.auto());
                      }),
                  ..._uniqueQualities().map((v) => PlayerChip(
                        label: '${v.h}p',
                        active: _qualityId == v.id,
                        onTap: () {
                          Navigator.pop(context);
                          _selectQuality(v);
                        },
                      )),
                ]),

                if (_audioTracks.length > 1) ...[
                  const SizedBox(height: 22),
                  _heading(Icons.graphic_eq_rounded, 'Audio'),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: _audioTracks
                        .map((a) => PlayerChip(
                              label: _trackLabel(a.language, a.title, a.id),
                              active: _audioId == a.id,
                              onTap: () {
                                Navigator.pop(context);
                                _selectAudio(a);
                              },
                            ))
                        .toList(),
                  ),
                ],

                const SizedBox(height: 22),
                _heading(Icons.subtitles_rounded, 'Subtitles'),
                const SizedBox(height: 10),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  PlayerChip(
                      label: 'Off',
                      active: _subKey == 'off',
                      onTap: () {
                        Navigator.pop(context);
                        _selectEmbeddedSub(null);
                      }),
                  ..._subTracks.map((s) => PlayerChip(
                        label: _trackLabel(s.language, s.title, s.id),
                        active: _subKey == 'emb:${s.id}',
                        onTap: () {
                          Navigator.pop(context);
                          _selectEmbeddedSub(s);
                        },
                      )),
                  ...(_stream?.subtitles ?? const <ExtractedSubtitle>[])
                      .map((s) => PlayerChip(
                            label: s.label,
                            active: _subKey == 'ext:${s.url}',
                            onTap: () {
                              Navigator.pop(context);
                              _selectExternalSub(s);
                            },
                          )),
                ]),

                if (_servers.length > 1) ...[
                  const SizedBox(height: 22),
                  _heading(Icons.dns_rounded, 'Server'),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (int i = 0; i < _servers.length; i++)
                        PlayerChip(
                          label: _servers[i].server.isEmpty
                              ? 'Server ${i + 1}'
                              : _servers[i].server,
                          active: i == _serverIndex,
                          onTap: () {
                            Navigator.pop(context);
                            if (i != _serverIndex) _extractServer(i);
                          },
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ).whenComplete(_restartHideTimer);
  }

  List<VideoTrack> _uniqueQualities() {
    final seen = <int>{};
    final out = <VideoTrack>[];
    final sorted = [..._videoTracks]
      ..sort((a, b) => (b.h ?? 0).compareTo(a.h ?? 0));
    for (final v in sorted) {
      final h = v.h ?? 0;
      if (h > 0 && seen.add(h)) out.add(v);
    }
    return out;
  }

  String _trackLabel(String? language, String? title, String id) {
    final l = (language ?? '').trim();
    final t = (title ?? '').trim();
    if (l.isNotEmpty && l.toLowerCase() != 'und') return l;
    if (t.isNotEmpty) return t;
    return 'Track $id';
  }

  Widget _heading(IconData icon, String text) => Row(
        children: [
          Icon(icon, color: AppColors.accent, size: 18),
          const SizedBox(width: 8),
          Text(text,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700)),
        ],
      );
}
