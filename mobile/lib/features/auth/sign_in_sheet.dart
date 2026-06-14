import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_colors.dart';
import 'auth_controller.dart';

/// Opens the sign-in sheet (Google + guest). Resolves when dismissed.
Future<void> showSignInSheet(BuildContext context) => showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SignInSheet(),
    );

class _SignInSheet extends ConsumerStatefulWidget {
  const _SignInSheet();

  @override
  ConsumerState<_SignInSheet> createState() => _SignInSheetState();
}

class _SignInSheetState extends ConsumerState<_SignInSheet> {
  final _nameController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _guest() async {
    final ok =
        await ref.read(authControllerProvider.notifier).signInAsGuest(_nameController.text);
    if (ok && mounted) Navigator.of(context).pop();
  }

  Future<void> _google() async {
    final ok = await ref.read(authControllerProvider.notifier).signInWithGoogle();
    if (ok && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          border: Border(top: BorderSide(color: AppColors.glassBorder)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textMuted,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: 56,
              height: 56,
              child: Image.asset('assets/logo/logo.png', fit: BoxFit.contain),
            ),
            const SizedBox(height: 12),
            const Text('Welcome to PureVerse',
                style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            const Text(
              'Sign in to sync your watchlist, history and parties across devices.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 20),

            // Google
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: auth.busy ? null : _google,
                icon: const Icon(Icons.g_mobiledata_rounded, size: 28),
                label: const Text('Continue with Google'),
              ),
            ),

            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Row(
                children: [
                  const Expanded(child: Divider(color: AppColors.glassBorder)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text('or',
                        style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                            letterSpacing: 2)),
                  ),
                  const Expanded(child: Divider(color: AppColors.glassBorder)),
                ],
              ),
            ),

            // Guest
            TextField(
              controller: _nameController,
              enabled: !auth.busy,
              style: const TextStyle(color: AppColors.textPrimary),
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _guest(),
              decoration: const InputDecoration(hintText: 'Display name'),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: auth.busy ? null : _guest,
                child: auth.busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.onAccent),
                      )
                    : const Text('Continue as Guest'),
              ),
            ),

            if (auth.error != null) ...[
              const SizedBox(height: 12),
              Text(auth.error!,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: AppColors.ratingLow, fontSize: 12)),
            ],
          ],
        ),
      ),
    );
  }
}
