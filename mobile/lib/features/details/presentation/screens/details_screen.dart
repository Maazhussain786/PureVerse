import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/media_item.dart';
import '../../../../core/models/media_details.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../player/presentation/screens/embed_player_screen.dart';

class DetailsScreen extends ConsumerWidget {
  final MediaItem item;
  const DetailsScreen({super.key, required this.item});

  void _play(BuildContext context, MediaDetails d, {int? season, int? episode}) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => EmbedPlayerScreen(
        mediaType: d.type,
        mediaId: d.id,
        title: d.title,
        season: season,
        episode: episode,
      ),
    ));
  }

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
              data: (d) => _content(context, d),
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

  Widget _content(BuildContext context, MediaDetails d) {
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
          if (isPlayable)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _play(context, d),
                icon: const Icon(Icons.play_arrow_rounded),
                label: const Text('Watch Now'),
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
          if (episodes.isNotEmpty) ...[
            const SizedBox(height: 24),
            Text('Episodes  (${episodes.length})',
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary)),
            const SizedBox(height: 12),
            ...episodes.map((e) => _episodeTile(context, d, e)),
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

  Widget _episodeTile(BuildContext context, MediaDetails d, Episode e) {
    return InkWell(
      onTap: () => _play(context, d,
          season: e.seasonNumber, episode: e.episodeNumber),
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
