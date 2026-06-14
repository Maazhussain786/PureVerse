import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/watch_history.dart';
import '../../features/player/presentation/screens/embed_player_screen.dart';
import 'section_header.dart';

/// Horizontal "Continue Watching" rail — poster cards with a resume-progress
/// bar and an episode badge. Tapping resumes playback; the ✕ removes the entry.
class ContinueWatchingRail extends StatelessWidget {
  final String title;
  final List<WatchHistoryItem> items;
  final void Function(String key) onRemove;

  const ContinueWatchingRail({
    super.key,
    this.title = 'Continue Watching',
    required this.items,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title),
          const SizedBox(height: 14),
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, i) => _ContinueCard(
                item: items[i],
                onRemove: () => onRemove(items[i].key),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContinueCard extends StatelessWidget {
  final WatchHistoryItem item;
  final VoidCallback onRemove;
  const _ContinueCard({required this.item, required this.onRemove});

  void _resume(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => EmbedPlayerScreen(
        mediaType: item.type,
        mediaId: item.id,
        title: item.title,
        season: item.season,
        episode: item.episode,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final epLabel = item.season != null && item.episode != null
        ? 'S${item.season} E${item.episode}'
        : null;

    return GestureDetector(
      onTap: () => _resume(context),
      child: SizedBox(
        width: 130,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (item.posterUrl.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: item.posterUrl,
                        fit: BoxFit.cover,
                        memCacheWidth: 300,
                        placeholder: (_, _) =>
                            Container(color: AppColors.bgCard),
                        errorWidget: (_, _, _) =>
                            Container(color: AppColors.bgCard),
                      )
                    else
                      Container(color: AppColors.bgCard),

                    // Centered play affordance
                    Center(
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.accent.withValues(alpha: 0.9),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow_rounded,
                            color: AppColors.onAccent, size: 24),
                      ),
                    ),

                    if (epLabel != null)
                      Positioned(
                        top: 6,
                        left: 6,
                        child: _badge(epLabel),
                      ),

                    Positioned(
                      top: 4,
                      right: 4,
                      child: GestureDetector(
                        onTap: onRemove,
                        child: Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close_rounded,
                              color: Colors.white, size: 14),
                        ),
                      ),
                    ),

                    // Progress bar
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        height: 4,
                        color: Colors.white.withValues(alpha: 0.15),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: (item.progress.clamp(0, 100)) / 100,
                          child: Container(color: AppColors.accent),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              item.title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Text(
          text,
          style: const TextStyle(
              fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white),
        ),
      );
}
