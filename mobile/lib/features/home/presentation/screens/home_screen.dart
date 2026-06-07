import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../player/presentation/screens/player_screen.dart';

// ─── Providers ─────────────────────────────────────────
final apiClientProvider = Provider((ref) => ApiClient());

final trendingProvider = FutureProvider<List<dynamic>>((ref) async {
  final client = ref.read(apiClientProvider);
  return client.getTrending();
});

final trendingMoviesProvider = FutureProvider<List<dynamic>>((ref) async {
  final client = ref.read(apiClientProvider);
  return client.getTrendingMovies();
});

final trendingAnimeProvider = FutureProvider<List<dynamic>>((ref) async {
  final client = ref.read(apiClientProvider);
  return client.getTrendingAnime();
});

// ─── Home Screen ───────────────────────────────────────
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trending = ref.watch(trendingProvider);
    final movies = ref.watch(trendingMoviesProvider);
    final anime = ref.watch(trendingAnimeProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          // ─── App Bar ────────────────────────────────
          SliverAppBar(
            floating: true,
            backgroundColor: AppColors.background.withValues(alpha: 0.9),
            elevation: 0,
            title: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.primaryAccent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: Text('P', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                ),
                const SizedBox(width: 10),
                Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Pure', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
                      TextSpan(text: 'Verse', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: AppColors.primaryAccent)),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.search_rounded, color: Colors.white70),
                onPressed: () {},
              ),
            ],
          ),

          // ─── Hero Banner ────────────────────────────
          trending.when(
            data: (items) {
              if (items.isEmpty) {
                return const SliverToBoxAdapter(child: SizedBox.shrink());
              }
              final hero = items[0];
              return SliverToBoxAdapter(
                child: _HeroBanner(item: hero),
              );
            },
            loading: () => const SliverToBoxAdapter(
              child: SizedBox(height: 300, child: Center(child: CircularProgressIndicator(color: AppColors.primaryAccent))),
            ),
            error: (e, _) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    children: [
                      const Icon(Icons.cloud_off_rounded, color: Colors.white38, size: 48),
                      const SizedBox(height: 12),
                      Text('Backend unreachable', style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 14)),
                      const SizedBox(height: 4),
                      Text('Make sure the API is running on port 5000', style: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ─── Trending Row ───────────────────────────
          trending.when(
            data: (items) => _MediaRowSliver(title: 'Trending Now', items: items.length > 1 ? items.sublist(1) : []),
            loading: () => _ShimmerRowSliver(),
            error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),

          // ─── Movies Row ─────────────────────────────
          movies.when(
            data: (items) => _MediaRowSliver(title: 'Trending Movies', items: items),
            loading: () => _ShimmerRowSliver(),
            error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),

          // ─── Anime Row ──────────────────────────────
          anime.when(
            data: (items) => _MediaRowSliver(title: 'Top Anime', items: items),
            loading: () => _ShimmerRowSliver(),
            error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
          ),

          // Bottom padding
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }
}

// ─── Hero Banner Widget ────────────────────────────────
class _HeroBanner extends StatelessWidget {
  final dynamic item;
  const _HeroBanner({required this.item});

