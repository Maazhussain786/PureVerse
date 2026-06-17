import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../shared/providers/api_providers.dart';
import '../../../auth/auth_controller.dart';
import '../../../player/presentation/widgets/episode_picker_sheet.dart';
import '../../application/party_controller.dart';
import '../../application/voice_controller.dart';
import '../../data/party_models.dart';
import '../widgets/party_chat.dart';
import '../widgets/party_members.dart';
import '../widgets/party_synced_player.dart';

/// The watch-party room: a synced player on top with a YouTube-style chat /
/// members / episodes panel below, plus the voice bar and host controls.
class PartyRoomScreen extends ConsumerStatefulWidget {
  final String code;
  const PartyRoomScreen({super.key, required this.code});

  @override
  ConsumerState<PartyRoomScreen> createState() => _PartyRoomScreenState();
}

class _PartyRoomScreenState extends ConsumerState<PartyRoomScreen> {
  int _tab = 0; // 0 chat · 1 members · 2 episodes
  int _totalSeasons = 1;
  final _gateName = TextEditingController();
  final _gatePassword = TextEditingController();
  bool _joining = false;

  // Landscape fullscreen (YouTube-live style): the player fills the screen and
  // chat becomes a toggleable overlay you can open, type in, and close.
  bool _fullscreen = false;
  bool _chatOverlay = false;
  // Keeps the same player State (and its live stream) when the layout moves
  // between the normal column and the fullscreen Stack.
  final GlobalKey _playerKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(partyControllerProvider.notifier).enterRoom(widget.code);
    });
  }

  @override
  void dispose() {
    _gateName.dispose();
    _gatePassword.dispose();
    // Restore portrait + system UI if we left while still in fullscreen.
    if (_fullscreen) {
      SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    // Leaving the screen leaves the room (also tears down the voice mesh, which
    // is an autoDispose provider scoped to this screen).
    ref.read(partyControllerProvider.notifier).leave();
    super.dispose();
  }

  // ─── Landscape fullscreen ───
  void _enterFullscreen() {
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    setState(() => _fullscreen = true);
  }

  void _exitFullscreen() {
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    setState(() {
      _fullscreen = false;
      _chatOverlay = false;
    });
  }

  void _ensureSeasons(PartyMedia media) {
    if (!media.isSeries || _totalSeasons > 1) return;
    ref
        .read(apiClientProvider)
        .getDetails(media.type, media.id)
        .then((d) {
      if (mounted && (d.totalSeasons ?? 0) > 1) {
        setState(() => _totalSeasons = d.totalSeasons!);
      }
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(partyControllerProvider);

    // Surface voice errors (permission denied / voice full) once.
    ref.listen<String?>(voiceControllerProvider.select((v) => v.error), (_, err) {
      if (err != null && mounted) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(err)));
      }
    });

    // In fullscreen, the back gesture/button exits fullscreen instead of
    // leaving the party.
    return PopScope(
      canPop: !_fullscreen,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _fullscreen) _exitFullscreen();
      },
      child: Scaffold(
        backgroundColor: AppColors.bgPrimary,
        // Keep the player full-bleed when the keyboard opens in fullscreen; the
        // chat overlay lifts its own composer above the keyboard manually.
        resizeToAvoidBottomInset: !_fullscreen,
        body: _fullscreen ? _body(st) : SafeArea(child: _body(st)),
      ),
    );
  }

  Widget _body(PartyState st) {
    switch (st.phase) {
      case PartyPhase.connecting:
      case PartyPhase.idle:
        return _centered(const CircularProgressIndicator(color: AppColors.accent),
            'Connecting to party ${widget.code}…');
      case PartyPhase.gate:
        return _gate(st);
      case PartyPhase.notFound:
        return _terminal(Icons.error_outline_rounded, 'Party not found',
            "Room ${widget.code} doesn't exist or has ended.");
      case PartyPhase.kicked:
        return _terminal(Icons.block_rounded, 'You were removed',
            'The host removed you from this party.');
      case PartyPhase.inRoom:
        return _room(st);
    }
  }

  // ─── In-room ───
  Widget _room(PartyState st) {
    final room = st.room!;
    _ensureSeasons(room.media);
    final selfMuted = st.self?.muted ?? false;

    if (_fullscreen) return _fullscreenRoom(st, room, selfMuted);

    return Column(
      children: [
        _topBar(st, room),
        PartySyncedPlayer(key: _playerKey, onToggleFullscreen: _enterFullscreen),
        _voiceBar(st),
        if (st.isHost && st.buffering.isNotEmpty && !st.holding) _bufferingStrip(st),
        _tabBar(room),
        Expanded(child: _tabBody(st, room, selfMuted)),
      ],
    );
  }

  // ─── Fullscreen (landscape) room ───
  // The player fills the screen; chat is a YouTube-live-style overlay the user
  // can open, type in, and close without leaving fullscreen.
  Widget _fullscreenRoom(PartyState st, PartyRoom room, bool selfMuted) {
    return Stack(
      children: [
        Positioned.fill(
          child: PartySyncedPlayer(
            key: _playerKey,
            fullscreen: true,
            chatOpen: _chatOverlay,
            onToggleFullscreen: _exitFullscreen,
            onToggleChat: () => setState(() => _chatOverlay = !_chatOverlay),
          ),
        ),
        if (_chatOverlay) _chatOverlayPanel(st, room, selfMuted),
      ],
    );
  }

  Widget _chatOverlayPanel(PartyState st, PartyRoom room, bool selfMuted) {
    final size = MediaQuery.of(context).size;
    final insets = MediaQuery.of(context).viewInsets;
    final panelWidth = (size.width * 0.42).clamp(300.0, 460.0);
    return Positioned(
      top: 0,
      right: 0,
      bottom: 0,
      width: panelWidth,
      child: Material(
        color: Colors.black.withValues(alpha: 0.82),
        child: SafeArea(
          left: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
                child: Row(
                  children: [
                    const Icon(Icons.chat_bubble_rounded,
                        size: 16, color: AppColors.teal),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('Live chat · ${room.members.length}',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w700)),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.close_rounded,
                          color: Colors.white, size: 20),
                      tooltip: 'Close chat',
                      onPressed: () => setState(() => _chatOverlay = false),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.glassBorder),
              // Lift the composer above the soft keyboard manually (the Scaffold
              // doesn't resize in fullscreen, so the player stays full-bleed).
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(bottom: insets.bottom),
                  child: PartyChat(
                    messages: room.chat,
                    selfId: st.selfId,
                    muted: selfMuted,
                    onSend: ref.read(partyControllerProvider.notifier).sendChat,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _topBar(PartyState st, PartyRoom room) {
    final sub = StringBuffer(room.media.title);
    if (room.media.isSeries && room.media.episode != null) {
      sub.write(' · S${room.media.season ?? 1} E${room.media.episode}');
    }
    sub.write(' · ${room.members.length} watching');

    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 8, 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: st.connected ? AppColors.teal : AppColors.ratingLow,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(room.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w700)),
                    ),
                  ],
                ),
                Text(sub.toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        const TextStyle(color: AppColors.textMuted, fontSize: 11)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Invite',
            icon: const Icon(Icons.person_add_alt_1_rounded, color: Colors.white),
            onPressed: () => _inviteDialog(room.code),
          ),
          if (st.isHost)
            IconButton(
              tooltip: 'Room settings',
              icon: const Icon(Icons.settings_rounded, color: Colors.white),
              onPressed: () => _settingsDialog(room),
            ),
        ],
      ),
    );
  }

  Widget _voiceBar(PartyState st) {
    final voice = ref.watch(voiceControllerProvider);
    final notifier = ref.read(voiceControllerProvider.notifier);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(
        color: AppColors.bgSecondary,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Row(
        children: [
          if (!voice.inVoice) ...[
            _pillButton(
              icon: Icons.headset_mic_rounded,
              label: voice.connecting ? 'Joining…' : 'Join voice',
              color: AppColors.teal,
              onTap: voice.connecting ? null : notifier.joinVoice,
            ),
            const Spacer(),
            Text(_voiceCountLabel(st),
                style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
          ] else ...[
            _circleToggle(
              active: voice.micOn,
              activeIcon: Icons.mic_rounded,
              inactiveIcon: Icons.mic_off_rounded,
              onTap: notifier.toggleMic,
              activeColor: AppColors.teal,
            ),
            const SizedBox(width: 10),
            _circleToggle(
              active: !voice.deafened,
              activeIcon: Icons.headset_rounded,
              inactiveIcon: Icons.headset_off_rounded,
              onTap: notifier.toggleDeafen,
              activeColor: AppColors.accent,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                voice.deafened
                    ? 'Deafened — you only hear the video'
                    : '${voice.peerCount + 1} in voice',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            TextButton(
              onPressed: notifier.leaveVoice,
              child: const Text('Leave',
                  style: TextStyle(color: AppColors.ratingLow, fontSize: 13)),
            ),
          ],
        ],
      ),
    );
  }

  String _voiceCountLabel(PartyState st) {
    final n = st.room?.members.where((m) => m.inVoice).length ?? 0;
    if (n == 0) return 'Talk with the room';
    return '$n in voice';
  }

  Widget _bufferingStrip(PartyState st) {
    final names = st.buffering.map((b) => b.name).take(3).join(', ');
    return Container(
      width: double.infinity,
      color: AppColors.ratingMid.withValues(alpha: 0.12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Row(
        children: [
          const Icon(Icons.hourglass_top_rounded,
              size: 14, color: AppColors.ratingMid),
          const SizedBox(width: 8),
          Expanded(
            child: Text('$names buffering',
                style:
                    const TextStyle(color: AppColors.ratingMid, fontSize: 11)),
          ),
        ],
      ),
    );
  }

  Widget _tabBar(PartyRoom room) {
    final tabs = <String>['Chat', 'Members (${room.members.length})'];
    if (room.media.isSeries) tabs.add('Episodes');
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: Row(
        children: [
          for (int i = 0; i < tabs.length; i++)
            Expanded(
              child: InkWell(
                onTap: () => setState(() => _tab = i),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: _tab == i ? AppColors.accent : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(tabs[i],
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: _tab == i ? Colors.white : AppColors.textMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      )),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _tabBody(PartyState st, PartyRoom room, bool selfMuted) {
    if (_tab == 1) {
      return PartyMembers(
        members: room.members,
        selfId: st.selfId,
        selfIsHost: st.isHost,
        onMod: (action, target) =>
            ref.read(partyControllerProvider.notifier).emitMod(action, target),
      );
    }
    if (_tab == 2 && room.media.isSeries) {
      return _episodesTab(st, room);
    }
    return PartyChat(
      messages: room.chat,
      selfId: st.selfId,
      muted: selfMuted,
      onSend: ref.read(partyControllerProvider.notifier).sendChat,
    );
  }

  Widget _episodesTab(PartyState st, PartyRoom room) {
    if (!st.isHost) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Only the host can change the episode for everyone.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
        ),
      );
    }
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
                'Now playing: S${room.media.season ?? 1} · E${room.media.episode ?? 1}',
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 14)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => showEpisodePicker(
                context,
                mediaId: room.media.id,
                totalSeasons: _totalSeasons,
                currentSeason: room.media.season ?? 1,
                currentEpisode: room.media.episode ?? 1,
                onSelect: (s, e, _) => ref
                    .read(partyControllerProvider.notifier)
                    .emitMedia(season: s, episode: e),
              ),
              icon: const Icon(Icons.video_library_rounded),
              label: const Text('Change episode for everyone'),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Gate / terminal states ───
  Widget _gate(PartyState st) {
    final meta = st.meta ?? const {};
    final media = (meta['media'] as Map?)?.cast<String, dynamic>() ?? const {};
    final signedIn = ref.watch(authControllerProvider).isSignedIn;
    final hasPassword = meta['hasPassword'] == true;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Watch Party · ${widget.code}',
                style: const TextStyle(
                    color: AppColors.teal,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.5)),
            const SizedBox(height: 8),
            Text((meta['name'] ?? 'Join party').toString(),
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(
                '${media['title'] ?? ''} · ${meta['memberCount'] ?? 0} watching',
                style:
                    const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 24),
            if (!signedIn)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: TextField(
                  controller: _gateName,
                  style: const TextStyle(color: Colors.white),
                  decoration: _gateInput('Your display name'),
                ),
              ),
            if (hasPassword)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: TextField(
                  controller: _gatePassword,
                  obscureText: true,
                  style: const TextStyle(color: Colors.white),
                  decoration: _gateInput('Room password'),
                ),
              ),
            if (st.gateError != null) ...[
              Text(st.gateError!,
                  style: const TextStyle(color: AppColors.ratingLow, fontSize: 12)),
              const SizedBox(height: 8),
            ],
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _joining ? null : _join,
                child: Text(_joining ? 'Joining…' : 'Join Party'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _gateInput(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.textMuted),
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
      );

  Future<void> _join() async {
    setState(() => _joining = true);
    await ref.read(partyControllerProvider.notifier).join(
          code: widget.code,
          password: _gatePassword.text.trim(),
          guestName: _gateName.text.trim(),
        );
    if (mounted) setState(() => _joining = false);
  }

  Widget _centered(Widget top, String text) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            top,
            const SizedBox(height: 14),
            Text(text,
                style: const TextStyle(color: AppColors.textMuted, fontSize: 13)),
          ],
        ),
      );

  Widget _terminal(IconData icon, String title, String body) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: AppColors.ratingLow, size: 44),
              const SizedBox(height: 14),
              Text(title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Text(body,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              const SizedBox(height: 20),
              OutlinedButton(
                onPressed: () => Navigator.of(context).maybePop(),
                child: const Text('Back'),
              ),
            ],
          ),
        ),
      );

  // ─── Dialogs ───
  void _inviteDialog(String code) {
    final to = TextEditingController();
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('Invite friends',
            style: TextStyle(color: Colors.white, fontSize: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Room code',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
            const SizedBox(height: 4),
            SelectableText(code,
                style: const TextStyle(
                    color: AppColors.teal,
                    fontSize: 22,
                    letterSpacing: 4,
                    fontWeight: FontWeight.bold)),
            if (ref.read(authControllerProvider).isSignedIn) ...[
              const SizedBox(height: 16),
              TextField(
                controller: to,
                style: const TextStyle(color: Colors.white),
                decoration: _gateInput('Notify a user (name or email)'),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
          if (ref.read(authControllerProvider).isSignedIn)
            ElevatedButton(
              onPressed: () {
                final t = to.text.trim();
                if (t.isNotEmpty) {
                  ref.read(partyControllerProvider.notifier).invite(t);
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Invite sent')),
                  );
                }
              },
              child: const Text('Invite'),
            ),
        ],
      ),
    );
  }

  void _settingsDialog(PartyRoom room) {
    bool isPublic = room.isPublic;
    bool allowGuestControl = room.allowGuestControl;
    bool autoWait = room.autoWait;
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          backgroundColor: AppColors.bgCard,
          title: const Text('Room settings',
              style: TextStyle(color: Colors.white, fontSize: 18)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeThumbColor: AppColors.accent,
                value: isPublic,
                onChanged: (v) => setLocal(() => isPublic = v),
                title: const Text('Public room',
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeThumbColor: AppColors.accent,
                value: allowGuestControl,
                onChanged: (v) => setLocal(() => allowGuestControl = v),
                title: const Text('Everyone can control playback',
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeThumbColor: AppColors.accent,
                value: autoWait,
                onChanged: (v) => setLocal(() => autoWait = v),
                title: const Text('Auto-wait for buffering',
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 14)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                ref.read(partyControllerProvider.notifier).emitSettings({
                  'isPublic': isPublic,
                  'allowGuestControl': allowGuestControl,
                  'autoWait': autoWait,
                });
                Navigator.pop(ctx);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pillButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback? onTap,
  }) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18, color: color),
      label: Text(label, style: TextStyle(color: color)),
      style: OutlinedButton.styleFrom(side: BorderSide(color: color)),
    );
  }

  Widget _circleToggle({
    required bool active,
    required IconData activeIcon,
    required IconData inactiveIcon,
    required VoidCallback onTap,
    required Color activeColor,
  }) {
    return Material(
      color: active ? activeColor.withValues(alpha: 0.18) : AppColors.glassBackground,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(active ? activeIcon : inactiveIcon,
              size: 20, color: active ? activeColor : AppColors.textMuted),
        ),
      ),
    );
  }
}
