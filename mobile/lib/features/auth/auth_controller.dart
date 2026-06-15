import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../core/config/app_config.dart';
import '../../core/models/user_profile.dart';
import '../../shared/providers/api_providers.dart';

/// Thin wrapper over google_sign_in. Returns the ID token whose audience is the
/// web `serverClientId` so the backend's /auth/google verification accepts it.
class GoogleSignInService {
  static final GoogleSignIn _google = GoogleSignIn(
    serverClientId: AppConfig.googleServerClientId,
    scopes: const ['email', 'profile'],
  );

  /// Returns the ID token, or null if the user cancelled. Throws a friendly
  /// message for the common misconfiguration cases (so the sheet shows
  /// something actionable instead of a raw PlatformException).
  static Future<String?> getIdToken() async {
    try {
      final account = await _google.signIn();
      if (account == null) return null; // user cancelled
      final auth = await account.authentication;
      final token = auth.idToken;
      if (token == null || token.isEmpty) {
        throw const _AuthError(
            'Google sign-in returned no token. The Google Cloud OAuth client '
            'is misconfigured for this app (check the web client ID used as '
            'serverClientId).');
      }
      return token;
    } on PlatformException catch (e) {
      final detail = '${e.code} ${e.message ?? ''}';
      if (detail.contains('10') || e.code == 'sign_in_failed') {
        throw const _AuthError(
            'Google sign-in is not configured for this build (DEVELOPER_ERROR '
            '10). The signing key’s SHA-1 must be registered in the Google '
            'Cloud OAuth client for package com.aniverse.mobile.');
      }
      if (e.code == 'network_error') {
        throw const _AuthError('Network error during Google sign-in.');
      }
      throw _AuthError('Google sign-in failed: ${e.message ?? e.code}');
    }
  }

  static Future<void> signOut() async {
    try {
      await _google.signOut();
    } catch (_) {/* ignore */}
  }
}

/// A user-facing auth error whose [toString] is the message shown in the UI.
class _AuthError implements Exception {
  final String message;
  const _AuthError(this.message);
  @override
  String toString() => message;
}

class AuthState {
  final UserProfile? user;
  final bool booting;
  final bool busy;
  final String? error;

  const AuthState({
    this.user,
    this.booting = false,
    this.busy = false,
    this.error,
  });

  bool get isSignedIn => user != null;

  AuthState copyWith({
    UserProfile? user,
    bool? booting,
    bool? busy,
    String? error,
    bool clearError = false,
  }) =>
      AuthState(
        user: user ?? this.user,
        booting: booting ?? this.booting,
        busy: busy ?? this.busy,
        error: clearError ? null : (error ?? this.error),
      );
}

class AuthController extends StateNotifier<AuthState> {
  final Ref ref;
  AuthController(this.ref) : super(const AuthState(booting: true)) {
    _restore();
  }

  Future<void> _restore() async {
    final token = await ref.read(tokenStoreProvider).read();
    if (token == null || token.isEmpty) {
      state = const AuthState();
      return;
    }
    try {
      final user = await ref.read(apiClientProvider).getSession();
      state = AuthState(user: user);
    } catch (_) {
      await ref.read(tokenStoreProvider).clear();
      state = const AuthState();
    }
  }

  Future<bool> signInAsGuest(String name) async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final session = await ref
          .read(apiClientProvider)
          .signInGuest(name.trim().isEmpty ? 'Guest' : name.trim());
      await ref.read(tokenStoreProvider).write(session.token);
      state = AuthState(user: session.user);
      return true;
    } catch (e) {
      state = state.copyWith(busy: false, error: '$e');
      return false;
    }
  }

  Future<bool> signInWithGoogle() async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final idToken = await GoogleSignInService.getIdToken();
      if (idToken == null) {
        state = state.copyWith(busy: false); // cancelled
        return false;
      }
      final session =
          await ref.read(apiClientProvider).signInGoogle(idToken);
      await ref.read(tokenStoreProvider).write(session.token);
      state = AuthState(user: session.user);
      return true;
    } catch (e) {
      state = state.copyWith(busy: false, error: '$e');
      return false;
    }
  }

  Future<void> signOut() async {
    try {
      await ref.read(apiClientProvider).logout();
    } catch (_) {/* best-effort */}
    await ref.read(tokenStoreProvider).clear();
    await GoogleSignInService.signOut();
    state = const AuthState();
  }

  /// Patch name / avatar / preferences and reflect the result locally.
  Future<void> updateProfile(Map<String, dynamic> patch) async {
    if (!state.isSignedIn) return;
    try {
      final user = await ref.read(apiClientProvider).updateProfile(patch);
      state = state.copyWith(user: user);
    } catch (_) {/* best-effort — keep current state */}
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) => AuthController(ref));
