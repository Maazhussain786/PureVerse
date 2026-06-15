import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/demo_media.dart';
import '../widgets/player_controls.dart';

/// Premium custom video player (media_kit / libmpv) for the sample/demo content.
/// Controls live in [PlayerControlsOverlay]; this screen wires demo-specific
/// audio (dub) / subtitle / quality menus.
class NativePlayerScreen extends StatefulWidget {
  final DemoMedia media;
  const NativePlayerScreen({super.key, required this.media});

  @override
  State<NativePlayerScreen> createState() => _NativePlayerScreenState();
}

class _NativePlayerScreenState extends State<NativePlayerScreen> {
  late final Player _player = Player(
    configuration: const PlayerConfiguration(bufferSize: 64 * 1024 * 1024),
  );
  late final VideoController _controller = VideoController(_player);
  final List<StreamSubscription> _subs = [];

  late AudioOption _audio = widget.media.audioTracks.first;
  SubtitleOption? _subtitle; // null = Off

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
      _videoTrack = VideoTrack.auto();
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
            if (_buffering && !_controlsVisible)
              const Center(
                child: CircularProgressIndicator(color: AppColors.accent),
              ),
            AnimatedOpacity(
              opacity: _controlsVisible ? 1 : 0,
              duration: const Duration(milliseconds: 220),
              child: IgnorePointer(
                ignoring: !_controlsVisible,
                child: PlayerControlsOverlay(
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
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

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
              _heading(Icons.high_quality_rounded, 'Quality'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  PlayerChip(
                      label: 'Auto',
                      active: selectedQualityId == 'auto',
                      onTap: () => onSelectQuality(VideoTrack.auto())),
                  ..._qualities.map((v) => PlayerChip(
                        label: '${v.h}p',
                        active: selectedQualityId == v.id,
                        onTap: () => onSelectQuality(v),
                      )),
                ],
              ),
              const SizedBox(height: 22),
              _heading(Icons.graphic_eq_rounded, 'Audio'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: media.audioTracks
                    .map((a) => PlayerChip(
                          label: a.label,
                          active: a.url == selectedAudio.url,
                          onTap: () => onSelectAudio(a),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 22),
              _heading(Icons.subtitles_rounded, 'Subtitles'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  PlayerChip(
                      label: 'Off',
                      active: selectedSubtitle == null,
                      onTap: () => onSelectSubtitle(null)),
                  ...media.subtitleTracks.map((s) => PlayerChip(
                        label: s.label,
                        active: selectedSubtitle?.url == s.url,
                        onTap: () => onSelectSubtitle(s),
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
}
