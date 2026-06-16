import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/media_item.dart';
import '../../../../core/models/media_details.dart';
import '../../../../core/models/watch_history.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../auth/auth_controller.dart';
import '../../../auth/sign_in_sheet.dart';
import '../../../user/user_state.dart';
import '../../../player/presentation/player_route.dart';
import '../../../party/data/party_models.dart';
import '../../../party/presentation/widgets/create_party_sheet.dart';

/// Records a history entry and opens the native player. Shared by the
/// "Watch Now" button and the per-episode tiles.
void playMedia(BuildContext context, WidgetRef ref, MediaDetails d,
    {int? season, int? episode, String? episodeTitle}) {
  ref.read(userStateProvider.notifier).addToHistory(
        WatchHistoryItem.create(
          id: d.id,
          type: d.type,
          title: d.title,
          posterUrl: d.posterUrl,
          rating: d.rating,
          releaseYear: d.releaseYear,
          season: season,
          episode: episode,
          episodeTitle: episodeTitle,
        ),
      );
  Navigator.of(context).push(playerRoute(
    mediaType: d.type,
    mediaId: d.id,
    title: d.title,
    posterUrl: d.posterUrl,
    rating: d.rating,
    releaseYear: d.releaseYear,
    totalSeasons: d.totalSeasons,
    season: season,
    episode: episode,
    episodeTitle: episodeTitle,
  ));
}

class DetailsScreen extends ConsumerWidget {
  final MediaItem item;
  const DetailsScreen({super.key, required this.item});

  void _play(BuildContext context, WidgetRef ref, MediaDetails d,
          {int? season, int? episode, String? episodeTitle}) =>
      playMedia(context, ref, d,
          season: season, episode: episode, episodeTitle: episodeTitle);

