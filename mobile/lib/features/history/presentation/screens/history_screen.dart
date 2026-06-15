import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/watch_history.dart';
import '../../../auth/auth_controller.dart';
import '../../../auth/sign_in_sheet.dart';
import '../../../player/presentation/screens/catalog_player_screen.dart';
import '../../../user/user_state.dart';

/// Watch history — newest-first list with resume-progress, mirroring the web
/// /history page.
class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  static String _timeAgo(int ms) {
    final diff = DateTime.now().millisecondsSinceEpoch - ms;
    final mins = diff ~/ 60000;
    if (mins < 1) return 'Just now';
    if (mins < 60) return '${mins}m ago';
    final hours = mins ~/ 60;
    if (hours < 24) return '${hours}h ago';
    final days = hours ~/ 24;
    if (days < 7) return '${days}d ago';
    final d = DateTime.fromMillisecondsSinceEpoch(ms);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[d.month - 1]} ${d.day}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(authControllerProvider).isSignedIn;
    final history = ref.watch(userStateProvider.select((s) => s.history));

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(
        title: const Text('Watch History'),
        actions: [
          if (history.isNotEmpty)
            TextButton.icon(
              onPressed: () => _confirmClear(context, ref),
              icon: const Icon(Icons.delete_outline_rounded,
                  size: 18, color: AppColors.ratingLow),
              label: const Text('Clear All',
                  style: TextStyle(color: AppColors.ratingLow)),
            ),
        ],
      ),
      body: !signedIn
          ? _signInPrompt(context)
          : history.isEmpty
              ? _empty()
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  itemCount: history.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _HistoryTile(
                    item: history[i],
                    onRemove: () => ref
                        .read(userStateProvider.notifier)
                        .removeFromHistory(history[i].key),
                  ),
                ),
    );
  }

  Future<void> _confirmClear(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: const Text('Clear watch history?',
            style: TextStyle(color: AppColors.textPrimary)),
        content: const Text('This removes every title from your history.',
            style: TextStyle(color: AppColors.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Clear all',
                style: TextStyle(color: AppColors.ratingLow)),
          ),
        ],
      ),
    );
    if (ok == true) ref.read(userStateProvider.notifier).clearHistory();
  }

  Widget _empty() => _message(
        Icons.history_rounded,
        'No watch history yet',
        'Start watching and your history will appear here so you can resume.',
      );

  Widget _signInPrompt(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.history_rounded,
                  size: 48, color: AppColors.textMuted),
              const SizedBox(height: 12),
              const Text('Sign in to see your history',
                  style: TextStyle(
                      color: AppColors.textSecondary, fontSize: 15)),
              const SizedBox(height: 8),
              const Text('Your watch history syncs across devices.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => showSignInSheet(context),
                child: const Text('Sign in'),
              ),
            ],
          ),
        ),
      );

  Widget _message(IconData icon, String title, String subtitle) => Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text(title,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 15)),
              const SizedBox(height: 4),
              Text(subtitle,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ],
          ),
        ),
      );
}

class _HistoryTile extends StatelessWidget {
  final WatchHistoryItem item;
  final VoidCallback onRemove;
  const _HistoryTile({required this.item, required this.onRemove});

  void _resume(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => CatalogPlayerScreen(
        mediaType: item.type,
        mediaId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        rating: item.rating,
        releaseYear: item.releaseYear,
        season: item.season,
        episode: item.episode,
        episodeTitle: item.episodeTitle,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final typeLabel = item.type == 'tv' ? 'Series' : item.type.toUpperCase();
    final epLabel = item.season != null && item.episode != null
        ? 'S${item.season} E${item.episode}'
        : null;

    return InkWell(
      onTap: () => _resume(context),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.glassBackground,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 56,
                height: 84,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (item.posterUrl.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: item.posterUrl,
                        fit: BoxFit.cover,
                        memCacheWidth: 160,
                        placeholder: (_, _) =>
                            Container(color: AppColors.bgCard),
                        errorWidget: (_, _, _) =>
                            Container(color: AppColors.bgCard),
                      )
                    else
                      Container(
                        color: AppColors.bgCard,
                        child: const Icon(Icons.play_arrow_rounded,
                            color: AppColors.textMuted),
                      ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: Container(
                        height: 3,
                        color: Colors.white.withValues(alpha: 0.15),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: item.progress.clamp(0, 100) / 100,
                          child: Container(color: AppColors.accent),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.title,
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _pill(typeLabel),
                      if (epLabel != null) ...[
                        const SizedBox(width: 8),
                        Text(epLabel,
                            style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.w600)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${HistoryScreen._timeAgo(item.lastWatched)} · ${item.progress}% watched',
                    style: const TextStyle(
                        color: AppColors.textMuted, fontSize: 11),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close_rounded,
                  color: AppColors.textMuted, size: 18),
              onPressed: onRemove,
              tooltip: 'Remove',
            ),
          ],
        ),
      ),
    );
  }

  Widget _pill(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.accentSubtle,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text,
            style: const TextStyle(
                color: AppColors.accent,
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5)),
      );
}
