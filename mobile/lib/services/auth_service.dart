import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/user_model.dart';
import 'api_service.dart';

/// Authentication state + actions.
///
/// Mirrors the web's v2.0 admin-invite + email/password login flow
/// from frontend/src/app/login/page.tsx and
/// frontend/src/app/reset-password/page.tsx. The previous version of
/// this service only supported Google Sign-In, which is now relegated
/// to a legacy fallback (matches the commented-out Google block on
/// the web login page).
///
/// Two new pieces compared to the legacy:
///   - `signInWithEmail` calls POST /auth/login/email and surfaces
///     ACCOUNT_INACTIVE / ACCOUNT_LOCKED / INVALID_CREDENTIALS errors
///     that the backend emits, so the UI can render the same
///     human-readable messages the web app uses.
///   - `firstLoginRequired` tracks whether the just-issued JWT was
///     marked first_login_required=true (admin-invite first login,
///     or an admin-triggered password reset). The AuthGate in
///     main.dart routes such users to ResetPasswordScreen instead of
///     MainShell; once `finishPasswordReset` succeeds we bump
///     tokens_valid_from on the backend side, swap the local JWT,
///     and reset the flag.
class AuthService extends ChangeNotifier {
  final ApiService _api = ApiService.instance;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  static const String _tokenKey = 'auth_token';

  User? _currentUser;
  bool _isLoading = false;
  String? _token;
  bool _firstLoginRequired = false;

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null && _token != null;
  bool get isLoading => _isLoading;
  String? get token => _token;

  /// True when the JWT we hold was issued for a first-login (fresh
  /// invite OR admin-triggered password reset). The UI uses this to
  /// route into the password-reset screen before the rest of the app.
  bool get firstLoginRequired => _firstLoginRequired;

  /// Three-way routing helper that mirrors the web's first-login
  /// branch (see frontend/src/app/login/page.tsx). When the JWT is
  /// flagged first_login_required AND the user is NOT yet active,
  /// the employee is on a fresh invite and needs to fill the full
  /// activation form (phone, DOB, gender, qualification, password)
  /// — which goes to CompleteProfileScreen. When first_login_required
  /// AND already active, an admin reset their password and the
  /// employee just needs to choose a new one — which goes to
  /// ResetPasswordScreen.
  bool get needsActivation =>
      _firstLoginRequired && _isActiveClaim == false;

  bool? _isActiveClaim;

  // ---------------------------------------------------------------------------
  // Email + password (primary, v2.0)
  // ---------------------------------------------------------------------------

  /// Sign in with the email + password issued by the admin invite.
  /// Throws ApiException with code = ACCOUNT_INACTIVE / ACCOUNT_LOCKED
  /// / INVALID_CREDENTIALS so the login screen can show the same
  /// messages the web app does.
  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _api.post('/auth/login/email', body: {
        'email': email.trim(),
        'password': password,
      }) as Map<String, dynamic>;

      final jwt = data['token'] as String;
      _token = jwt;
      _api.setToken(jwt);
      await _storage.write(key: _tokenKey, value: jwt);

      // first_login_required comes back on the login response. If
      // present on the body we trust it; otherwise we sniff the JWT
      // payload as a fallback. Mirrors the web login page's behavior.
      final flag = data['first_login_required'] as bool?;
      _firstLoginRequired = flag ?? _firstLoginFromJwt(jwt);
      _isActiveClaim = (data['user'] is Map<String, dynamic>)
          ? (data['user']['is_active'] as bool?)
          : _claims(jwt)?['is_active'] as bool?;

