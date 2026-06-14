import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/constants/app_colors.dart';
import '../../core/models/media_item.dart';
import '../../features/details/presentation/screens/details_screen.dart';

/// Poster tile with rating badge + title. Taps through to the details screen.
class MediaPosterCard extends StatelessWidget {
  final MediaItem item;
  final double width;
  const MediaPosterCard({super.key, required this.item, this.width = 130});

  static Color ratingColor(double r) => r >= 7
      ? AppColors.ratingHigh
      : r >= 5
          ? AppColors.ratingMid
          : AppColors.ratingLow;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DetailsScreen(item: item)),
      ),
      child: SizedBox(
        width: width,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _poster(),
                    if (item.rating > 0)
                      Positioned(top: 6, right: 6, child: _ratingBadge()),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              item.title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _poster() {
    if (item.posterUrl.isEmpty) {
      return Container(
        color: AppColors.bgCard,
        child: const Center(
          child: Icon(Icons.image_not_supported_outlined,
              color: AppColors.textMuted),
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: item.posterUrl,
      fit: BoxFit.cover,
      memCacheWidth: 300,
      placeholder: (_, _) => Container(color: AppColors.bgCard),
      errorWidget: (_, _, _) => Container(
        color: AppColors.bgCard,
        child: const Center(
          child: Icon(Icons.broken_image_outlined,
              color: AppColors.textMuted, size: 28),
        ),
      ),
    );
  }

  Widget _ratingBadge() {
    final color = ratingColor(item.rating);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            item.rating.toStringAsFixed(1),
            style: TextStyle(
                fontSize: 9, fontWeight: FontWeight.w600, color: color),
          ),
        ],
      ),
    );
  }
}
