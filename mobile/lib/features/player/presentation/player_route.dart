import 'package:flutter/material.dart';

import 'screens/catalog_player_screen.dart';
import 'screens/embed_player_screen.dart';

/// Single entry point for opening a title.
///
/// Anime defaults to the embed **web player**: on-device stream extraction is
/// slow and unreliable for anime (and the direct HiAnime path is off), so the
/// provider's own player starts faster and "just works". Movies & TV use the
/// native player (custom controls, quality, resume-progress tracking), which
/// already auto-falls back to the web player if no direct stream can be
/// captured. Either way the in-player Server menu lets users switch.
Route<void> playerRoute({
  required String mediaType, // movie | tv | anime
  required String mediaId,
  required String title,
  String posterUrl = '',
  double rating = 0,
  int releaseYear = 0,
  int? totalSeasons,
  int? season,
  int? episode,
  String? episodeTitle,
}) {
  final useWebPlayer = mediaType == 'anime';
  return MaterialPageRoute(
    builder: (_) => useWebPlayer
        ? EmbedPlayerScreen(
            mediaType: mediaType,
            mediaId: mediaId,
            title: title,
            posterUrl: posterUrl,
            rating: rating,
            releaseYear: releaseYear,
            totalSeasons: totalSeasons,
            season: season,
            episode: episode,
            episodeTitle: episodeTitle,
          )
        : CatalogPlayerScreen(
            mediaType: mediaType,
            mediaId: mediaId,
            title: title,
            posterUrl: posterUrl,
            rating: rating,
            releaseYear: releaseYear,
            totalSeasons: totalSeasons,
            season: season,
            episode: episode,
            episodeTitle: episodeTitle,
          ),
  );
}
