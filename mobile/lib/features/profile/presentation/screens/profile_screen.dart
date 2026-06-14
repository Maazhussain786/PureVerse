import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/models/user_profile.dart';
import '../../../../core/models/demo_media.dart';
import '../../../auth/auth_controller.dart';
import '../../../auth/sign_in_sheet.dart';
import '../../../user/user_state.dart';
import '../../../../shared/widgets/continue_watching_rail.dart';
import '../../../library/presentation/screens/library_screen.dart';
import '../../../history/presentation/screens/history_screen.dart';
import '../../../player/presentation/screens/native_player_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.bgPrimary,
      appBar: AppBar(title: const Text('Profile')),
      body: auth.booting
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.accent))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (auth.user != null)
                  _signedInCard(context, ref, auth.user!)
                else
                  _signedOutCard(context),
                if (auth.user != null) ...[
                  const SizedBox(height: 20),
                  _stats(ref),
                  const SizedBox(height: 8),
                  _continueWatching(ref),
                  const SizedBox(height: 12),
                  _preferences(ref, auth.user!),
                ],
                const SizedBox(height: 20),
                _playerPreview(context),
                const SizedBox(height: 24),
                _infoTile(Icons.cloud_done_rounded, 'Backend',
                    AppConfig.isProduction ? 'Production' : 'Local dev'),
                _infoTile(Icons.link_rounded, 'API', AppConfig.apiBaseUrl),
                const SizedBox(height: 24),
                const Center(
                  child: Text('PureVerse • v1.0.0',
                      style:
                          TextStyle(color: AppColors.textMuted, fontSize: 12)),
                ),
              ],
            ),
    );
  }

  // ─── Identity ───
  Widget _signedInCard(BuildContext context, WidgetRef ref, UserProfile user) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: AppColors.bgElevated,
                backgroundImage: user.avatar.isNotEmpty
                    ? CachedNetworkImageProvider(user.avatar)
                    : null,
                child: user.avatar.isEmpty
                    ? const Icon(Icons.person_rounded,
                        color: AppColors.textMuted, size: 28)
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(user.name,
                              style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700),
                              overflow: TextOverflow.ellipsis),
                        ),
                        if (user.isGuest) ...[
                          const SizedBox(width: 8),
                          _guestBadge(),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(user.isGuest ? 'Guest profile' : user.email,
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 12),
                        overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const LibraryScreen())),
                  icon: const Icon(Icons.bookmark_rounded, size: 18),
                  label: const Text('My List'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const HistoryScreen())),
                  icon: const Icon(Icons.history_rounded, size: 18),
                  label: const Text('History'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () =>
                  ref.read(authControllerProvider.notifier).signOut(),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Sign out'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _signedOutCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(
                color: AppColors.accentSubtle, shape: BoxShape.circle),
            child: const Icon(Icons.person_outline_rounded,
                color: AppColors.accent, size: 30),
          ),
          const SizedBox(height: 14),
          const Text('Not signed in',
              style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text('Sign in to sync your watchlist and history.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => showSignInSheet(context),
              child: const Text('Sign in'),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Live stats (from the synced UserState) ───
  Widget _stats(WidgetRef ref) {
    final state = ref.watch(userStateProvider);
    return Row(
      children: [
        _countChip('Watchlist', state.watchlist.length),
        const SizedBox(width: 10),
        _countChip('Favorites', state.favorites.length),
        const SizedBox(width: 10),
        _countChip('History', state.history.length),
      ],
    );
  }

  Widget _continueWatching(WidgetRef ref) {
    final items = ref.watch(userStateProvider.select((s) => s.continueWatching));
    if (items.isEmpty) return const SizedBox.shrink();
    return ContinueWatchingRail(
      items: items,
      onRemove: (key) =>
          ref.read(userStateProvider.notifier).removeFromHistory(key),
    );
  }

  // ─── Preferences (PATCH /user/me) ───
  Widget _preferences(WidgetRef ref, UserProfile user) {
    final prefs = user.preferences;
    void patch(Map<String, dynamic> p) =>
        ref.read(authControllerProvider.notifier).updateProfile({'preferences': p});

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        children: [
          _switchTile(
            'Autoplay next episode',
            prefs.autoplayNext,
            (v) => patch({'autoplayNext': v}),
          ),
          _divider(),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                const Expanded(
                  child: Text('Preferred anime audio',
                      style: TextStyle(
                          color: AppColors.textPrimary, fontSize: 14)),
                ),
                _audioToggle(prefs.preferredAudio,
                    (v) => patch({'preferredAudio': v})),
              ],
            ),
          ),
          _divider(),
          _switchTile(
            'New episode alerts',
            prefs.notifyNewEpisodes,
            (v) => patch({'notifyNewEpisodes': v}),
          ),
          _divider(),
          _switchTile(
            'Watch party invites',
            prefs.notifyPartyInvites,
            (v) => patch({'notifyPartyInvites': v}),
          ),
          _divider(),
          _switchTile(
            'Announcements',
            prefs.notifyAnnouncements,
            (v) => patch({'notifyAnnouncements': v}),
          ),
        ],
      ),
    );
  }

  Widget _switchTile(String label, bool value, ValueChanged<bool> onChanged) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: const TextStyle(
                    color: AppColors.textPrimary, fontSize: 14)),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppColors.onAccent,
            activeTrackColor: AppColors.accent,
          ),
        ],
      ),
    );
  }

  Widget _audioToggle(String value, ValueChanged<String> onChanged) {
    Widget opt(String v) {
      final active = value == v;
      return GestureDetector(
        onTap: () => onChanged(v),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: active ? AppColors.accent : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.full),
          ),
          child: Text(
            v.toUpperCase(),
            style: TextStyle(
              color: active ? AppColors.onAccent : AppColors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: AppColors.glassBackground,
        borderRadius: BorderRadius.circular(AppRadii.full),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [opt('sub'), opt('dub')]),
    );
  }

  // ─── Custom player preview (sample HLS streams) ───
  Widget _playerPreview(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.play_circle_outline_rounded,
                  color: AppColors.accent, size: 20),
              const SizedBox(width: 8),
              const Text('Video Player',
                  style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accentSubtle,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('BETA',
                    style: TextStyle(
                        color: AppColors.accent,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Preview the custom player — skip controls, scrubbing, and '
            'dynamic audio/subtitle switching on sample streams.',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 14),
          ...demoCatalog.map((m) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => NativePlayerScreen(media: m)),
                    ),
                    style: OutlinedButton.styleFrom(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.title,
                            style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 14,
                                fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(m.subtitle,
                            style: const TextStyle(
                                color: AppColors.textMuted, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _divider() =>
      const Divider(height: 1, color: AppColors.glassBorder);

  Widget _guestBadge() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.accentSubtle,
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Text('GUEST',
            style: TextStyle(
                color: AppColors.accent,
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 1)),
      );

  Widget _countChip(String label, int value) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.bgElevated,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Text('$value',
                  style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 11)),
            ],
          ),
        ),
      );

  Widget _infoTile(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(icon, color: AppColors.textSecondary, size: 20),
            const SizedBox(width: 14),
            Text(label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 14)),
            const Spacer(),
            Flexible(
              child: Text(value,
                  textAlign: TextAlign.right,
                  style: const TextStyle(
                      color: AppColors.textMuted, fontSize: 12),
                  overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      );
}
