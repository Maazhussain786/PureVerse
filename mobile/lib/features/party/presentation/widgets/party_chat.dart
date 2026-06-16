import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/avatars.dart';
import '../../data/party_models.dart';

const List<String> _quickEmoji = ['😂', '🔥', '❤️', '😮', '😭', '👏', '🎉', '💀'];

/// YouTube/Twitch-style live chat: messages stick to the bottom, system lines
/// are centred dividers, quick-emoji shortcuts, and a composer that disables
/// when the member is muted. Mirrors web `components/party/ChatPanel.tsx`.
class PartyChat extends StatefulWidget {
  final List<PartyChatMessage> messages;
  final String selfId;
  final bool muted;
  final ValueChanged<String> onSend;

  const PartyChat({
    super.key,
    required this.messages,
    required this.selfId,
    required this.muted,
    required this.onSend,
  });

  @override
  State<PartyChat> createState() => _PartyChatState();
}

class _PartyChatState extends State<PartyChat> {
  final _scroll = ScrollController();
  final _draft = TextEditingController();
  bool _pinned = true;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (!_scroll.hasClients) return;
      _pinned = _scroll.position.pixels >=
          _scroll.position.maxScrollExtent - 60;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _toBottom());
  }

  @override
  void didUpdateWidget(covariant PartyChat old) {
    super.didUpdateWidget(old);
    if (widget.messages.length != old.messages.length && _pinned) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _toBottom());
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    _draft.dispose();
    super.dispose();
  }

  void _toBottom() {
    if (_scroll.hasClients) {
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    }
  }

  void _send() {
    final t = _draft.text.trim();
    if (t.isEmpty) return;
    widget.onSend(t);
    _draft.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: widget.messages.isEmpty
              ? const Center(
                  child: Text('Say hi — chat appears here in real time.',
                      style:
                          TextStyle(color: AppColors.textMuted, fontSize: 12)),
                )
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  itemCount: widget.messages.length,
                  itemBuilder: (_, i) => _message(widget.messages[i]),
                ),
        ),
        _composer(),
      ],
    );
  }

  Widget _message(PartyChatMessage m) {
    if (m.isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            const Expanded(child: Divider(color: Colors.white12, height: 1)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(m.text,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: AppColors.textMuted, fontSize: 11)),
            ),
            const Expanded(child: Divider(color: Colors.white12, height: 1)),
          ],
        ),
      );
    }
    final isSelf = m.authorSocketId == widget.selfId;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _avatar(m.authorAvatar, m.authorName),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        m.authorName,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isSelf ? AppColors.accent : Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (m.authorIsHost) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding:
                            const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.accentSubtle,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('HOST',
                            style: TextStyle(
                                color: AppColors.accent,
                                fontSize: 8,
                                fontWeight: FontWeight.w900)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 1),
                Text(m.text,
                    style: const TextStyle(
                        color: AppColors.textPrimary, fontSize: 13, height: 1.3)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _avatar(String? url, String name) {
    if (url != null && url.isNotEmpty) {
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: renderableAvatar(url),
          width: 28,
          height: 28,
          fit: BoxFit.cover,
          errorWidget: (_, _, _) => _initial(name),
        ),
      );
    }
    return _initial(name);
  }

  Widget _initial(String name) => Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
            color: Colors.white12, shape: BoxShape.circle),
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(
              color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
        ),
      );

  Widget _composer() {
    return Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.glassBorder)),
      ),
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
      child: Column(
        children: [
          SizedBox(
            height: 30,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _quickEmoji.length,
              separatorBuilder: (_, _) => const SizedBox(width: 4),
              itemBuilder: (_, i) => InkWell(
                onTap: () => _draft.text += _quickEmoji[i],
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 30,
                  alignment: Alignment.center,
                  child: Text(_quickEmoji[i], style: const TextStyle(fontSize: 16)),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: _draft,
                  enabled: !widget.muted,
                  minLines: 1,
                  maxLines: 4,
                  maxLength: 500,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    counterText: '',
                    isDense: true,
                    hintText: widget.muted ? 'You are muted' : 'Send a message',
                    hintStyle: const TextStyle(color: AppColors.textMuted),
                    filled: true,
                    fillColor: AppColors.glassBackground,
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      borderSide: const BorderSide(color: AppColors.glassBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      borderSide: const BorderSide(color: AppColors.glassBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.md),
                      borderSide: const BorderSide(color: AppColors.accent),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Material(
                color: AppColors.accent,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: widget.muted ? null : _send,
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(Icons.send_rounded, color: AppColors.onAccent, size: 18),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