  /// A watch-party seed for this title — series/anime start at S1E1, anime subbed.
  PartyMedia _partySeed(MediaDetails d) => PartyMedia(
        type: d.type,
        id: d.id,
        title: d.title,
        posterUrl: d.posterUrl.isEmpty ? null : d.posterUrl,
        season: d.type == 'movie' ? null : 1,
        episode: d.type == 'movie' ? null : 1,
        category: d.type == 'anime' ? 'sub' : null,
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(mediaDetailsProvider('${item.type}/${item.id}'));

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      body: CustomScrollView(
        slivers: [
          _appBar(context),
          SliverToBoxAdapter(
            child: async.when(
              data: (d) => _content(context, ref, d),
              loading: () => _loadingHeader(),
              error: (e, _) => _errorBody(e),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  SliverAppBar _appBar(BuildContext context) {
    final bg = item.bannerUrl.isNotEmpty ? item.bannerUrl : item.posterUrl;
    return SliverAppBar(
      pinned: true,
      expandedHeight: 280,
      backgroundColor: AppColors.bgPrimary,
      iconTheme: const IconThemeData(color: Colors.white),
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
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
                    Colors.black.withValues(alpha: 0.3),
                    AppColors.bgPrimary.withValues(alpha: 0.6),
                    AppColors.bgPrimary,
                  ],
                  stops: const [0.0, 0.6, 1.0],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _content(BuildContext context, WidgetRef ref, MediaDetails d) {
    final isPlayable = d.type == 'movie';
    final episodes = d.episodes;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            d.title,
            style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
                height: 1.1),
          ),
          if (d.originalTitle != null &&
              d.originalTitle!.isNotEmpty &&
              d.originalTitle != d.title) ...[
            const SizedBox(height: 4),
            Text(d.originalTitle!,
                style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 13,
                    fontStyle: FontStyle.italic)),
          ],
          const SizedBox(height: 10),
          _metaRow(d),
          if (d.genres.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: d.genres.take(6).map(_genreChip).toList(),
            ),
          ],
          const SizedBox(height: 16),
          _LibraryActions(item: d.base),
          const SizedBox(height: 12),
          if (isPlayable)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _play(context, ref, d),
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('Watch Now'),
              ),
            ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => CreatePartySheet.show(context, _partySeed(d)),
              icon: const Icon(Icons.groups_2_rounded, color: AppColors.teal),
              label: const Text('Watch Party', style: TextStyle(color: AppColors.teal)),
              style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.teal)),
            ),
          ),
          if (d.synopsis.isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text('Overview',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 8),
            Text(d.synopsis,
                style: const TextStyle(
                    color: AppColors.textSecondary, height: 1.5, fontSize: 14)),
          ],
          if (d.cast.isNotEmpty) ...[
            const SizedBox(height: 20),
            _castSection(d.cast),
          ],
          if (d.type != 'movie' &&
              (episodes.isNotEmpty || (d.totalSeasons ?? 0) > 0)) ...[
            const SizedBox(height: 24),
            _EpisodesSection(details: d),
          ],
        ],
      ),
    );
  }

  Widget _metaRow(MediaDetails d) {
    final bits = <String>[
      if (d.releaseYear > 0) '${d.releaseYear}',
      if (d.runtime != null && d.runtime! > 0) '${d.runtime}m',
      if (d.ageRating != null && d.ageRating!.isNotEmpty) d.ageRating!,
      if (d.language != null && d.language!.isNotEmpty) d.language!,
    ];
    return Row(
      children: [
        if (d.rating > 0) ...[
          const Icon(Icons.star_rounded, size: 16, color: AppColors.lime),
          const SizedBox(width: 4),
          Text(d.rating.toStringAsFixed(1),
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13)),
          const SizedBox(width: 12),
        ],
        Expanded(
          child: Text(
            bits.join('  •  '),
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _genreChip(String g) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.glassBackground,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Text(g,
            style:
                const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
      );

  Widget _castSection(List<CastMember> cast) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Cast',
            style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary)),
        const SizedBox(height: 12),
        SizedBox(
          height: 120,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: cast.take(15).length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (_, i) {
              final c = cast[i];
              return SizedBox(
                width: 72,
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 32,
                      backgroundColor: AppColors.bgCard,
                      backgroundImage: c.profileUrl.isNotEmpty
                          ? CachedNetworkImageProvider(c.profileUrl)
                          : null,
                      child: c.profileUrl.isEmpty
                          ? const Icon(Icons.person, color: AppColors.textMuted)
                          : null,
                    ),
                    const SizedBox(height: 6),
                    Text(c.name,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textPrimary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _loadingHeader() => const Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
      );

  Widget _errorBody(Object e) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.cloud_off_rounded,
                color: AppColors.textMuted, size: 40),
            const SizedBox(height: 12),
            Text('Couldn\'t load details.\n$e',
                textAlign: TextAlign.center,
                style:
                    const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ],
        ),
      );
}

/// Watchlist + Favorite toggles backed by the synced user library. Prompts
/// sign-in when tapped while signed out.
class _LibraryActions extends ConsumerWidget {
  final MediaItem item;
  const _LibraryActions({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(userStateProvider);
    final inWatch = state.inWatchlist(item.id);
    final inFav = state.inFavorites(item.id);

    return Row(
      children: [
        Expanded(
          child: _btn(
            icon: inWatch
                ? Icons.bookmark_rounded
                : Icons.bookmark_border_rounded,
            label: inWatch ? 'In Watchlist' : 'Watchlist',
            active: inWatch,
            onTap: () => _toggle(context, ref, watchlist: true, isIn: inWatch),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _btn(
            icon: inFav
                ? Icons.favorite_rounded
                : Icons.favorite_border_rounded,
            label: inFav ? 'Favorited' : 'Favorite',
            active: inFav,
            onTap: () => _toggle(context, ref, watchlist: false, isIn: inFav),
          ),
        ),
      ],
    );
  }

  void _toggle(BuildContext context, WidgetRef ref,
      {required bool watchlist, required bool isIn}) {
    if (!ref.read(authControllerProvider).isSignedIn) {
      showSignInSheet(context);
      return;
    }
    final notifier = ref.read(userStateProvider.notifier);
    if (watchlist) {
      isIn ? notifier.removeWatchlist(item.id) : notifier.addWatchlist(item);
    } else {
      isIn ? notifier.removeFavorite(item.id) : notifier.addFavorite(item);
    }
  }

  Widget _btn({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    final color = active ? AppColors.accent : AppColors.textPrimary;
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18, color: color),
      label: Text(label,
          style: TextStyle(color: color), overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        side: BorderSide(
            color: active ? AppColors.accent : AppColors.glassBorder),
      ),
    );
  }
}

/// Episode list with a season picker. The details payload preloads the latest
/// season's episodes; switching season fetches that season on demand.
class _EpisodesSection extends ConsumerStatefulWidget {
  final MediaDetails details;
  const _EpisodesSection({required this.details});

