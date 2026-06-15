import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/media_item.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../../shared/widgets/media_rail.dart';
import '../../../../shared/widgets/media_poster_card.dart';
import '../../../details/presentation/screens/details_screen.dart';

// ─── Per-category configuration (ported 1:1 from web CategoryBrowser) ───
class _Genre {
  final String label;
  final int id;
  const _Genre(this.label, this.id);
}

class _RowCfg {
  final String title;
  final String endpoint;
  const _RowCfg(this.title, this.endpoint);
}

class _CategoryCfg {
  final String heading;
  final String tagline;
  final String heroEndpoint;
  final List<_RowCfg> baseRows;
  final List<_Genre> genres;
  const _CategoryCfg({
    required this.heading,
    required this.tagline,
    required this.heroEndpoint,
    required this.baseRows,
    required this.genres,
  });
}

const Map<String, _CategoryCfg> _config = {
  'movies': _CategoryCfg(
    heading: 'Movies',
    tagline: 'Blockbusters, hidden gems and everything in between.',
    heroEndpoint: '/trending/movies',
    baseRows: [
      _RowCfg('Trending Now', '/trending/movies'),
      _RowCfg('New Releases', '/now-playing'),
      _RowCfg('Top Rated', '/top-rated/movies'),
    ],
    genres: [
      _Genre('Action', 28),
      _Genre('Comedy', 35),
      _Genre('Sci-Fi', 878),
      _Genre('Horror', 27),
      _Genre('Romance', 10749),
      _Genre('Thriller', 53),
      _Genre('Adventure', 12),
      _Genre('Fantasy', 14),
      _Genre('Drama', 18),
      _Genre('Mystery', 9648),
      _Genre('Animation', 16),
      _Genre('Family', 10751),
    ],
  ),
  'series': _CategoryCfg(
    heading: 'TV Series',
    tagline: 'Binge-worthy shows, from prestige drama to cult comedy.',
    heroEndpoint: '/trending/series',
    baseRows: [
      _RowCfg('Trending Now', '/trending/series'),
      _RowCfg('Top Rated', '/top-rated/series'),
    ],
    genres: [
      _Genre('Action & Adventure', 10759),
      _Genre('Comedy', 35),
      _Genre('Drama', 18),
      _Genre('Sci-Fi & Fantasy', 10765),
      _Genre('Crime', 80),
      _Genre('Mystery', 9648),
      _Genre('Animation', 16),
      _Genre('Family', 10751),
      _Genre('War & Politics', 10768),
      _Genre('Documentary', 99),
    ],
  ),
  'anime': _CategoryCfg(
    heading: 'Anime',
    tagline: 'From shonen juggernauts to seasonal sleepers.',
    heroEndpoint: '/trending/anime',
    baseRows: [
      _RowCfg('Trending This Season', '/trending/anime'),
      _RowCfg('All-Time Popular', '/popular/anime'),
    ],
    genres: [
      _Genre('Action & Adventure', 10759),
      _Genre('Comedy', 35),
      _Genre('Drama', 18),
      _Genre('Sci-Fi & Fantasy', 10765),
      _Genre('Mystery', 9648),
      _Genre('Crime', 80),
      _Genre('Family', 10751),
    ],
  ),
};

const _sorts = [
  ('popular', 'Most Popular'),
  ('top_rated', 'Top Rated'),
  ('newest', 'Newest First'),
];

class BrowseScreen extends ConsumerStatefulWidget {
  final String category; // movies | series | anime
  const BrowseScreen({super.key, required this.category});

