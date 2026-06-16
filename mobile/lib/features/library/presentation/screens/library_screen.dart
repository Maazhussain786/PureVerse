import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/media_item.dart';
import '../../../auth/auth_controller.dart';
import '../../../auth/sign_in_sheet.dart';
import '../../../user/user_state.dart';
import '../../../../shared/widgets/media_poster_card.dart';
import '../../../../shared/widgets/section_header.dart';

class LibraryScreen extends ConsumerWidget {
  /// null = both sections; 'watchlist' or 'favorites' = just that one.
  final String? only;
  const LibraryScreen({super.key, this.only});

  String get _title => only == 'favorites'
      ? 'Favorites'
      : only == 'watchlist'
          ? 'My List'
          : 'My Library';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(title: Text(_title)),
      body: !auth.isSignedIn
          ? _signInPrompt(context)
          : _libraryBody(context, ref),
    );
  }

  Widget _libraryBody(BuildContext context, WidgetRef ref) {
    final state = ref.watch(userStateProvider);
    final showWatch = only != 'favorites';
    final showFav = only != 'watchlist';
    final hasContent = (showWatch && state.watchlist.isNotEmpty) ||
        (showFav && state.favorites.isNotEmpty);
    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.bgCard,
      onRefresh: () => ref.read(userStateProvider.notifier).reload(),
      child: state.loading && !hasContent
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : !hasContent
              ? _emptyLibrary()
              : ListView(
                  padding: const EdgeInsets.only(top: 8, bottom: 32),
                  children: [
                    if (showWatch && state.watchlist.isNotEmpty)
                      _section(context, ref, 'Watchlist', state.watchlist,
                          watchlist: true),
                    if (showFav && state.favorites.isNotEmpty)
                      _section(context, ref, 'Favorites', state.favorites,
                          watchlist: false),
                  ],
                ),
    );
  }

  Widget _section(BuildContext context, WidgetRef ref, String title,
      List<MediaItem> items,
      {required bool watchlist}) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: '$title  (${items.length})'),
          const SizedBox(height: 6),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text('Tap to open · tap ✕ to remove',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, i) => _RemovableCard(
                item: items[i],
                onRemove: () {
                  final m = items[i];
                  final notifier = ref.read(userStateProvider.notifier);
                  if (watchlist) {
                    notifier.removeWatchlist(m.id);
                  } else {
                    notifier.removeFavorite(m.id);
                  }
                  ScaffoldMessenger.of(context)
                    ..hideCurrentSnackBar()
                    ..showSnackBar(SnackBar(
                        content: Text('Removed "${m.title}"'),
                        duration: const Duration(seconds: 2)));
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyLibrary() => ListView(
        // ListView so pull-to-refresh still works when empty
        children: [
          const SizedBox(height: 120),
          _message(Icons.bookmark_border_rounded, 'Nothing saved yet',
              'Add titles to your watchlist or favorites and they\'ll show up here.'),
        ],
      );

  Widget _signInPrompt(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                    color: AppColors.accentSubtle, shape: BoxShape.circle),
                child: const Icon(Icons.bookmark_rounded,
                    color: AppColors.accent, size: 32),
              ),
              const SizedBox(height: 16),
              const Text('Your watchlist lives here',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              const Text(
                'Sign in to sync your watchlist, favorites and history across devices.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textMuted, fontSize: 13),
              ),
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

/// A library poster (opens details on tap) with a ✕ to remove it from the list.
class _RemovableCard extends StatelessWidget {
  final MediaItem item;
  final VoidCallback onRemove;
  const _RemovableCard({required this.item, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 130,
      child: Stack(
        children: [
          MediaPosterCard(item: item),
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.65),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                ),
                child: const Icon(Icons.close_rounded,
                    color: Colors.white, size: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
