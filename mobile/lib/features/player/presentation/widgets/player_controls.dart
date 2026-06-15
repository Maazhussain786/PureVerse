import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

String formatDuration(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return h > 0 ? '$h:$m:$s' : '$m:$s';
}

/// Shared premium player chrome: gradient scrim, top bar (back · title ·
/// settings), centre transport (−10s · play/pause · +10s) with the buffering
/// spinner occupying the play button's spot, and a thick draggable scrubber.
/// Used by both the demo player and the real-catalog player.
class PlayerControlsOverlay extends StatelessWidget {
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

  /// Optional — when set, an "Episodes" button appears in the top bar
  /// (series / anime only).
  final VoidCallback? onOpenEpisodes;
  final VoidCallback onScrubStart;
  final ValueChanged<double> onScrubUpdate;
  final ValueChanged<double> onScrubEnd;

  const PlayerControlsOverlay({
    super.key,
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
    this.onOpenEpisodes,
    required this.onScrubStart,
    required this.onScrubUpdate,
    required this.onScrubEnd,
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
            // Top bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: Row(
                children: [
                  PlayerIconButton(
                      icon: Icons.arrow_back_rounded,
                      tooltip: 'Back',
                      onTap: onBack),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (onOpenEpisodes != null)
                    PlayerIconButton(
                        icon: Icons.video_library_rounded,
                        tooltip: 'Episodes & seasons',
                        onTap: onOpenEpisodes!),
                  const SizedBox(width: 4),
                  PlayerIconButton(
                      icon: Icons.settings_rounded,
                      tooltip: 'Audio, subtitles & quality',
                      onTap: onOpenSettings),
                ],
              ),
            ),

            // Centre transport — spinner replaces the play button while
            // buffering so the loader is centred and never overlaps it.
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
                          PlayerIconButton(
                              icon: Icons.replay_10_rounded,
                              size: 34,
                              tooltip: 'Back 10s',
                              onTap: onSkipBack),
                          const SizedBox(width: 36),
                          _PlayButton(playing: playing, onTap: onTogglePlay),
                          const SizedBox(width: 36),
                          PlayerIconButton(
                              icon: Icons.forward_10_rounded,
                              size: 34,
                              tooltip: 'Forward 10s',
                              onTap: onSkipFwd),
                        ],
                      ),
              ),
            ),

            // Scrubber
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Row(
                children: [
                  Text(formatDuration(position),
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
                  Text(formatDuration(duration),
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

class PlayerIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final double size;
  final String? tooltip;
  const PlayerIconButton({
    super.key,
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

/// A simple selectable chip used in the player's settings sheet.
class PlayerChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const PlayerChip(
      {super.key,
      required this.label,
      required this.active,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
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
}