  @override
  ConsumerState<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends ConsumerState<BrowseScreen> {
  _Genre? _activeGenre;
  String _sort = 'popular';

  List<MediaItem> _gridItems = [];
  bool _gridLoading = false;
  bool _loadingMore = false;
  int _page = 1;
  bool _hasMore = true;

  _CategoryCfg get _cfg => _config[widget.category]!;
  bool get _isGridMode => _activeGenre != null || _sort != 'popular';

  Future<void> _fetchGrid(int page, {required bool append}) async {
    setState(() {
      if (append) {
        _loadingMore = true;
      } else {
        _gridLoading = true;
      }
    });
    try {
      final items = await ref.read(apiClientProvider).discover(
            widget.category,
            genre: _activeGenre?.id,
            sort: _sort,
            page: page,
          );
      if (!mounted) return;
      setState(() {
        _hasMore = items.length >= 20;
        _gridItems = append ? [..._gridItems, ...items] : items;
      });
    } catch (_) {
      if (mounted && !append) setState(() => _gridItems = []);
    } finally {
      if (mounted) {
        setState(() {
          _gridLoading = false;
          _loadingMore = false;
        });
      }
    }
  }

  void _onFilterChanged() {
    _page = 1;
    if (_isGridMode) _fetchGrid(1, append: false);
  }

  void _selectGenre(_Genre? g) {
    setState(() => _activeGenre = g);
    _onFilterChanged();
  }

  void _selectSort(String s) {
    setState(() => _sort = s);
    _onFilterChanged();
  }

  void _loadMore() {
    _page += 1;
    _fetchGrid(_page, append: true);
  }

  void _openSearch() {
    showSearch<void>(
      context: context,
      delegate: _BrowseSearchDelegate(ref, widget.category, _cfg.heading),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hero = ref.watch(endpointListProvider(_cfg.heroEndpoint));

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: _CategoryHero(
              cfg: _cfg,
              onSearch: _openSearch,
              item: hero.valueOrNull?.isNotEmpty == true
                  ? hero.value!.first
                  : null,
            ),
          ),
          SliverPersistentHeader(
            pinned: true,
            delegate: _FilterBarDelegate(
              child: _filterBar(),
            ),
          ),
          if (_isGridMode) ..._gridSlivers() else ..._browseSlivers(),
          const SliverToBoxAdapter(child: SizedBox(height: 40)),
        ],
      ),
    );
  }

  // ─── Filter bar (genre chips + sort) ───
  Widget _filterBar() {
    return Container(
      color: AppColors.bgPrimary.withValues(alpha: 0.95),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  _chip('All', _activeGenre == null, () => _selectGenre(null)),
                  for (final g in _cfg.genres)
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: _chip(g.label, _activeGenre?.id == g.id,
                          () => _selectGenre(_activeGenre?.id == g.id ? null : g)),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: _sortMenu(),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.accent : AppColors.glassBackground,
          borderRadius: BorderRadius.circular(AppRadii.full),
          border: Border.all(
              color: active ? AppColors.accent : AppColors.glassBorder),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: active ? AppColors.onAccent : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _sortMenu() {
    return PopupMenuButton<String>(
      color: AppColors.bgElevated,
      initialValue: _sort,
      onSelected: _selectSort,
      itemBuilder: (_) => [
        for (final s in _sorts)
          PopupMenuItem<String>(
            value: s.$1,
            child: Text(
              s.$2,
              style: TextStyle(
                color: _sort == s.$1
                    ? AppColors.accent
                    : AppColors.textPrimary,
                fontSize: 13,
              ),
            ),
          ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.glassBackground,
          borderRadius: BorderRadius.circular(AppRadii.full),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.sort_rounded,
                size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 6),
            Text(
              _sorts.firstWhere((s) => s.$1 == _sort).$2,
              style: const TextStyle(
                  color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Browse mode: lazily-loaded rows ───
  List<Widget> _browseSlivers() {
    final rows = <_RowCfg>[
      ..._cfg.baseRows,
      for (final g in _cfg.genres)
        _RowCfg(g.label, '/discover/${widget.category}?genre=${g.id}'),
    ];
    return [
      SliverList.builder(
        itemCount: rows.length,
        itemBuilder: (_, i) => _LazyRow(title: rows[i].title, endpoint: rows[i].endpoint),
      ),
    ];
  }

  // ─── Grid mode: discover results + load more ───
  List<Widget> _gridSlivers() {
    if (_gridLoading) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 60),
            child: Center(
                child: CircularProgressIndicator(color: AppColors.accent)),
          ),
        ),
      ];
    }
    if (_gridItems.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 32),
            child: Column(
              children: [
                const Icon(Icons.search_off_rounded,
                    size: 48, color: AppColors.textMuted),
                const SizedBox(height: 12),
                const Text('Nothing found here',
                    style: TextStyle(
                        color: AppColors.textSecondary, fontSize: 15)),
                const SizedBox(height: 4),
                const Text('Try a different genre or sorting option.',
                    style:
                        TextStyle(color: AppColors.textMuted, fontSize: 12)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _activeGenre = null;
                      _sort = 'popular';
                    });
                  },
                  child: const Text('Reset filters'),
                ),
              ],
            ),
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            childAspectRatio: 0.5,
            crossAxisSpacing: 12,
            mainAxisSpacing: 16,
          ),
          delegate: SliverChildBuilderDelegate(
            (_, i) =>
                MediaPosterCard(item: _gridItems[i], width: double.infinity),
            childCount: _gridItems.length,
          ),
        ),
      ),
      if (_hasMore)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: OutlinedButton(
                onPressed: _loadingMore ? null : _loadMore,
                child: _loadingMore
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.accent),
                      )
                    : const Text('Load More'),
              ),
            ),
          ),
        ),
    ];
  }
}

// ─── Lazy row — fetches its endpoint only when scrolled into view ───
class _LazyRow extends ConsumerWidget {
  final String title;
  final String endpoint;
  const _LazyRow({required this.title, required this.endpoint});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MediaRail(
      title: title,
      items: ref.watch(endpointListProvider(endpoint)),
    );
  }
}

// ─── Category hero ───
class _CategoryHero extends StatelessWidget {
  final _CategoryCfg cfg;
  final MediaItem? item;
  final VoidCallback onSearch;
  const _CategoryHero(
      {required this.cfg, required this.item, required this.onSearch});

