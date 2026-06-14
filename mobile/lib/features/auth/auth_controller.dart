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

  /// Returns the ID token, or null if the user cancelled.
  static Future<String?> getIdToken() async {
    final account = await _google.signIn();
    if (account == null) return null;
    final auth = await account.authentication;
    return auth.idToken;
  }

  static Future<void> signOut() async {
    try {
      await _google.signOut();
    } catch (_) {/* ignore */}
  }
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
