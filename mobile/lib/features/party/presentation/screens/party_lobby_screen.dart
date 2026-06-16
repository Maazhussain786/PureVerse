import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/media_item.dart';
import '../../../../core/models/watch_history.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../user/user_state.dart';
import '../../data/party_models.dart';
import '../widgets/create_party_sheet.dart';
import 'party_room_screen.dart';

/// Build a party seed from a catalogue item — series/anime default to S1E1 and
/// anime to subbed audio, matching how the player first opens a title.
PartyMedia _seedFromItem(MediaItem m) => PartyMedia(
      type: m.type,
      id: m.id,
      title: m.title,
      posterUrl: m.posterUrl.isEmpty ? null : m.posterUrl,
      bannerUrl: m.bannerUrl.isEmpty ? null : m.bannerUrl,
      season: m.type == 'movie' ? null : 1,
      episode: m.type == 'movie' ? null : 1,
      category: m.type == 'anime' ? 'sub' : null,
    );

PartyMedia _seedFromHistory(WatchHistoryItem h) => PartyMedia(
      type: h.type,
      id: h.id,
      title: h.title,
      posterUrl: h.posterUrl.isEmpty ? null : h.posterUrl,
      season: h.type == 'movie' ? null : (h.season ?? 1),
      episode: h.type == 'movie' ? null : (h.episode ?? 1),
      category: h.type == 'anime' ? 'sub' : null,
    );

class PartyLobbyScreen extends ConsumerStatefulWidget {
  const PartyLobbyScreen({super.key});

  @override
  ConsumerState<PartyLobbyScreen> createState() => _PartyLobbyScreenState();
}

