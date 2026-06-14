import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/demo_media.dart';

/// Premium custom video player (media_kit / libmpv) with hand-built controls:
/// play/pause, ±10s skip, a thick draggable scrubber, and dynamic audio (dub),
/// subtitle and quality menus driven by the stream's actually-available tracks.
class NativePlayerScreen extends StatefulWidget {
  final DemoMedia media;
  const NativePlayerScreen({super.key, required this.media});

  @override
  State<NativePlayerScreen> createState() => _NativePlayerScreenState();
}

class _NativePlayerScreenState extends State<NativePlayerScreen> {
  // A larger demuxer cache => fewer mid-playback re-buffers on flaky networks.
  late final Player _player = Player(
    configuration: const PlayerConfiguration(bufferSize: 64 * 1024 * 1024),
  );
  late final VideoController _controller = VideoController(_player);
  final List<StreamSubscription> _subs = [];

  late AudioOption _audio = widget.media.audioTracks.first;
  SubtitleOption? _subtitle; // null = Off

  // Quality (HLS video variants surfaced by libmpv). Auto = adaptive.
  List<VideoTrack> _videoTracks = [];
  VideoTrack _videoTrack = VideoTrack.auto();

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
      // Keep only real, height-tagged video variants (drop auto/no).
      final vids = t.video
          .where((v) => v.id != 'auto' && v.id != 'no' && (v.h ?? 0) > 0)
          .toList();
      setState(() => _videoTracks = vids);
    }));

    _loadSource(_audio, play: true);
    _restartHideTimer();
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    for (final s in _subs) {
      s.cancel();
    }
    _player.dispose();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  // ─── Playback control ───
  Future<void> _loadSource(AudioOption audio,
      {Duration? at, bool play = true}) async {
    await _player.open(Media(audio.url), play: false);
    if (at != null && at > Duration.zero) await _player.seek(at);
    await _applySubtitle(_subtitle);
    if (play) await _player.play();
  }

  Future<void> _applySubtitle(SubtitleOption? sub) async {
    if (sub == null) {
      await _player.setSubtitleTrack(SubtitleTrack.no());
    } else {
      await _player.setSubtitleTrack(
        SubtitleTrack.uri(sub.url, title: sub.label, language: sub.language),
      );
    }
  }

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

  void _selectAudio(AudioOption a) {
    if (a.url == _audio.url) return;
    final pos = _position;
    final wasPlaying = _playing;
    setState(() {
      _audio = a;
      _videoTracks = [];
      _videoTrack = VideoTrack.auto(); // quality resets per source
    });
    _loadSource(a, at: pos, play: wasPlaying);
  }

  void _selectSubtitle(SubtitleOption? s) {
    setState(() => _subtitle = s);
    _applySubtitle(s);
  }

  void _selectQuality(VideoTrack t) {
    setState(() => _videoTrack = t);
    _player.setVideoTrack(t);
    _restartHideTimer();
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

  static String _fmt(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
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

            // Buffering spinner while controls are hidden — sits dead-center,
            // exactly where the play button would be (no overlap with it).
            if (_buffering && !_controlsVisible)
              const Center(
                child: CircularProgressIndicator(color: AppColors.accent),
              ),

            // Controls overlay
            AnimatedOpacity(
              opacity: _controlsVisible ? 1 : 0,
              duration: const Duration(milliseconds: 220),
              child: IgnorePointer(
                ignoring: !_controlsVisible,
                child: _ControlsOverlay(
                  title: widget.media.title,
                  playing: _playing,
                  buffering: _buffering,
                  position: _position,
                  duration: _duration,
                  onBack: () => Navigator.of(context).maybePop(),
                  onTogglePlay: _togglePlay,
                  onSkipBack: () => _skip(const Duration(seconds: -10)),
                  onSkipFwd: () => _skip(const Duration(seconds: 10)),
                  onOpenSettings: _openSettings,
                  onScrubStart: () {
                    _dragging = true;
                    _hideTimer?.cancel();
                  },
                  onScrubUpdate: (v) => setState(
                      () => _position = Duration(milliseconds: v.toInt())),
                  onScrubEnd: (v) {
                    _dragging = false;
                    _player.seek(Duration(milliseconds: v.toInt()));
                    _restartHideTimer();
                  },
                  fmt: _fmt,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Settings sheet (dynamic audio + subtitle + quality menus) ───
  void _openSettings() {
    _hideTimer?.cancel();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _SettingsSheet(
        media: widget.media,
        selectedAudio: _audio,
        selectedSubtitle: _subtitle,
        videoTracks: _videoTracks,
        selectedQualityId: _videoTrack.id,
        onSelectAudio: (a) {
          Navigator.of(context).pop();
          _selectAudio(a);
        },
        onSelectSubtitle: (s) {
          Navigator.of(context).pop();
          _selectSubtitle(s);
        },
        onSelectQuality: (t) {
          Navigator.of(context).pop();
          _selectQuality(t);
        },
      ),
    ).whenComplete(_restartHideTimer);
  }
}

// ─────────────────────────── Controls overlay ───────────────────────────
class _ControlsOverlay extends StatelessWidget {
  final String title;
  final bool playing;
  final bool buffering;
  final Duration position;
  final Duration duration;
  final VoidCallback onBack;
  final VoidCallback onTogglePlay;
  final VoidCallback onSkipBack;
  final VoidCallback onSkipFwd;
  final VoidCallback onOpenSettings;
  final VoidCallback onScrubStart;
  final ValueChanged<double> onScrubUpdate;
  final ValueChanged<double> onScrubEnd;
  final String Function(Duration) fmt;

  const _ControlsOverlay({
    required this.title,
    required this.playing,
    required this.buffering,
    required this.position,
    required this.duration,
    required this.onBack,
    required this.onTogglePlay,
    required this.onSkipBack,
    required this.onSkipFwd,
    required this.onOpenSettings,
    required this.onScrubStart,
    required this.onScrubUpdate,
    required this.onScrubEnd,
    required this.fmt,
  });

  @override
  Widget build(BuildContext context) {
    final maxMs =
        duration.inMilliseconds > 0 ? duration.inMilliseconds.toDouble() : 1.0;
    final value = position.inMilliseconds
        .clamp(0, duration.inMilliseconds > 0 ? duration.inMilliseconds : 0)
        .toDouble();

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.55),
            Colors.transparent,
            Colors.transparent,
            Colors.black.withValues(alpha: 0.65),
          ],
          stops: const [0.0, 0.25, 0.6, 1.0],
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  _IconButton(
                    icon: Icons.arrow_back_rounded,
                    tooltip: 'Back',
                    onTap: onBack,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  _IconButton(
                    icon: Icons.settings_rounded,
                    tooltip: 'Audio, subtitles & quality',
                    onTap: onOpenSettings,
                  ),
                ],
              ),
            ),

            // ── Center transport (spinner replaces play button while buffering,
            //    so the loader is perfectly centered, never overlapping it) ──
            Expanded(
              child: Center(
                child: buffering
                    ? const SizedBox(
                        width: 56,
                        height: 56,
                        child: CircularProgressIndicator(
                            color: AppColors.accent, strokeWidth: 3),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _IconButton(
                            icon: Icons.replay_10_rounded,
                            size: 34,
                            onTap: onSkipBack,
                            tooltip: 'Back 10s',
                          ),
                          const SizedBox(width: 36),
                          _PlayButton(playing: playing, onTap: onTogglePlay),
                          const SizedBox(width: 36),
                          _IconButton(
                            icon: Icons.forward_10_rounded,
                            size: 34,
                            onTap: onSkipFwd,
                            tooltip: 'Forward 10s',
                          ),
                        ],
                      ),
              ),
            ),

            // ── Bottom scrubber ──
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  Text(fmt(position),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontFeatures: [FontFeature.tabularFigures()])),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SliderTheme(
                      data: SliderThemeData(
                        trackHeight: 6,
                        activeTrackColor: AppColors.accent,
                        inactiveTrackColor: Colors.white.withValues(alpha: 0.25),
                        thumbColor: AppColors.accent,
                        overlayColor: AppColors.accentGlow,
                        thumbShape:
                            const RoundSliderThumbShape(enabledThumbRadius: 8),
                        overlayShape:
                            const RoundSliderOverlayShape(overlayRadius: 18),
                        trackShape: const RoundedRectSliderTrackShape(),
                      ),
                      child: Slider(
                        min: 0,
                        max: maxMs,
                        value: value.clamp(0, maxMs),
                        onChangeStart: (_) => onScrubStart(),
                        onChanged: onScrubUpdate,
                        onChangeEnd: onScrubEnd,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(fmt(duration),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontFeatures: [FontFeature.tabularFigures()])),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlayButton extends StatelessWidget {
  final bool playing;
  final VoidCallback onTap;
  const _PlayButton({required this.playing, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.12),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Icon(
            playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
            color: Colors.white,
            size: 44,
          ),
        ),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final double size;
  final String? tooltip;
  const _IconButton({
    required this.icon,
    required this.onTap,
    this.size = 24,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    final button = Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, color: Colors.white, size: size),
        ),
      ),
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

// ─────────────────────────── Settings sheet ───────────────────────────
class _SettingsSheet extends StatelessWidget {
  final DemoMedia media;
  final AudioOption selectedAudio;
  final SubtitleOption? selectedSubtitle;
  final List<VideoTrack> videoTracks;
  final String selectedQualityId;
  final ValueChanged<AudioOption> onSelectAudio;
  final ValueChanged<SubtitleOption?> onSelectSubtitle;
  final ValueChanged<VideoTrack> onSelectQuality;

  const _SettingsSheet({
    required this.media,
    required this.selectedAudio,
    required this.selectedSubtitle,
    required this.videoTracks,
    required this.selectedQualityId,
    required this.onSelectAudio,
    required this.onSelectSubtitle,
    required this.onSelectQuality,
  });

  /// Unique heights, highest first — labelled "1080p", "720p", …
  List<VideoTrack> get _qualities {
    final seen = <int>{};
    final out = <VideoTrack>[];
    final sorted = [...videoTracks]
      ..sort((a, b) => (b.h ?? 0).compareTo(a.h ?? 0));
    for (final v in sorted) {
      final h = v.h ?? 0;
      if (h > 0 && seen.add(h)) out.add(v);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
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

              // Quality — Auto + each available resolution (if the stream
              // exposes variants; otherwise just Auto).
              _heading(Icons.high_quality_rounded, 'Quality'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _chip('Auto', selectedQualityId == 'auto',
                      () => onSelectQuality(VideoTrack.auto())),
                  ..._qualities.map((v) => _chip(
                        '${v.h}p',
                        selectedQualityId == v.id,
                        () => onSelectQuality(v),
                      )),
                ],
              ),

              const SizedBox(height: 22),

              // Audio / dubs — only languages this title actually has.
              _heading(Icons.graphic_eq_rounded, 'Audio'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: media.audioTracks
                    .map((a) => _chip(
                          a.label,
                          a.url == selectedAudio.url,
                          () => onSelectAudio(a),
                        ))
                    .toList(),
              ),

              const SizedBox(height: 22),

              // Subtitles — "Off" + only languages this title actually has.
              _heading(Icons.subtitles_rounded, 'Subtitles'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _chip('Off', selectedSubtitle == null,
                      () => onSelectSubtitle(null)),
                  ...media.subtitleTracks.map((s) => _chip(
                        s.label,
                        selectedSubtitle?.url == s.url,
                        () => onSelectSubtitle(s),
                      )),
                ],
              ),
            ],
          ),
        ),
      ),
    );
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

  Widget _chip(String label, bool active, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
          decoration: BoxDecoration(
            color: active ? AppColors.accent : AppColors.glassBackground,
            borderRadius: BorderRadius.circular(AppRadii.full),
            border: Border.all(
                color: active ? AppColors.accent : AppColors.glassBorder),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (active) ...[
                const Icon(Icons.check_rounded,
                    size: 16, color: AppColors.onAccent),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  color: active ? AppColors.onAccent : AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
}
