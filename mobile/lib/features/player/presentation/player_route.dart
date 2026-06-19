import 'package:flutter/material.dart';

import 'screens/embed_player_screen.dart';

/// Single entry point for opening a title.
///
/// Every type now opens in the embed **web player**: the provider's own player
/// starts faster and "just works", with no slow on-device stream extraction.
/// Movies & TV default to the **VidFast** web player; anime defaults to its
/// PureVerse SUB server. Either way the in-player Server menu lets users switch.
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
  return MaterialPageRoute(
    builder: (_) => EmbedPlayerScreen(
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