class _PartyLobbyScreenState extends ConsumerState<PartyLobbyScreen> {
  final _joinCode = TextEditingController();
  final _search = TextEditingController();
  Timer? _refresh;
  List<PublicRoom> _rooms = const [];
  bool _roomsLoaded = false;
  List<MediaItem> _results = const [];
  bool _searching = false;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _loadRooms();
    _refresh = Timer.periodic(const Duration(seconds: 10), (_) => _loadRooms());
  }

  @override
  void dispose() {
    _joinCode.dispose();
    _search.dispose();
    _refresh?.cancel();
    _searchDebounce?.cancel();
    super.dispose();
  }

  Future<void> _loadRooms() async {
    try {
      final raw = await ref.read(apiClientProvider).listPartyRooms();
      if (!mounted) return;
      setState(() {
        _rooms = raw.map(PublicRoom.fromJson).toList();
        _roomsLoaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _roomsLoaded = true);
    }
  }

  void _onSearchChanged(String q) {
    _searchDebounce?.cancel();
    if (q.trim().length < 2) {
      setState(() {
        _results = const [];
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    _searchDebounce = Timer(const Duration(milliseconds: 400), () async {
      try {
        final r = await ref.read(apiClientProvider).search(q.trim());
        if (mounted) setState(() => _results = r);
      } catch (_) {
        if (mounted) setState(() => _results = const []);
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  void _openRoom(String code) {
    Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => PartyRoomScreen(code: code)));
  }

  void _joinByCode() {
    final code = _joinCode.text.trim().toUpperCase();
    if (code.length >= 4) _openRoom(code);
  }

  @override
  Widget build(BuildContext context) {
    final continueWatching = ref.watch(userStateProvider).continueWatching;
    final trending = ref.watch(trendingProvider).valueOrNull ?? const [];

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(
        backgroundColor: AppColors.bgPrimary,
        title: const Text('Watch Party'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _joinByCodeRow(),
          const SizedBox(height: 24),
          _sectionTitle('Live public rooms'),
          const SizedBox(height: 12),
          _publicRooms(),
          const SizedBox(height: 28),
          _sectionTitle('Start a party'),
          const SizedBox(height: 4),
          const Text('Pick something to watch together.',
              style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
          const SizedBox(height: 12),
          _searchField(),
          if (_results.isNotEmpty) ...[
            const SizedBox(height: 16),
            _rail('Search results', _results.map(_seedFromItem).toList()),
          ],
          if (continueWatching.isNotEmpty) ...[
            const SizedBox(height: 16),
            _rail('Continue watching',
                continueWatching.map(_seedFromHistory).toList()),
          ],
          if (trending.isNotEmpty) ...[
            const SizedBox(height: 16),
            _rail('Trending', trending.map(_seedFromItem).toList()),
          ],
        ],
      ),
    );
  }

  Widget _joinByCodeRow() {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _joinCode,
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(
                color: Colors.white, letterSpacing: 3, fontWeight: FontWeight.bold),
            onSubmitted: (_) => _joinByCode(),
            decoration: InputDecoration(
              hintText: 'Enter room code',
              hintStyle: const TextStyle(
                  color: AppColors.textMuted, letterSpacing: 0),
              filled: true,
              fillColor: AppColors.glassBackground,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.md),
                borderSide: const BorderSide(color: AppColors.glassBorder),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.md),
                borderSide: const BorderSide(color: AppColors.glassBorder),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        ElevatedButton(onPressed: _joinByCode, child: const Text('Join')),
      ],
    );
  }

  Widget _sectionTitle(String t) => Text(t,
      style: const TextStyle(
          color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold));

  Widget _publicRooms() {
    if (!_roomsLoaded) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
      );
    }
    if (_rooms.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.glassBackground,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: const Text('No public rooms right now. Start one below!',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
      );
    }
    return Column(children: _rooms.map(_roomCard).toList());
  }

  Widget _roomCard(PublicRoom r) {
    return InkWell(
      onTap: () => _openRoom(r.code),
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.glassBackground,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 44,
                height: 64,
                child: r.posterUrl != null && r.posterUrl!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: r.posterUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) =>
                            Container(color: AppColors.bgCard),
                      )
                    : Container(color: AppColors.bgCard),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(r.mediaTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 12)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.people_alt_rounded,
                          size: 13, color: AppColors.textMuted),
                      const SizedBox(width: 4),
                      Text('${r.memberCount} watching',
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 11)),
                      if (r.hasPassword) ...[
                        const SizedBox(width: 10),
                        const Icon(Icons.lock_rounded,
                            size: 12, color: AppColors.textMuted),
                      ],
                      const Spacer(),
                      Text(r.code,
                          style: const TextStyle(
                              color: AppColors.teal,
                              fontSize: 11,
                              letterSpacing: 2,
                              fontWeight: FontWeight.bold)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _searchField() {
    return TextField(
      controller: _search,
      onChanged: _onSearchChanged,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: 'Search movies, series, anime…',
        hintStyle: const TextStyle(color: AppColors.textMuted),
        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted),
        suffixIcon: _searching
            ? const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.accent)),
              )
            : null,
        filled: true,
        fillColor: AppColors.glassBackground,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.glassBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.md),
          borderSide: const BorderSide(color: AppColors.glassBorder),
        ),
      ),
    );
  }

  Widget _rail(String title, List<PartyMedia> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8)),
        const SizedBox(height: 10),
        SizedBox(
          height: 190,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (_, i) => _posterTile(items[i]),
          ),
        ),
      ],
    );
  }

  Widget _posterTile(PartyMedia m) {
    return GestureDetector(
      onTap: () => CreatePartySheet.show(context, m),
      child: SizedBox(
        width: 110,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.md),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (m.posterUrl != null && m.posterUrl!.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: m.posterUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, _, _) =>
                            Container(color: AppColors.bgCard),
                      )
                    else
                      Container(color: AppColors.bgCard),
                    Positioned(
                      right: 6,
                      bottom: 6,
                      child: Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.teal,
                          borderRadius: BorderRadius.circular(AppRadii.full),
                        ),
                        child: const Text('+ PARTY',
                            style: TextStyle(
                                color: AppColors.onAccent,
                                fontSize: 9,
                                fontWeight: FontWeight.w900)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(m.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
