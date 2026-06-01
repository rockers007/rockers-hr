import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

/// Result returned by email and Google sign-in so AuthService
/// doesn't have to parse raw HTTP bodies or touch the JWT itself.
class SignInResult {
  const SignInResult({
    required this.token,
    required this.firstLoginRequired,
    this.isActive,
  });

  final String token;
  final bool firstLoginRequired;
  final bool? isActive;
}

/// Raw data layer for authentication: API calls, secure token
/// storage, Google Sign-In, and JWT parsing.
///
/// No ChangeNotifier, no BuildContext — this class is pure I/O.
/// AuthService owns all state and calls into this repository.
class AuthRepository {
  AuthRepository()
      : _api = ApiService.instance,
        _storage = const FlutterSecureStorage(),
        _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

  static const String _tokenKey = 'auth_token';

  final ApiService _api;
  final FlutterSecureStorage _storage;
  final GoogleSignIn _googleSignIn;

  // ---------------------------------------------------------------------------
  // Token storage
  // ---------------------------------------------------------------------------

  Future<void> saveToken(String jwt) async {
    _api.setToken(jwt);
    await _storage.write(key: _tokenKey, value: jwt);
  }

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> deleteToken() async {
    _api.clearToken();
    await _storage.delete(key: _tokenKey);
  }

  // ---------------------------------------------------------------------------
  // Auth endpoints
  // ---------------------------------------------------------------------------

  Future<SignInResult> signInWithEmail(String email, String password) async {
    final data = await _api.post('/auth/login/email', body: {
      'email': email.trim(),
      'password': password,
    }) as Map<String, dynamic>;

    final jwt = data['token'] as String;
    await saveToken(jwt);

    final flag = data['first_login_required'] as bool?;
    final firstLogin = flag ?? _firstLoginFromJwt(jwt);
    final isActive = (data['user'] is Map<String, dynamic>)
        ? (data['user'] as Map<String, dynamic>)['is_active'] as bool?
        : claims(jwt)?['is_active'] as bool?;

    return SignInResult(
      token: jwt,
      firstLoginRequired: firstLogin,
      isActive: isActive,
    );
  }

  Future<SignInResult> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) {
      throw ApiException('SIGN_IN_CANCELLED', 'Google sign-in was cancelled', 0);
    }

    final googleAuth = await googleUser.authentication;
    final idToken = googleAuth.idToken;
    if (idToken == null) {
      throw ApiException('NO_ID_TOKEN', 'Failed to obtain Google ID token', 0);
    }

    final data = await _api.post('/auth/google/callback', body: {
      'idToken': idToken,
    }) as Map<String, dynamic>;

    final jwt = data['token'] as String;
    await saveToken(jwt);

    return SignInResult(
      token: jwt,
      firstLoginRequired: _firstLoginFromJwt(jwt),
    );
  }

  Future<String> finishPasswordReset({
    required String newPassword,
    required String confirmPassword,
  }) async {
    final data = await _api.post('/auth/finish-password-reset', body: {
      'new_password': newPassword,
      'confirm_password': confirmPassword,
    }) as Map<String, dynamic>;
    final jwt = data['token'] as String;
    await saveToken(jwt);
    return jwt;
  }

  Future<String> activateAccount({
    required String phone,
    required String dob,
    required String genderId,
    required String qualificationId,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final data = await _api.post('/auth/activate-account', body: {
      'phone': phone.trim(),
      'dob': dob,
      'gender_id': genderId,
      'qualification_id': qualificationId,
      'new_password': newPassword,
      'confirm_password': confirmPassword,
    }) as Map<String, dynamic>;
    final jwt = data['token'] as String;
    await saveToken(jwt);
    return jwt;
  }

  /// Returns the new token if the backend issued one, null otherwise.
  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final data = await _api.post('/auth/change-password', body: {
      'current_password': currentPassword,
      'new_password': newPassword,
      'confirm_password': confirmPassword,
    }) as Map<String, dynamic>;
    final newToken = data['token'] as String?;
    if (newToken != null && newToken.isNotEmpty) {
      await saveToken(newToken);
      return newToken;
    }
    return null;
  }

  Future<User> updateProfile(Map<String, dynamic> patch) async {
    final data =
        await _api.patch('/users/me', body: patch) as Map<String, dynamic>;
    return User.fromJson(data);
  }

  Future<User> fetchUser() async {
    final data = await _api.get('/users/me');
    return User.fromJson(data as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (e) {
      showLog('AuthRepository.logout (api): $e', type: LogType.error);
    }
    try {
      await _googleSignIn.signOut();
    } catch (e) {
      showLog('AuthRepository.logout (google): $e', type: LogType.error);
    }
    await deleteToken();
  }

  Future<void> registerFcmToken(String fcmToken) async {
    await _api.patch('/users/me/fcm-token', body: {'fcmToken': fcmToken});
  }

  // ---------------------------------------------------------------------------
  // JWT helpers — local-only, no signature check (auth is server-side).
  // ---------------------------------------------------------------------------

  bool _firstLoginFromJwt(String jwt) =>
      claims(jwt)?['first_login_required'] == true;

  /// Lightweight stub user built from JWT claims so callers can greet
  /// the user by name on first-login paths without a /users/me round-trip.
  User? stubUserFromJwt(String jwt) {
    final c = claims(jwt);
    if (c == null) return null;
    final email =
        (c['email'] as String?) ?? (c['gmail'] as String?) ?? '';
    return User(
      id: c['sub'] as String? ?? '',
      name: c['name'] as String? ?? '',
      email: email,
      role: c['role'] as String? ?? 'employee',
      isInProbation: false,
      isManager: false,
    );
  }

  /// Decodes the JWT payload. Returns null on any parse error so callers
  /// can fall back safely rather than trapping the user.
  Map<String, dynamic>? claims(String jwt) {
    try {
      final parts = jwt.split('.');
      if (parts.length != 3) return null;
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      switch (payload.length % 4) {
        case 2:
          payload += '==';
          break;
        case 3:
          payload += '=';
          break;
      }
      return jsonDecode(utf8.decode(base64.decode(payload)))
          as Map<String, dynamic>;
    } catch (e) {
      showLog('AuthRepository.claims: $e', type: LogType.error);
      return null;
    }
  }
}