  @override
  Widget build(BuildContext context) {
    final bannerUrl = item['bannerUrl'] ?? item['posterUrl'] ?? '';
    final title = item['title'] ?? '';
    final synopsis = item['synopsis'] ?? '';
    final rating = (item['rating'] as num?)?.toDouble() ?? 0.0;
    final type = item['type'] ?? 'movie';
    final id = item['id'] ?? '';

    return GestureDetector(
      onTap: () {
        // Navigate to player with a demo stream for now
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => PlayerScreen(streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
          ),
        );
      },
      child: Container(
        height: 340,
        margin: const EdgeInsets.only(bottom: 8),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Background Image
            if (bannerUrl.isNotEmpty)
              CachedNetworkImage(
                imageUrl: bannerUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: const Color(0xFF0d0d15)),
                errorWidget: (_, __, ___) => Container(color: const Color(0xFF0d0d15)),
              ),

            // Gradient overlays
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    AppColors.background.withValues(alpha: 0.4),
                    AppColors.background.withValues(alpha: 0.95),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [
                    AppColors.background.withValues(alpha: 0.7),
                    Colors.transparent,
                  ],
                ),
              ),
            ),

            // Content
            Positioned(
              left: 20,
              right: 20,
              bottom: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Badges
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                        ),
                        child: Text(
                          type == 'tv' ? 'SERIES' : type.toUpperCase(),
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1),
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (rating > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.star_rounded, size: 12, color: Colors.amber),
                              const SizedBox(width: 4),
                              Text(
                                rating.toStringAsFixed(1),
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.amber),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Title
                  Text(
                    title,
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, height: 1.1),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),

                  // Synopsis
                  Text(
                    synopsis,
                    style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6), height: 1.4),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 14),

                  // Play button
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.primaryAccent,
                      borderRadius: BorderRadius.circular(30),
                      boxShadow: [
                        BoxShadow(color: AppColors.primaryAccent.withValues(alpha: 0.4), blurRadius: 20, offset: const Offset(0, 4)),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.play_arrow_rounded, size: 20),
                        SizedBox(width: 6),
                        Text('Watch Now', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Media Row Sliver ──────────────────────────────────
class _MediaRowSliver extends StatelessWidget {
  final String title;
  final List<dynamic> items;
  const _MediaRowSliver({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());

    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Container(width: 3, height: 18, decoration: BoxDecoration(color: AppColors.primaryAccent, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(width: 10),
                  Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Scrollable cards
            SizedBox(
              height: 220,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final item = items[index];
                  return _PosterCard(item: item);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Poster Card Widget ────────────────────────────────
class _PosterCard extends StatelessWidget {
  final dynamic item;
  const _PosterCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final posterUrl = item['posterUrl'] ?? '';
    final title = item['title'] ?? '';
    final rating = (item['rating'] as num?)?.toDouble() ?? 0.0;

    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: GestureDetector(
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => PlayerScreen(streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
            ),
          );
        },
        child: SizedBox(
          width: 130,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Poster Image
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      posterUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: posterUrl,
                              fit: BoxFit.cover,
                              memCacheWidth: 300,
                              placeholder: (_, __) => Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFF12121c),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              errorWidget: (_, __, ___) => Container(
                                color: const Color(0xFF12121c),
                                child: const Center(child: Icon(Icons.broken_image_outlined, color: Colors.white24, size: 28)),
                              ),
                            )
                          : Container(
                              color: const Color(0xFF12121c),
                              child: const Center(child: Icon(Icons.image_not_supported_outlined, color: Colors.white24)),
                            ),

                      // Rating badge
                      if (rating > 0)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.star_rounded, size: 10, color: rating >= 7 ? Colors.greenAccent : rating >= 5 ? Colors.amber : Colors.redAccent),
                                const SizedBox(width: 3),
                                Text(
                                  rating.toStringAsFixed(1),
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                    color: rating >= 7 ? Colors.greenAccent : rating >= 5 ? Colors.amber : Colors.redAccent,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // Title
              Text(
                title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Shimmer Row Sliver ────────────────────────────────
class _ShimmerRowSliver extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(width: 140, height: 20, decoration: BoxDecoration(color: const Color(0xFF1a1a28), borderRadius: BorderRadius.circular(6))),
            ),
            const SizedBox(height: 14),
            SizedBox(
              height: 220,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: 6,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: SizedBox(
                      width: 130,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Container(
                              decoration: BoxDecoration(
                                color: const Color(0xFF12121c),
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Container(width: 90, height: 12, decoration: BoxDecoration(color: const Color(0xFF1a1a28), borderRadius: BorderRadius.circular(4))),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
