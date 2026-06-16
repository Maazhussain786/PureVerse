import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../auth/auth_controller.dart';
import '../../application/party_controller.dart';
import '../../data/party_models.dart';
import '../screens/party_room_screen.dart';

/// Bottom sheet to start a watch party for a chosen title. Creates the room
/// over the socket then routes into [PartyRoomScreen].
class CreatePartySheet extends ConsumerStatefulWidget {
  final PartyMedia media;
  const CreatePartySheet({super.key, required this.media});

  static Future<void> show(BuildContext context, PartyMedia media) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CreatePartySheet(media: media),
    );
  }

  @override
  ConsumerState<CreatePartySheet> createState() => _CreatePartySheetState();
}

class _CreatePartySheetState extends ConsumerState<CreatePartySheet> {
  late final TextEditingController _name;
  final _password = TextEditingController();
  bool _isPublic = true;
  bool _allowGuestControl = false;
  bool _autoWait = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final who = ref.read(authControllerProvider).user?.name ?? 'My';
    _name = TextEditingController(text: "$who's party");
  }

  @override
  void dispose() {
    _name.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final code = await ref.read(partyControllerProvider.notifier).create(
          media: widget.media,
          name: _name.text.trim(),
          isPublic: _isPublic,
          password: _password.text.trim(),
          allowGuestControl: _allowGuestControl,
          autoWait: _autoWait,
        );
    if (!mounted) return;
    if (code != null) {
      Navigator.of(context).pop(); // close the sheet
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => PartyRoomScreen(code: code),
      ));
    } else {
      setState(() {
        _busy = false;
        _error = ref.read(partyControllerProvider).gateError ?? 'Could not create room';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            20, 14, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
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
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Text('Watch Party · ${widget.media.title}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    color: AppColors.textMuted, fontSize: 12)),
            const SizedBox(height: 4),
            const Text('Start a party',
                style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _field(_name, 'Room name'),
            const SizedBox(height: 10),
            _field(_password, _isPublic ? 'Password (optional)' : 'Password (optional)',
                obscure: true),
            const SizedBox(height: 6),
            _toggle('Public room', 'Listed in the party browser', _isPublic,
                (v) => setState(() => _isPublic = v)),
            _toggle('Everyone can control playback',
                'Any member can play / pause / seek for all', _allowGuestControl,
                (v) => setState(() => _allowGuestControl = v)),
            _toggle('Auto-wait for buffering',
                'Pause the party while anyone is catching up', _autoWait,
                (v) => setState(() => _autoWait = v)),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!,
                  style: const TextStyle(color: AppColors.ratingLow, fontSize: 12)),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _busy ? null : _create,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.onAccent))
                    : const Icon(Icons.celebration_rounded),
                label: Text(_busy ? 'Creating…' : 'Start party'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String hint, {bool obscure = false}) {
    return TextField(
      controller: c,
      obscureText: obscure,
      style: const TextStyle(color: Colors.white, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.textMuted),
        filled: true,
        fillColor: AppColors.glassBackground,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
    );
  }

  Widget _toggle(
      String title, String subtitle, bool value, ValueChanged<bool> onChanged) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      activeThumbColor: AppColors.accent,
      value: value,
      onChanged: onChanged,
      title: Text(title,
          style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle,
          style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
    );
  }
}