  @override
  ConsumerState<_EpisodesSection> createState() => _EpisodesSectionState();
}

class _EpisodesSectionState extends ConsumerState<_EpisodesSection> {
  late int _season;

  int get _totalSeasons => (widget.details.totalSeasons ?? 1).clamp(1, 999);

  @override
  void initState() {
    super.initState();
    // Mirror the web app: the details payload carries the latest season.
    _season = _totalSeasons;
  }

  /// True when the selected season is the one already bundled in the details
  /// payload, so no extra fetch is needed.
  bool get _usePreloaded {
    final eps = widget.details.episodes;
    if (eps.isEmpty || _season != _totalSeasons) return false;
    final sn = eps.first.seasonNumber;
    return sn == null || sn == _season;
  }

  @override
  Widget build(BuildContext context) {
    final Widget body;
    if (_usePreloaded) {
      body = Column(children: _tiles(widget.details.episodes));
    } else {
      final async =
          ref.watch(seasonEpisodesProvider('${widget.details.id}:$_season'));
      body = async.when(
        data: (eps) =>
            eps.isEmpty ? _empty() : Column(children: _tiles(eps)),
        loading: () => const Padding(
          padding: EdgeInsets.all(28),
          child:
              Center(child: CircularProgressIndicator(color: AppColors.accent)),
        ),
        error: (_, _) => _empty(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text('Episodes',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary)),
            ),
            if (_totalSeasons > 1) _seasonDropdown(),
          ],
        ),
        const SizedBox(height: 12),
        body,
      ],
    );
  }

  Widget _seasonDropdown() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.glassBackground,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<int>(
            value: _season,
            isDense: true,
            dropdownColor: AppColors.bgElevated,
            iconEnabledColor: AppColors.textSecondary,
            borderRadius: BorderRadius.circular(12),
            style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600),
            items: [
              for (int s = 1; s <= _totalSeasons; s++)
                DropdownMenuItem(value: s, child: Text('Season $s')),
            ],
            onChanged: (v) {
              if (v != null && v != _season) setState(() => _season = v);
            },
          ),
        ),
      );

  List<Widget> _tiles(List<Episode> eps) =>
      eps.map((e) => _episodeTile(e)).toList();

  Widget _episodeTile(Episode e) {
    return InkWell(
      onTap: () => playMedia(context, ref, widget.details,
          season: e.seasonNumber ?? _season,
          episode: e.episodeNumber,
          episodeTitle: e.title),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 120,
                height: 68,
                child: e.thumbnailUrl.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: e.thumbnailUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, _) =>
                            Container(color: AppColors.bgCard),
                        errorWidget: (_, _, _) =>
                            Container(color: AppColors.bgCard),
                      )
                    : Container(
                        color: AppColors.bgCard,
                        child: const Icon(Icons.play_circle_outline,
                            color: AppColors.textMuted)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('E${e.episodeNumber}  ${e.title}',
                      style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  if (e.synopsis.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(e.synopsis,
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 11),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ],
                ],
              ),
            ),
            const Icon(Icons.play_arrow_rounded, color: AppColors.accent),
          ],
        ),
      ),
    );
  }

  Widget _empty() => const Padding(
        padding: EdgeInsets.symmetric(vertical: 28),
        child: Center(
          child: Text('No episodes available for this season.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
        ),
      );
}
