import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/media_item.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../../shared/widgets/media_rail.dart';
import '../../../../shared/widgets/continue_watching_rail.dart';
import '../../../details/presentation/screens/details_screen.dart';
import '../../../shell/main_shell.dart';
import '../../../user/user_state.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trending = ref.watch(trendingProvider);
    final continueWatching =
        ref.watch(userStateProvider.select((s) => s.continueWatching));
    final watchlist = ref.watch(userStateProvider.select((s) => s.watchlist));

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      body: RefreshIndicator(
        color: AppColors.accent,
        backgroundColor: AppColors.bgCard,
        onRefresh: () async {
          ref.invalidate(trendingProvider);
          ref.invalidate(trendingMoviesProvider);
          ref.invalidate(trendingSeriesProvider);
          ref.invalidate(trendingAnimeProvider);
          ref.invalidate(nowPlayingProvider);
          ref.invalidate(topRatedMoviesProvider);
          ref.invalidate(topRatedSeriesProvider);
          ref.invalidate(popularAnimeProvider);
          ref.read(userStateProvider.notifier).reload();
          await ref.read(trendingProvider.future).catchError((_) => <MediaItem>[]);
        },
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              floating: true,
              backgroundColor: AppColors.bgPrimary.withValues(alpha: 0.9),
              elevation: 0,
              title: _BrandTitle(),
              actions: [
                IconButton(
                  icon: const Icon(Icons.search_rounded,
                      color: AppColors.textSecondary),
                  onPressed: () =>
                      ref.read(shellTabProvider.notifier).state = 4,
                ),
              ],
            ),

            // Hero
            trending.when(
              data: (items) => items.isEmpty
                  ? const SliverToBoxAdapter(child: SizedBox.shrink())
                  : SliverToBoxAdapter(child: _HeroBanner(item: items.first)),
              loading: () => const SliverToBoxAdapter(
                child: SizedBox(
                  height: 300,
                  child: Center(
                      child: CircularProgressIndicator(color: AppColors.accent)),
                ),
              ),
              error: (e, _) => SliverToBoxAdapter(child: _HeroError(error: e)),
            ),

            // Continue Watching (real user history — resumes playback)
            SliverToBoxAdapter(
              child: ContinueWatchingRail(
                items: continueWatching,
                onRemove: (key) =>
                    ref.read(userStateProvider.notifier).removeFromHistory(key),
              ),
            ),

            // My List (synced watchlist)
            SliverToBoxAdapter(
              child: MediaRail(
                title: 'My List',
                items: AsyncValue.data(watchlist),
              ),
            ),

            // Rails
            SliverToBoxAdapter(
              child: MediaRail(
                title: 'Trending Now',
                items: trending.whenData(
                    (l) => l.length > 1 ? l.sublist(1) : const <MediaItem>[]),
              ),
            ),
            SliverToBoxAdapter(
              child: MediaRail(
                  title: 'Trending Movies',
                  items: ref.watch(trendingMoviesProvider)),
            ),
            SliverToBoxAdapter(
              child: MediaRail(
                  title: 'Popular Series',
                  items: ref.watch(trendingSeriesProvider)),
            ),
            SliverToBoxAdapter(
              child: MediaRail(
                  title: 'Top Anime',
                  items: ref.watch(trendingAnimeProvider)),
            ),
            SliverToBoxAdapter(
              child: MediaRail(
                  title: 'New Releases',
                  items: ref.watch(nowPlayingProvider)),
            ),
            SliverToBoxAdapter(
              child: MediaRail(
                  title: 'Top Rated Movies',
                  items: ref.watch(topRatedMoviesProvider)),
            ),
            SliverToBoxAdapter(
              child: MediaRail(
                  title: 'Top Rated Series',
                  items: ref.watch(topRatedSeriesProvider)),
            ),
            SliverToBoxAdapter(
              child: MediaRail(
                  title: 'Popular Anime',
                  items: ref.watch(popularAnimeProvider)),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }
}

class _BrandTitle extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 32,
          height: 32,
          child: Image.asset('assets/logo/logo.png', fit: BoxFit.contain),
        ),
        const SizedBox(width: 10),
        const Text.rich(
          TextSpan(children: [
            TextSpan(
                text: 'Pure',
                style:
                    TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
            TextSpan(
                text: 'Verse',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                    color: AppColors.accent)),
          ]),
        ),
      ],
    );
  }
}

class _HeroError extends StatelessWidget {
  final Object error;
  const _HeroError({required this.error});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          children: [
            const Icon(Icons.cloud_off_rounded,
                color: AppColors.textMuted, size: 48),
            const SizedBox(height: 12),
            const Text('Backend unreachable',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
            const SizedBox(height: 4),
            Text('$error',
                textAlign: TextAlign.center,
                style:
                    const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _HeroBanner extends StatelessWidget {
  final MediaItem item;
  const _HeroBanner({required this.item});

  void _open(BuildContext context) => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DetailsScreen(item: item)),
      );

  @override
  Widget build(BuildContext context) {
    final bg = item.bannerUrl.isNotEmpty ? item.bannerUrl : item.posterUrl;

    return GestureDetector(
      onTap: () => _open(context),
      child: SizedBox(
        height: 340,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (bg.isNotEmpty)
              CachedNetworkImage(
                imageUrl: bg,
                fit: BoxFit.cover,
                placeholder: (_, _) => Container(color: AppColors.bgCard),
                errorWidget: (_, _, _) => Container(color: AppColors.bgCard),
              ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    AppColors.bgPrimary.withValues(alpha: 0.4),
                    AppColors.bgPrimary,
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
            Positioned(
              left: 20,
              right: 20,
              bottom: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      _badge(item.type == 'tv'
                          ? 'SERIES'
                          : item.type.toUpperCase()),
                      if (item.rating > 0) ...[
                        const SizedBox(width: 8),
                        _badge('★ ${item.rating.toStringAsFixed(1)}',
                            accent: true),
                      ],
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    item.title,
                    style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        height: 1.1,
                        color: AppColors.textPrimary),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.synopsis,
                    style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.4),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    onPressed: () => _open(context),
                    icon: const Icon(Icons.play_arrow_rounded, size: 20),
                    label: const Text('Watch Now'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(String text, {bool accent = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
          color: accent ? AppColors.lime : AppColors.textPrimary,
        ),
      ),
    );
  }
}
