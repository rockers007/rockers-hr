import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:rockers_hr/services/logging_service.dart';

import '../models/user_model.dart';
import '../repositories/auth_repository.dart';

/// Authentication state machine.
///
/// Holds the current user, token, and first-login flags. Delegates
/// all I/O (API calls, storage, Google Sign-In, JWT parsing) to
/// AuthRepository so this class is pure state + orchestration.
///
/// Mirrors the web's v2.0 admin-invite + email/password login flow.
/// Google Sign-In is a legacy fallback for pre-invite employees.
class AuthService extends ChangeNotifier {
  AuthService(this._repo);

  final AuthRepository _repo;

  User? _currentUser;
  bool _isLoading = false;
  String? _token;
  bool _firstLoginRequired = false;
  bool? _isActiveClaim;

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null && _token != null;
  bool get isLoading => _isLoading;
  String? get token => _token;

  /// True when the JWT was issued for a first-login (fresh invite or
  /// admin-triggered password reset). Routes to ResetPasswordScreen.
  bool get firstLoginRequired => _firstLoginRequired;

  /// True when first-login AND the employee is not yet active (fresh
  /// invite). Routes to CompleteProfileScreen instead of ResetPasswordScreen.
  bool get needsActivation => _firstLoginRequired && _isActiveClaim == false;

  // ---------------------------------------------------------------------------
  // Email + password (primary, v2.0)
  // ---------------------------------------------------------------------------

  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final result = await _repo.signInWithEmail(email, password);
      showLog('login response: token=${result.token.substring(0, 20)}...');
      _token = result.token;
      _firstLoginRequired = result.firstLoginRequired;
      _isActiveClaim = result.isActive;
      _currentUser = _firstLoginRequired
          ? _repo.stubUserFromJwt(result.token)
          : await _repo.fetchUser();
    } finally {
      notifyListeners();
    }
  }

  Future<void> finishPasswordReset({
    required String newPassword,
    required String confirmPassword,
  }) async {
    final newToken = await _repo.finishPasswordReset(
      newPassword: newPassword,
      confirmPassword: confirmPassword,
    );
    _token = newToken;
    _firstLoginRequired = false;
    _isActiveClaim = true;
    _currentUser = await _repo.fetchUser();
    notifyListeners();
  }

  Future<void> activateAccount({
    required String phone,
    required String dob,
    required String genderId,
    required String qualificationId,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final newToken = await _repo.activateAccount(
      phone: phone,
      dob: dob,
      genderId: genderId,
      qualificationId: qualificationId,
      newPassword: newPassword,
      confirmPassword: confirmPassword,
    );
    _token = newToken;
    _firstLoginRequired = false;
    _isActiveClaim = true;
    _currentUser = await _repo.fetchUser();
    notifyListeners();
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    final newToken = await _repo.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword,
    );
    if (newToken != null) _token = newToken;
    notifyListeners();
  }

  Future<void> updateProfile(Map<String, dynamic> patch) async {
    _currentUser = await _repo.updateProfile(patch);
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Legacy Google Sign-In (fallback)
  // ---------------------------------------------------------------------------

  Future<void> signInWithGoogle() async {
    try {
      final result = await _repo.signInWithGoogle();
      _token = result.token;
      _firstLoginRequired = result.firstLoginRequired;
      _currentUser = _firstLoginRequired
          ? _repo.stubUserFromJwt(result.token)
          : await _repo.fetchUser();
    } finally {
      notifyListeners();
    }
  }

  // ---------------------------------------------------------------------------
  // Session restore + housekeeping
  // ---------------------------------------------------------------------------

  Future<void> tryRestoreSession() async {
    _isLoading = true;
    // Defer so this doesn't fire during the build phase when called
    // from initState / AuthGate construction.
    SchedulerBinding.instance.addPostFrameCallback((_) => notifyListeners());

    try {
      final storedToken = await _repo.readToken();
      if (storedToken == null) return;

      _token = storedToken;
      await _repo.saveToken(storedToken); // re-wires ApiService

      final c = _repo.claims(storedToken);
      _firstLoginRequired = c?['first_login_required'] == true;
      _isActiveClaim = c?['is_active'] as bool?;

      _currentUser = _firstLoginRequired
          ? _repo.stubUserFromJwt(storedToken)
          : await _repo.fetchUser();
    } catch (_) {
      _token = null;
      _currentUser = null;
      _firstLoginRequired = false;
      _isActiveClaim = null;
      await _repo.deleteToken();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUser() async {
    _currentUser = await _repo.fetchUser();
    notifyListeners();
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    await _repo.logout(); // handles API call, Google sign-out, and token deletion
    _clearState();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> registerFcmToken(String fcmToken) =>
      _repo.registerFcmToken(fcmToken);

  void _clearState() {
    _token = null;
    _currentUser = null;
    _firstLoginRequired = false;
    _isActiveClaim = null;
  }
}