  @override
  Widget build(BuildContext context) {
    final bg = item == null
        ? ''
        : (item!.bannerUrl.isNotEmpty ? item!.bannerUrl : item!.posterUrl);

    return SizedBox(
      height: 300,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (bg.isNotEmpty)
            CachedNetworkImage(imageUrl: bg, fit: BoxFit.cover, memCacheWidth: 800)
          else
            Container(color: AppColors.bgSecondary),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.bgPrimary.withValues(alpha: 0.15),
                  AppColors.bgPrimary.withValues(alpha: 0.6),
                  AppColors.bgPrimary,
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
            ),
          ),
          Positioned(
            top: 0,
            right: 8,
            child: SafeArea(
              child: Material(
                color: Colors.black.withValues(alpha: 0.35),
                shape: const CircleBorder(),
                child: IconButton(
                  icon: const Icon(Icons.search_rounded, color: Colors.white),
                  tooltip: 'Search ${cfg.heading}',
                  onPressed: onSearch,
                ),
              ),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'PUREVERSE · ${cfg.heading.toUpperCase()}',
                  style: const TextStyle(
                      color: AppColors.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2),
                ),
                const SizedBox(height: 8),
                Text(
                  cfg.heading,
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      height: 1.1),
                ),
                const SizedBox(height: 6),
                Text(
                  cfg.tagline,
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item != null) ...[
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => DetailsScreen(item: item!),
                    )),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Now trending: ',
                            style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
                                fontWeight: FontWeight.w600)),
                        Flexible(
                          child: Text(
                            item!.title,
                            style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.bold),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded,
                            color: AppColors.accent, size: 18),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Category-scoped search (opened from the hero search button) ───
class _BrowseSearchDelegate extends SearchDelegate<void> {
  final WidgetRef ref;
  final String category; // movies | series | anime
  final String heading;
  _BrowseSearchDelegate(this.ref, this.category, this.heading)
      : super(searchFieldLabel: 'Search $heading…');

  String get _type => category == 'movies'
      ? 'movie'
      : category == 'series'
          ? 'tv'
          : 'anime';

  // Dedup identical-query rebuilds (buildSuggestions fires on every keystroke).
  String? _lastQuery;
  Future<List<MediaItem>>? _future;
  Future<List<MediaItem>> _search(String q) {
    if (q != _lastQuery) {
      _lastQuery = q;
      _future = ref.read(apiClientProvider).search(q);
    }
    return _future!;
  }

  @override
  ThemeData appBarTheme(BuildContext context) {
    final base = Theme.of(context);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.bgPrimary,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.bgPrimary,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        hintStyle: TextStyle(color: AppColors.textMuted),
        border: InputBorder.none,
      ),
      textTheme: base.textTheme.copyWith(
        titleLarge: const TextStyle(color: AppColors.textPrimary, fontSize: 18),
      ),
    );
  }

  @override
  List<Widget> buildActions(BuildContext context) => [
        if (query.isNotEmpty)
          IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () => query = '',
          ),
      ];

  @override
  Widget buildLeading(BuildContext context) => IconButton(
        icon: const Icon(Icons.arrow_back_rounded),
        onPressed: () => close(context, null),
      );

  @override
  Widget buildResults(BuildContext context) => _grid(context);

  @override
  Widget buildSuggestions(BuildContext context) => _grid(context);

  Widget _grid(BuildContext context) {
    final q = query.trim();
    if (q.length < 2) {
      return const Center(
        child: Text('Type at least 2 characters',
            style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
      );
    }
    return Container(
      color: AppColors.bgPrimary,
      child: FutureBuilder<List<MediaItem>>(
        future: _search(q),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(
                child: CircularProgressIndicator(color: AppColors.accent));
          }
          final list =
              (snap.data ?? const <MediaItem>[]).where((m) => m.type == _type).toList();
          if (list.isEmpty) {
            return Center(
              child: Text('No $heading found for “$q”',
                  style:
                      const TextStyle(color: AppColors.textMuted, fontSize: 13)),
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              childAspectRatio: 0.5,
              crossAxisSpacing: 12,
              mainAxisSpacing: 16,
            ),
            itemCount: list.length,
            itemBuilder: (_, i) =>
                MediaPosterCard(item: list[i], width: double.infinity),
          );
        },
      ),
    );
  }
}

// ─── Pinned filter-bar delegate ───
class _FilterBarDelegate extends SliverPersistentHeaderDelegate {
  final Widget child;
  _FilterBarDelegate({required this.child});

  static const double _height = 58;

  @override
  double get minExtent => _height;
  @override
  double get maxExtent => _height;

  @override
  Widget build(
          BuildContext context, double shrinkOffset, bool overlapsContent) =>
      SizedBox(height: _height, child: child);

  @override
  bool shouldRebuild(covariant _FilterBarDelegate oldDelegate) => true;
}
