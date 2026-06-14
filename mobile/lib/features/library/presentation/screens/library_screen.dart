import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';

/// Watchlist / favorites / history. Wired to synced user state in a later
/// phase (needs auth). Placeholder empty state for now.
class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(title: const Text('My Library')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: AppColors.accentSubtle,
                  shape: BoxShape.circle,
                ),
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
            ],
          ),
        ),
      ),
    );
  }
}