      // Only hit /users/me when we're past the first-login gate. The
      // ResetPasswordScreen doesn't need the full profile and saves
      // us a round-trip on the first-login path.
      if (!_firstLoginRequired) {
        await fetchUser();
      } else {
        // Surface a minimal stub so the reset screen can greet the
        // user by name without a second API call. The fields we need
        // are in the JWT claims emitted by the backend.
        _currentUser = _stubUserFromJwt(jwt);
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Finishes the admin-triggered password reset (active user, just
  /// needs a new password). The backend bumps tokens_valid_from,
  /// returns a fresh JWT, and we swap it in immediately so the next
  /// /users/me call doesn't 401.
  Future<void> finishPasswordReset({
    required String newPassword,
    required String confirmPassword,
  }) async {
    final data = await _api.post('/auth/finish-password-reset', body: {
      'new_password': newPassword,
      'confirm_password': confirmPassword,
    }) as Map<String, dynamic>;

    final newToken = data['token'] as String;
    _token = newToken;
    _api.setToken(newToken);
    await _storage.write(key: _tokenKey, value: newToken);

    _firstLoginRequired = false;
    _isActiveClaim = true;
    await fetchUser();
    notifyListeners();
  }

  /// Fresh-invite activation. Backend route is the same one the web
  /// /complete-profile page hits — POST /auth/activate-account with
  /// phone / dob / gender / qualification / new password. Returns a
  /// fresh JWT + activated user record; we swap both in immediately.
  ///
  /// department_id and join_date are intentionally NOT sent: the
  /// admin set them at invite time and employees cannot change them.
  /// The form just renders them read-only above the editable fields.
  Future<void> activateAccount({
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

    final newToken = data['token'] as String;
    _token = newToken;
    _api.setToken(newToken);
    await _storage.write(key: _tokenKey, value: newToken);

    _firstLoginRequired = false;
    _isActiveClaim = true;
    await fetchUser();
    notifyListeners();
  }

  /// Employee self-service password change from the profile screen.
  /// Backend bumps tokens_valid_from and returns a fresh JWT so the
  /// caller can keep operating without a re-login. Pattern is
  /// identical to the web profile's ChangePasswordSection.
  Future<void> changePassword({
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
      _token = newToken;
      _api.setToken(newToken);
      await _storage.write(key: _tokenKey, value: newToken);
    }
    notifyListeners();
  }

  /// Patches /users/me with the editable employee fields shown on
  /// the profile screen. Mirrors the web profile's PersonalSection
  /// PATCH and the new first-time bank entry path.
  Future<void> updateProfile(Map<String, dynamic> patch) async {
    final data = await _api.patch('/users/me', body: patch)
        as Map<String, dynamic>;
    _currentUser = User.fromJson(data);
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Legacy Google Sign-In (fallback)
  // ---------------------------------------------------------------------------

  Future<void> signInWithGoogle() async {
    _isLoading = true;
    notifyListeners();

    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw ApiException(
          'SIGN_IN_CANCELLED',
          'Google sign-in was cancelled',
          0,
        );
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
      _token = jwt;
      _api.setToken(jwt);
      await _storage.write(key: _tokenKey, value: jwt);

      _firstLoginRequired = _firstLoginFromJwt(jwt);
      if (!_firstLoginRequired) {
        await fetchUser();
      } else {
        _currentUser = _stubUserFromJwt(jwt);
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // Session restore + housekeeping
  // ---------------------------------------------------------------------------

  Future<void> tryRestoreSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      final storedToken = await _storage.read(key: _tokenKey);
      if (storedToken == null) return;

      _token = storedToken;
      _api.setToken(storedToken);
      // Pre-set the gates from the stored JWT so the AuthGate can
      // route on first frame; fetchUser below may overwrite if the
      // user has since completed activation or reset on the web.
      final restoredClaims = _claims(storedToken);
      _firstLoginRequired =
          restoredClaims?['first_login_required'] == true;
      _isActiveClaim = restoredClaims?['is_active'] as bool?;

      if (_firstLoginRequired) {
        // Mirror signInWithEmail: skip /users/me on the reset path —
        // it would also work, but skipping keeps behavior consistent.
        _currentUser = _stubUserFromJwt(storedToken);
      } else {
        await fetchUser();
      }
    } catch (_) {
      // Token is invalid or expired — clear everything
      await _clearState();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUser() async {
    final data = await _api.get('/users/me');
    _currentUser = User.fromJson(data as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // Best-effort — proceed with local cleanup regardless
    }

    await _clearState();
    // Best-effort signOut on the Google client too, in case the user
    // came in via the legacy flow.
    try {
      await _googleSignIn.signOut();
    } catch (_) {}

    _isLoading = false;
    notifyListeners();
  }

  Future<void> registerFcmToken(String fcmToken) async {
    await _api.patch('/users/me/fcm-token', body: {
      'fcmToken': fcmToken,
    });
  }

  Future<void> _clearState() async {
    _token = null;
    _currentUser = null;
    _firstLoginRequired = false;
    _isActiveClaim = null;
    _api.clearToken();
    await _storage.delete(key: _tokenKey);
  }

  // ---------------------------------------------------------------------------
  // JWT helpers — local-only, no signature check (auth is server-side).
  // ---------------------------------------------------------------------------

  /// Best-effort parse of the JWT payload. Returns false on any error
  /// so a malformed token routes the user to the normal app shell
  /// instead of trapping them on the reset screen.
  bool _firstLoginFromJwt(String jwt) {
    final claims = _claims(jwt);
    return claims?['first_login_required'] == true;
  }

  /// Lightweight stand-in User built from the JWT so the reset screen
  /// can greet the user by name without an extra /users/me call (which
  /// works but is wasted bandwidth on the reset path).
  User? _stubUserFromJwt(String jwt) {
    final claims = _claims(jwt);
    if (claims == null) return null;
    final email = (claims['email'] as String?) ??
        (claims['gmail'] as String?) ??
        '';
    return User(
      id: claims['sub'] as String? ?? '',
      name: claims['name'] as String? ?? '',
      email: email,
      role: claims['role'] as String? ?? 'employee',
      isInProbation: false,
      isManager: false,
    );
  }

  Map<String, dynamic>? _claims(String jwt) {
    try {
      final parts = jwt.split('.');
      if (parts.length != 3) return null;
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      // base64Url.decode requires the input to be padded to a multiple
      // of 4 characters.
      switch (payload.length % 4) {
        case 2:
          payload += '==';
          break;
        case 3:
          payload += '=';
          break;
      }
      final decoded = utf8.decode(base64.decode(payload));
      return jsonDecode(decoded) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }
}
