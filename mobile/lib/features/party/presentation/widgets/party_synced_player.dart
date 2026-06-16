import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/services/stream_extractor.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../player/presentation/widgets/player_controls.dart';
import '../../application/party_controller.dart';
import '../../data/party_models.dart';

// Sync thresholds (mirror the backend constants; see the plan).
const double _seekTol = 1.0; // hard-seek when off by more than this on a command
const double _driftSeek = 1.25; // hard-seek when free-running drift exceeds this

/// The synced watch-party player. Resolves a direct HLS stream on-device
/// (reusing [StreamExtractor] + the libmpv tuning from the catalogue player) and
/// plays it in a controllable media_kit [Player], driven by the shared party
/// playback clock instead of local controls:
///  • applies remote play / pause / seek / hold / resume commands,
///  • reports its own buffering + position to the auto-wait coordinator,
///  • only emits transport changes when the member is allowed to control.
class PartySyncedPlayer extends ConsumerStatefulWidget {
  const PartySyncedPlayer({super.key});

  @override
  ConsumerState<PartySyncedPlayer> createState() => _PartySyncedPlayerState();
}

enum _Phase { loading, playing, unsupported }

class _PartySyncedPlayerState extends ConsumerState<PartySyncedPlayer> {
  late final Player _player = Player(
    configuration: const PlayerConfiguration(bufferSize: 64 * 1024 * 1024),
  );
  late final VideoController _controller = VideoController(_player);
  final List<StreamSubscription> _subs = [];

  _Phase _phase = _Phase.loading;
  String _status = 'Loading…';
  String? _loadedKey; // streamKey currently loaded
  bool _tuned = false;
  int _appliedEpoch = 0;

  // Local player state.
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _playing = false;
  bool _buffering = true;
  bool _dragging = false;

  // Subtitle / quality menus (local — each viewer chooses their own).
  List<VideoTrack> _videoTracks = [];
  List<SubtitleTrack> _subTracks = [];
  List<ExtractedSubtitle> _externalSubs = const [];
  String _qualityId = 'auto';
  String _subKey = 'off';
  double _subOffset = 0.0; // subtitle delay in seconds (+ = later, − = earlier)

  // Controls visibility.
  bool _controlsVisible = true;
  Timer? _hideTimer;
  Timer? _heartbeat;
  Timer? _bufferDebounce;

  PartyController get _ctrl => ref.read(partyControllerProvider.notifier);

