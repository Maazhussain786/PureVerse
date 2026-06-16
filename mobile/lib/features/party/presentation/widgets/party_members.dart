import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/avatars.dart';
import '../../data/party_models.dart';

/// Member roster with host badge, live voice indicators (mic / muted-mic /
/// deafened) and buffering state. The host gets per-member moderation actions.
class PartyMembers extends StatelessWidget {
  final List<PartyMember> members;
  final String selfId;
  final bool selfIsHost;
  final void Function(String action, String targetSocketId) onMod;

  const PartyMembers({
    super.key,
    required this.members,
    required this.selfId,
    required this.selfIsHost,
    required this.onMod,
  });

  @override
  Widget build(BuildContext context) {
    final sorted = [...members]..sort((a, b) {
        if (a.isHost != b.isHost) return a.isHost ? -1 : 1;
        return a.joinedAt.compareTo(b.joinedAt);
      });
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      itemCount: sorted.length,
      itemBuilder: (_, i) => _tile(context, sorted[i]),
    );
  }

  Widget _tile(BuildContext context, PartyMember m) {
    final isSelf = m.socketId == selfId;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
      child: Row(
        children: [
          _avatar(m),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isSelf ? '${m.name} (you)' : m.name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600),
            ),
          ),
          if (m.isHost)
            Container(
              margin: const EdgeInsets.only(right: 6),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.accentSubtle,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('HOST',
                  style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 8,
                      fontWeight: FontWeight.w900)),
            ),
          if (m.buffering)
            const Padding(
              padding: EdgeInsets.only(right: 6),
              child: Icon(Icons.hourglass_top_rounded,
                  size: 16, color: AppColors.ratingMid),
            ),
          _voiceIcon(m),
          if (selfIsHost && !m.isHost) _modMenu(context, m),
        ],
      ),
    );
  }

  Widget _voiceIcon(PartyMember m) {
    if (!m.inVoice) {
      return const SizedBox(width: 4);
    }
    IconData icon;
    Color color;
    if (m.deafened) {
      icon = Icons.headset_off_rounded;
      color = AppColors.ratingLow;
    } else if (!m.micOn) {
      icon = Icons.mic_off_rounded;
      color = AppColors.textMuted;
    } else {
      icon = Icons.mic_rounded;
      color = AppColors.teal;
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Icon(icon, size: 16, color: color),
    );
  }

  Widget _avatar(PartyMember m) {
    final ring = m.inVoice && m.micOn && !m.deafened;
    Widget inner;
    if (m.avatar.isNotEmpty) {
      inner = ClipOval(
        child: CachedNetworkImage(
          imageUrl: renderableAvatar(m.avatar),
          width: 32,
          height: 32,
          fit: BoxFit.cover,
          errorWidget: (_, _, _) => _initial(m.name),
        ),
      );
    } else {
      inner = _initial(m.name);
    }
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
            color: ring ? AppColors.teal : Colors.transparent, width: 2),
      ),
      child: inner,
    );
  }

  Widget _initial(String name) => Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration:
            const BoxDecoration(color: Colors.white12, shape: BoxShape.circle),
        child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: const TextStyle(
                color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
      );

  Widget _modMenu(BuildContext context, PartyMember m) {
    return PopupMenuButton<String>(
      color: AppColors.bgElevated,
      icon: const Icon(Icons.more_vert_rounded,
          color: AppColors.textSecondary, size: 18),
      onSelected: (a) => onMod(a, m.socketId),
      itemBuilder: (_) => [
        PopupMenuItem(
            value: m.muted ? 'unmute' : 'mute',
            child: Text(m.muted ? 'Unmute in chat' : 'Mute in chat',
                style: const TextStyle(color: AppColors.textPrimary, fontSize: 13))),
        const PopupMenuItem(
            value: 'timeout',
            child: Text('Timeout 5 min',
                style: TextStyle(color: AppColors.textPrimary, fontSize: 13))),
        const PopupMenuItem(
            value: 'kick',
            child: Text('Remove from party',
                style: TextStyle(color: AppColors.ratingLow, fontSize: 13))),
      ],
    );
  }
}
