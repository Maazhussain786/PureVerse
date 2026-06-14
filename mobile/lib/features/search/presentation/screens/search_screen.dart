import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../../shared/widgets/media_poster_card.dart';
import '../../../user/user_state.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      ref.read(searchQueryProvider.notifier).state = value;
    });
  }

  /// Run a search immediately (submit / recent-search tap) and remember it.
  void _submit(String value) {
    final q = value.trim();
    _debounce?.cancel();
    ref.read(searchQueryProvider.notifier).state = q;
    if (q.length >= 2) ref.read(userStateProvider.notifier).addRecentSearch(q);
  }

  void _useRecent(String q) {
    _controller.text = q;
    _controller.selection =
        TextSelection.fromPosition(TextPosition(offset: q.length));
    _submit(q);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(searchResultsProvider);
    final query = ref.watch(searchQueryProvider).trim();
    final recent = ref.watch(userStateProvider.select((s) => s.recentSearches));

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _controller,
                autofocus: false,
                textInputAction: TextInputAction.search,
                onChanged: _onChanged,
                onSubmitted: _submit,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Search movies, series, anime…',
                  prefixIcon: const Icon(Icons.search_rounded,
                      color: AppColors.textMuted),
                  suffixIcon: query.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close_rounded,
                              color: AppColors.textMuted),
                          onPressed: () {
                            _controller.clear();
                            ref.read(searchQueryProvider.notifier).state = '';
                          },
                        )
                      : null,
                ),
              ),
            ),
            Expanded(
              child: query.length < 2
                  ? _idleState(recent)
                  : _results(results, query),
            ),
          ],
        ),
      ),
    );
  }

  // Shown before the user has typed a real query: recent searches or a hint.
  Widget _idleState(List<String> recent) {
    if (recent.isEmpty) {
      return _hint(Icons.search_rounded, 'Find something to watch',
          'Type at least 2 characters.');
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Row(
          children: [
            const Text('Recent searches',
                style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600)),
            const Spacer(),
            TextButton(
              onPressed: () =>
                  ref.read(userStateProvider.notifier).clearRecentSearches(),
              child: const Text('Clear',
                  style: TextStyle(color: AppColors.accent, fontSize: 13)),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: recent
              .map((q) => ActionChip(
                    label: Text(q),
                    avatar: const Icon(Icons.history_rounded,
                        size: 16, color: AppColors.textSecondary),
                    backgroundColor: AppColors.glassBackground,
                    side: const BorderSide(color: AppColors.glassBorder),
                    labelStyle: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 13),
                    onPressed: () => _useRecent(q),
                  ))
              .toList(),
        ),
      ],
    );
  }

  Widget _results(AsyncValue results, String query) {
    return results.when(
      data: (list) {
        if (list.isEmpty) {
          return _hint(Icons.sentiment_dissatisfied_rounded, 'No results',
              'Nothing matched “$query”.');
        }
        return GridView.builder(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
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
      loading: () =>
          const Center(child: CircularProgressIndicator(color: AppColors.accent)),
      error: (e, _) => _hint(Icons.cloud_off_rounded, 'Search failed', '$e'),
    );
  }

  Widget _hint(IconData icon, String title, String subtitle) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(title,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 15)),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(subtitle,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: AppColors.textMuted, fontSize: 12)),
            ),
          ],
        ),
      );
}