  @override
  void initState() {
    super.initState();
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
      _onBufferingChanged(b);
    }));
    _subs.add(_player.stream.tracks.listen((t) {
      if (!mounted) return;
      setState(() {
        _videoTracks = t.video
            .where((v) => v.id != 'auto' && v.id != 'no' && (v.h ?? 0) > 0)
            .toList();
        _subTracks =
            t.subtitle.where((s) => s.id != 'auto' && s.id != 'no').toList();
      });
    }));

    // Initial load once the first frame is up (provider is readable then).
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeLoad());

    // Periodic sync: report our buffering/position; the host also advances the
    // authoritative clock; correct free-running drift.
    _heartbeat = Timer.periodic(const Duration(seconds: 4), (_) => _tick());
    _restartHideTimer();
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _heartbeat?.cancel();
    _bufferDebounce?.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    _player.dispose();
    super.dispose();
  }

  // ─── Stream resolution (reuses the catalogue player approach) ───
  Future<void> _tunePlayer() async {
    if (_tuned) return;
    _tuned = true;
    final platform = _player.platform;
    if (platform is! NativePlayer) return;
    Future<void> set(String k, String v) async {
      try {
        await platform.setProperty(k, v);
      } catch (_) {}
    }

    await set('hwdec', 'auto-safe');
    await set('cache', 'yes');
    await set('demuxer-readahead-secs', '20');
    await set('demuxer-max-back-bytes', '${16 * 1024 * 1024}');
    await set('network-timeout', '30');
    await set('cache-pause-initial', 'no');
    await set('demuxer-lavf-analyzeduration', '1');
    await set('demuxer-lavf-probesize', '2000000');
    await set('stream-lavf-o',
        'reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_delay_max=5');
  }

  Future<void> _maybeLoad() async {
    final media = ref.read(partyControllerProvider).room?.media;
    if (media == null) return;
    if (media.streamKey == _loadedKey) return;
    await _load(media);
  }

  Future<void> _load(PartyMedia media) async {
    _loadedKey = media.streamKey;
    await _tunePlayer();
    if (!mounted) return;
    setState(() {
      _phase = _Phase.loading;
      _status = 'Loading sources…';
      _qualityId = 'auto';
      _subKey = 'off';
      _videoTracks = [];
      _subTracks = [];
      _externalSubs = const [];
    });

    try {
      final payload = await ref.read(apiClientProvider).getStream(
            media.type,
            media.id,
            season: media.season,
            episode: media.episode,
          );
      if (!mounted || media.streamKey != _loadedKey) return;

      final direct =
          payload.sources.where((s) => s.isDirect && s.url.isNotEmpty).toList();
      _externalSubs = payload.subtitles
          .where((s) => s.url.isNotEmpty)
          .map((s) => ExtractedSubtitle(s.lang, _langCode(s.lang), s.url))
          .toList();

      // PRIMARY: a server-scraped direct stream, matching the party's category.
      if (direct.isNotEmpty) {
        final want = media.category;
        final src = direct.firstWhere(
          (s) => want != null && s.category == want,
          orElse: () => direct.first,
        );
        await _open(src.url, src.headers, media);
        if ((src.category ?? want) == 'sub') _autoEnableEnglishSub();
        return;
      }

      // SECONDARY: extract a playable stream from a provider embed on-device.
      final embeds = payload.sources.where((s) => s.isEmbed).toList();
      for (final embed in embeds) {
        if (!mounted || media.streamKey != _loadedKey) return;
        setState(() => _status = 'Finding a stream on ${embed.server}…');
        final result = await StreamExtractor.extract(embed.url);
        if (result != null) {
          if (result.subtitles.isNotEmpty) _externalSubs = result.subtitles;
          await _open(result.url, result.headers, media);
          return;
        }
      }
      // Nothing playable on-device (DRM/blob) — can't hard-sync here.
      if (mounted) setState(() => _phase = _Phase.unsupported);
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.unsupported);
    }
  }

  Future<void> _open(String url, Map<String, String> headers, PartyMedia media) async {
    await _player.open(Media(url, httpHeaders: headers), play: false);
    if (!mounted) return;
    // Align to the live party position, then match the party's play state.
    final pb = ref.read(partyControllerProvider).room?.playback;
    final target = pb?.livePosition ?? 0;
    if (target > 1) await _player.seek(Duration(milliseconds: (target * 1000).round()));
    final holding = ref.read(partyControllerProvider).holding;
    if ((pb?.isPlaying ?? false) && !holding) {
      await _player.play();
    }
    if (mounted) setState(() => _phase = _Phase.playing);
    _loadBackendSubtitles(media);
  }

  // ─── Sync application ───
  void _applyCommand(SyncCommand cmd) {
    if (cmd.epoch <= _appliedEpoch || _phase != _Phase.playing) return;
    _appliedEpoch = cmd.epoch;
    final localSec = _position.inMilliseconds / 1000.0;
    if ((localSec - cmd.positionSec).abs() > _seekTol) {
      _player.seek(Duration(milliseconds: (cmd.positionSec * 1000).round()));
    }
    if (cmd.isPlaying && !_playing) {
      _player.play();
    } else if (!cmd.isPlaying && _playing) {
      _player.pause();
    }
  }

  void _tick() {
    if (_phase != _Phase.playing) return;
    final sec = _position.inMilliseconds / 1000.0;
    final st = ref.read(partyControllerProvider);
    _ctrl.reportBuffering(_buffering, sec);
    if (st.isHost) _ctrl.emitPosition(sec, _playing);

    // Correct free-running drift (only while everyone is meant to be playing).
    final pb = st.room?.playback;
    if (pb != null && pb.isPlaying && !st.holding && !_buffering && !_dragging) {
      final drift = sec - pb.livePosition;
      if (drift.abs() > _driftSeek) {
        _player.seek(Duration(milliseconds: (pb.livePosition * 1000).round()));
      }
    }
  }

  void _onBufferingChanged(bool buffering) {
    _bufferDebounce?.cancel();
    _bufferDebounce = Timer(const Duration(milliseconds: 600), () {
      if (!mounted || _phase != _Phase.playing) return;
      _ctrl.reportBuffering(buffering, _position.inMilliseconds / 1000.0);
    });
  }

  // ─── User transport (gated by canControl) ───
  void _togglePlay() {
    final st = ref.read(partyControllerProvider);
    if (!st.canControl) {
      _lockToast();
      return;
    }
    final playing = st.room?.playback.isPlaying ?? false;
    _ctrl.emitPlayback(playing ? 'pause' : 'play');
    _restartHideTimer();
  }

  void _seekTo(double sec) {
    final st = ref.read(partyControllerProvider);
    if (!st.canControl) {
      _lockToast();
      return;
    }
    _ctrl.emitPlayback('seek', positionSec: sec);
    _restartHideTimer();
  }

  void _skip(int seconds) {
    final base = _position.inMilliseconds / 1000.0;
    final target = (base + seconds).clamp(0, _duration.inMilliseconds / 1000.0);
    _seekTo(target.toDouble());
  }

  void _lockToast() {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(
        content: Text('Only the host can control playback'),
        duration: Duration(seconds: 2),
      ));
  }

  // ─── Subtitles (local) ───
  void _autoEnableEnglishSub() {
    if (_subKey != 'off') return;
    for (final s in _externalSubs) {
      if (s.language == 'en' || s.label.toLowerCase().contains('eng')) {
        _selectExternalSub(s);
        return;
      }
    }
  }

  Future<void> _loadBackendSubtitles(PartyMedia media) async {
    if (media.type != 'movie' && media.type != 'tv') return;
    try {
      final subs = await ref.read(apiClientProvider).getSubtitles(
            media.type,
            media.id,
            season: media.season,
            episode: media.episode,
          );
      if (!mounted || subs.isEmpty || media.streamKey != _loadedKey) return;
      final seen = {for (final s in _externalSubs) s.url};
      setState(() {
        _externalSubs = [
          ..._externalSubs,
          for (final s in subs)
            if (s.url.isNotEmpty && seen.add(s.url))
              ExtractedSubtitle(s.lang, _langCode(s.lang), s.url),
        ];
      });
      if (_subKey == 'off') _autoEnableEnglishSub();
    } catch (_) {}
  }

  void _selectQuality(VideoTrack t) {
    setState(() => _qualityId = t.id);
    _player.setVideoTrack(t);
  }

  void _selectEmbeddedSub(SubtitleTrack? t) {
    setState(() => _subKey = t == null ? 'off' : 'emb:${t.id}');
    _player.setSubtitleTrack(t ?? SubtitleTrack.no());
  }

  void _selectExternalSub(ExtractedSubtitle s) {
    setState(() => _subKey = 'ext:${s.url}');
    _player.setSubtitleTrack(
        SubtitleTrack.uri(s.url, title: s.label, language: s.language));
  }

  /// Shift subtitle timing (mpv `sub-delay`, seconds) so subs line up with the
  /// video — handy in a party where streams start a touch out of sync.
  Future<void> _applySubDelay() async {
    final p = _player.platform;
    if (p is NativePlayer) {
      try {
        await p.setProperty('sub-delay', _subOffset.toStringAsFixed(2));
      } catch (_) {/* property unavailable on this build */}
    }
  }

  static String _langCode(String lang) {
    final l = lang.toLowerCase();
    if (l.startsWith('eng')) return 'en';
    if (l.startsWith('spa')) return 'es';
    if (l.startsWith('fre') || l.startsWith('fra')) return 'fr';
    if (l.startsWith('ger') || l.startsWith('deu')) return 'de';
    if (l.startsWith('por')) return 'pt';
    if (l.startsWith('ara')) return 'ar';
    if (l.startsWith('hin')) return 'hi';
    if (l.startsWith('jpn') || l.startsWith('jap')) return 'ja';
    return 'und';
  }

  // ─── Controls visibility ───
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
    // React to remote transport commands + media (episode/source/category) changes.
    ref.listen<SyncCommand?>(partyControllerProvider.select((s) => s.command),
        (_, cmd) {
      if (cmd != null) _applyCommand(cmd);
    });
    ref.listen<String?>(
        partyControllerProvider.select((s) => s.room?.media.streamKey),
        (_, key) {
      if (key != null && key != _loadedKey) _maybeLoad();
    });

    final st = ref.watch(partyControllerProvider);
    final holding = st.holding;
    final partyPlaying = st.room?.playback.isPlaying ?? false;

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: ColoredBox(
        color: Colors.black,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: _toggleControls,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_phase == _Phase.playing)
                Center(
                  child: Video(
                      controller: _controller,
                      controls: NoVideoControls,
                      fit: BoxFit.contain),
                )
              else if (_phase == _Phase.unsupported)
                _unsupportedView()
              else
                _loadingView(),

              if (_phase == _Phase.playing) ...[
                if (_buffering && !_controlsVisible)
                  const Center(
                      child: CircularProgressIndicator(color: AppColors.accent)),
                AnimatedOpacity(
                  opacity: _controlsVisible ? 1 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: IgnorePointer(
                    ignoring: !_controlsVisible,
                    child: _overlay(st, partyPlaying),
                  ),
                ),
                if (holding) _holdOverlay(st),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _loadingView() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.accent),
            const SizedBox(height: 14),
            Text(_status,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12)),
          ],
        ),
      );

  Widget _unsupportedView() => const Center(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.sync_problem_rounded, color: AppColors.textMuted, size: 40),
              SizedBox(height: 10),
              Text("This title can't be hard-synced here",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
              SizedBox(height: 4),
              Text('The host can switch episode/server, or watch it normally.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ],
          ),
        ),
      );

  Widget _overlay(PartyState st, bool partyPlaying) {
    final canControl = st.canControl;
    final maxMs =
        _duration.inMilliseconds > 0 ? _duration.inMilliseconds.toDouble() : 1.0;
    final value =
        _position.inMilliseconds.clamp(0, _duration.inMilliseconds).toDouble();

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.5),
            Colors.transparent,
            Colors.black.withValues(alpha: 0.6),
          ],
          stops: const [0, 0.5, 1],
        ),
      ),
      child: Column(
        children: [
          // Top row: party state pill + settings.
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 6, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(AppRadii.full),
                  ),
                  child: Text(
                    partyPlaying ? '● LIVE' : '❚❚ PAUSED',
                    style: TextStyle(
                      color: partyPlaying ? AppColors.teal : AppColors.textSecondary,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const Spacer(),
                PlayerIconButton(
                    icon: Icons.settings_rounded,
                    tooltip: 'Quality & subtitles',
                    onTap: _openSettings),
              ],
            ),
          ),
          // Center transport.
          Expanded(
            child: Center(
              child: _buffering
                  ? const SizedBox(
                      width: 52,
                      height: 52,
                      child: CircularProgressIndicator(
                          color: AppColors.accent, strokeWidth: 3))
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        PlayerIconButton(
                            icon: Icons.replay_10_rounded,
                            size: 30,
                            tooltip: 'Back 10s',
                            onTap: () => _skip(-10)),
                        const SizedBox(width: 28),
                        Material(
                          color: Colors.white.withValues(alpha: 0.12),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _togglePlay,
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Icon(
                                partyPlaying
                                    ? Icons.pause_rounded
                                    : Icons.play_arrow_rounded,
                                color: canControl ? Colors.white : Colors.white38,
                                size: 38,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 28),
                        PlayerIconButton(
                            icon: Icons.forward_10_rounded,
                            size: 30,
                            tooltip: 'Forward 10s',
                            onTap: () => _skip(10)),
                      ],
                    ),
            ),
          ),
          // Scrubber.
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
            child: Row(
              children: [
                Text(formatDuration(_position),
                    style: const TextStyle(color: Colors.white, fontSize: 11)),
                Expanded(
                  child: SliderTheme(
                    data: SliderThemeData(
                      trackHeight: 4,
                      activeTrackColor: AppColors.accent,
                      inactiveTrackColor: Colors.white.withValues(alpha: 0.25),
                      thumbColor: AppColors.accent,
                      overlayColor: AppColors.accentGlow,
                      thumbShape:
                          const RoundSliderThumbShape(enabledThumbRadius: 7),
                    ),
                    child: Slider(
                      min: 0,
                      max: maxMs,
                      value: value.clamp(0, maxMs),
                      onChangeStart: canControl
                          ? (_) {
                              _dragging = true;
                              _hideTimer?.cancel();
                            }
                          : null,
                      onChanged: canControl
                          ? (v) => setState(
                              () => _position = Duration(milliseconds: v.toInt()))
                          : null,
                      onChangeEnd: canControl
                          ? (v) {
                              _dragging = false;
                              _seekTo(v / 1000.0);
                            }
                          : null,
                    ),
                  ),
                ),
                Text(formatDuration(_duration),
                    style: const TextStyle(color: Colors.white, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _holdOverlay(PartyState st) {
    final who = st.buffering.isNotEmpty ? st.buffering.first.name : 'someone';
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.6),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                  width: 34,
                  height: 34,
                  child: CircularProgressIndicator(
                      color: AppColors.teal, strokeWidth: 3)),
              const SizedBox(height: 14),
              Text('Waiting for $who to catch up…',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600)),
              if (st.isHost) ...[
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => _ctrl.emitPlayback('play'),
                  child: const Text('Skip wait',
                      style: TextStyle(color: AppColors.teal)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _openSettings() {
    _hideTimer?.cancel();
    final st = ref.read(partyControllerProvider);
    final media = st.room?.media;
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

                // Audio · sub/dub — host changes it for everyone.
                if (media != null &&
                    media.type == 'anime' &&
                    st.isHost &&
                    media.category != null) ...[
                  _heading(Icons.translate_rounded, 'Audio · Sub / Dub (for everyone)'),
                  const SizedBox(height: 10),
                  Wrap(spacing: 10, runSpacing: 10, children: [
                    for (final c in const ['sub', 'dub'])
                      PlayerChip(
                          label: c == 'sub' ? 'Subbed' : 'Dubbed',
                          active: media.category == c,
                          onTap: () {
                            Navigator.pop(context);
                            _ctrl.emitMedia(category: c);
                          }),
                  ]),
                  const SizedBox(height: 22),
                ],

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
                        label: (s.language ?? s.title ?? s.id).toString(),
                        active: _subKey == 'emb:${s.id}',
                        onTap: () {
                          Navigator.pop(context);
                          _selectEmbeddedSub(s);
                        },
                      )),
                  ..._externalSubs.map((s) => PlayerChip(
                        label: s.label,
                        active: _subKey == 'ext:${s.url}',
                        onTap: () {
                          Navigator.pop(context);
                          _selectExternalSub(s);
                        },
                      )),
                ]),

                const SizedBox(height: 22),
                _heading(Icons.av_timer_rounded, 'Subtitle timing'),
                const SizedBox(height: 6),
                const Text('Nudge subtitles to line up with the video.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 10),
                StatefulBuilder(
                  builder: (ctx, setSheet) {
                    void bump(double d) {
                      setSheet(() =>
                          _subOffset = (_subOffset + d).clamp(-30.0, 30.0));
                      _applySubDelay();
                    }

                    return Row(
                      children: [
                        _subStepBtn(Icons.remove_rounded, () => bump(-0.5)),
                        const SizedBox(width: 12),
                        SizedBox(
                          width: 84,
                          child: Text(
                            '${_subOffset >= 0 ? '+' : ''}${_subOffset.toStringAsFixed(1)}s',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 16,
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(width: 12),
                        _subStepBtn(Icons.add_rounded, () => bump(0.5)),
                        const Spacer(),
                        if (_subOffset != 0)
                          TextButton(
                            onPressed: () {
                              setSheet(() => _subOffset = 0);
                              _applySubDelay();
                            },
                            child: const Text('Reset',
                                style: TextStyle(color: AppColors.teal)),
                          ),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    ).whenComplete(_restartHideTimer);
  }

  Widget _subStepBtn(IconData icon, VoidCallback onTap) => Material(
        color: AppColors.glassBackground,
        shape: const CircleBorder(
            side: BorderSide(color: AppColors.glassBorder)),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Icon(icon, color: AppColors.textPrimary, size: 22),
          ),
        ),
      );

  List<VideoTrack> _uniqueQualities() {
    final seen = <int>{};
    final out = <VideoTrack>[];
    final sorted = [..._videoTracks]..sort((a, b) => (b.h ?? 0).compareTo(a.h ?? 0));
    for (final v in sorted) {
      final h = v.h ?? 0;
      if (h > 0 && seen.add(h)) out.add(v);
    }
    return out;
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
