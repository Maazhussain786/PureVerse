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
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(title: const Text('My Library')),
      body: !auth.isSignedIn
          ? _signInPrompt(context)
          : _libraryBody(context, ref),
    );
  }

  Widget _libraryBody(BuildContext context, WidgetRef ref) {
    final state = ref.watch(userStateProvider);
    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.bgCard,
      onRefresh: () => ref.read(userStateProvider.notifier).reload(),
      child: state.loading && state.isEmpty
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : state.isEmpty
              ? _emptyLibrary()
              : ListView(
                  padding: const EdgeInsets.only(top: 8, bottom: 32),
                  children: [
                    if (state.watchlist.isNotEmpty)
                      _section('Watchlist', state.watchlist),
                    if (state.favorites.isNotEmpty)
                      _section('Favorites', state.favorites),
                  ],
                ),
    );
  }

  Widget _section(String title, List<MediaItem> items) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: '$title  (${items.length})'),
          const SizedBox(height: 14),
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (_, i) => MediaPosterCard(item: items[i]),
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
