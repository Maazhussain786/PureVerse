import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/avatars.dart';

/// Opens the avatar picker. Calls [onSelect] with the chosen (SVG) avatar url.
Future<void> showAvatarPicker(
  BuildContext context, {
  String? currentAvatar,
  required ValueChanged<String> onSelect,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.bgCard,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _AvatarPickerSheet(
      currentAvatar: currentAvatar,
      onSelect: onSelect,
    ),
  );
}

class _AvatarPickerSheet extends StatefulWidget {
  final String? currentAvatar;
  final ValueChanged<String> onSelect;
  const _AvatarPickerSheet({this.currentAvatar, required this.onSelect});

  @override
  State<_AvatarPickerSheet> createState() => _AvatarPickerSheetState();
}

class _AvatarPickerSheetState extends State<_AvatarPickerSheet> {
  String _categoryKey = avatarCategories.first.key;
  String _query = '';
  int _shuffle = 0;

  AvatarCategory get _category => avatarCategories.firstWhere(
        (c) => c.key == _categoryKey,
        orElse: () => avatarCategories.first,
      );

  /// Seeds for the current category, with search (types mint a fresh avatar)
  /// and shuffle applied — mirrors the web picker.
  List<String> get _seeds {
    final q = _query.trim();
    var seeds = [..._category.seeds];
    if (q.isNotEmpty) {
      final matched =
          seeds.where((s) => s.toLowerCase().contains(q.toLowerCase()));
      seeds = [
        q,
        ...matched.where((s) => s.toLowerCase() != q.toLowerCase()),
      ];
    }
    if (_shuffle > 0) {
      seeds = seeds.map((s) => (q.isNotEmpty && s == q) ? s : '$s-$_shuffle').toList();
    }
    return seeds;
  }

  void _pick(String url) {
    Navigator.of(context).pop();
    widget.onSelect(url);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
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
              const SizedBox(height: 14),
              const Text('Choose your avatar',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 17,
                      fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              const Text('Type anything to mint your own',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
              const SizedBox(height: 12),
              _searchRow(),
              const SizedBox(height: 12),
              _categoryTabs(),
              const SizedBox(height: 12),
              Flexible(child: _grid()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _searchRow() {
    return Row(
      children: [
        Expanded(
          child: TextField(
            onChanged: (v) => setState(() => _query = v),
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(Icons.search_rounded,
                  color: AppColors.textMuted, size: 20),
              hintText: 'Search or type a name…',
            ),
          ),
        ),
        const SizedBox(width: 8),
        IconButton(
          onPressed: () => setState(() => _shuffle++),
          tooltip: 'Shuffle',
          icon: const Icon(Icons.shuffle_rounded, color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _categoryTabs() {
    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: avatarCategories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final c = avatarCategories[i];
          final active = c.key == _categoryKey;
          return GestureDetector(
            onTap: () => setState(() => _categoryKey = c.key),
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: active ? AppColors.accent : AppColors.glassBackground,
                borderRadius: BorderRadius.circular(AppRadii.full),
                border: Border.all(
                    color: active ? AppColors.accent : AppColors.glassBorder),
              ),
              child: Text(c.label,
                  style: TextStyle(
                    color: active ? AppColors.onAccent : AppColors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  )),
            ),
          );
        },
      ),
    );
  }

  Widget _grid() {
    final seeds = _seeds;
    return GridView.builder(
      padding: const EdgeInsets.only(top: 4, bottom: 8),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: seeds.length,
      itemBuilder: (_, i) {
        final url = avatarUrl(_category.style, seeds[i]);
        final selected = url == widget.currentAvatar;
        return GestureDetector(
          onTap: () => _pick(url),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.bgElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected ? AppColors.accent : AppColors.glassBorder,
                width: selected ? 2 : 1,
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: renderableAvatar(url),
                    fit: BoxFit.cover,
                    placeholder: (_, _) =>
                        Container(color: AppColors.bgCard),
                    errorWidget: (_, _, _) => const Icon(
                        Icons.person_rounded, color: AppColors.textMuted),
                  ),
                  if (selected)
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: const BoxDecoration(
                            color: AppColors.accent, shape: BoxShape.circle),
                        child: const Icon(Icons.check_rounded,
                            size: 13, color: AppColors.onAccent),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
