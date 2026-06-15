import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/media_details.dart';
import '../../../../shared/providers/api_providers.dart';

/// Bottom sheet for switching season + episode from inside a player.
///
/// Opens over the playing video; selecting an episode invokes [onSelect] and
/// closes the sheet. For titles whose episode list can't be resolved (e.g. a
/// MAL-only anime), it falls back to a numeric episode stepper so the user can
/// still jump to the next/previous episode.
Future<void> showEpisodePicker(
  BuildContext context, {
  required String mediaId,
  required int totalSeasons,
  required int currentSeason,
  required int currentEpisode,
  required void Function(int season, int episode, String? title) onSelect,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.bgCard,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => EpisodePickerSheet(
      mediaId: mediaId,
      totalSeasons: totalSeasons,
      currentSeason: currentSeason,
      currentEpisode: currentEpisode,
      onSelect: onSelect,
    ),
  );
}

class EpisodePickerSheet extends ConsumerStatefulWidget {
  final String mediaId; // prefixed (tmdb_/mal_)
  final int totalSeasons;
  final int currentSeason;
  final int currentEpisode;
  final void Function(int season, int episode, String? title) onSelect;

  const EpisodePickerSheet({
    super.key,
    required this.mediaId,
    required this.totalSeasons,
    required this.currentSeason,
    required this.currentEpisode,
    required this.onSelect,
  });

  @override
  ConsumerState<EpisodePickerSheet> createState() => _EpisodePickerSheetState();
}

class _EpisodePickerSheetState extends ConsumerState<EpisodePickerSheet> {
  late int _season = widget.currentSeason < 1 ? 1 : widget.currentSeason;
  late int _stepperEpisode = widget.currentEpisode < 1 ? 1 : widget.currentEpisode;

  int get _totalSeasons =>
      widget.totalSeasons < 1 ? 1 : widget.totalSeasons;

  void _pick(int season, int episode, String? title) {
    Navigator.of(context).pop();
    widget.onSelect(season, episode, title);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(seasonEpisodesProvider('${widget.mediaId}:$_season'));

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.75,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.textMuted,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.video_library_rounded,
                      color: AppColors.accent, size: 18),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text('Episodes',
                        style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700)),
                  ),
                  if (_totalSeasons > 1) _seasonDropdown(),
                ],
              ),
              const SizedBox(height: 12),
              Flexible(
                child: async.when(
                  data: (eps) =>
                      eps.isEmpty ? _stepper() : _episodeList(eps),
                  loading: () => const Padding(
                    padding: EdgeInsets.all(28),
                    child: Center(
                        child: CircularProgressIndicator(
                            color: AppColors.accent)),
                  ),
                  error: (_, _) => _stepper(),
                ),
              ),
            ],
          ),
        ),
      ),
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
            value: _season.clamp(1, _totalSeasons),
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

  Widget _episodeList(List<Episode> eps) {
    return ListView.separated(
      shrinkWrap: true,
      itemCount: eps.length,
      separatorBuilder: (_, _) => const SizedBox(height: 6),
      itemBuilder: (_, i) {
        final e = eps[i];
        final active =
            (e.seasonNumber ?? _season) == widget.currentSeason &&
                e.episodeNumber == widget.currentEpisode;
        return InkWell(
          onTap: () =>
              _pick(e.seasonNumber ?? _season, e.episodeNumber, e.title),
          borderRadius: BorderRadius.circular(10),
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: active ? AppColors.accentSubtle : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: active ? AppColors.accent : AppColors.bgElevated,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('${e.episodeNumber}',
                      style: TextStyle(
                          color: active
                              ? AppColors.onAccent
                              : AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                          fontSize: 13)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(e.title.isEmpty ? 'Episode ${e.episodeNumber}' : e.title,
                      style: TextStyle(
                          color: active
                              ? AppColors.accent
                              : AppColors.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
                if (active)
                  const Icon(Icons.equalizer_rounded,
                      color: AppColors.accent, size: 18)
                else
                  const Icon(Icons.play_arrow_rounded,
                      color: AppColors.textMuted, size: 20),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Fallback when no episode list is available — jump by episode number.
  Widget _stepper() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Episode list unavailable for this title.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: _stepperEpisode > 1
                    ? () => setState(() => _stepperEpisode--)
                    : null,
                icon: const Icon(Icons.remove_circle_outline_rounded),
                color: AppColors.textPrimary,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text('Episode $_stepperEpisode',
                    style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700)),
              ),
              IconButton(
                onPressed: () => setState(() => _stepperEpisode++),
                icon: const Icon(Icons.add_circle_outline_rounded),
                color: AppColors.textPrimary,
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _pick(_season, _stepperEpisode, null),
              child: Text('Play S$_season · E$_stepperEpisode'),
            ),
          ),
        ],
      ),
    );
  }
}
