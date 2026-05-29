import 'package:flutter/foundation.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';

class LoginController extends ChangeNotifier {
  LoginController(this._auth);

  final AuthService _auth;

  bool _submitting = false;
  bool _googleBusy = false;
  bool _showPassword = false;
  String? _errorMessage;

  bool get submitting => _submitting;
  bool get googleBusy => _googleBusy;
  bool get showPassword => _showPassword;
  String? get errorMessage => _errorMessage;
  bool get busy => _submitting || _googleBusy;

  void togglePasswordVisibility() {
    _showPassword = !_showPassword;
    notifyListeners();
  }

  String? validateEmail(String? v) {
    final value = v?.trim() ?? '';
    if (value.isEmpty) return 'Email is required';
    final ok = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value);
    return ok ? null : 'Enter a valid email address';
  }

  String? validatePassword(String? v) {
    if (v == null || v.isEmpty) return 'Password is required';
    return null;
  }

  Future<void> submit(String email, String password) async {
    _submitting = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await _auth.signInWithEmail(email: email, password: password);
    } on ApiException catch (e) {
      _errorMessage = _mapError(e);
    } catch (_) {
      _errorMessage = 'Sign-in failed. Please try again.';
    } finally {
      _submitting = false;
      notifyListeners();
    }
  }

  Future<void> signInWithGoogle() async {
    _googleBusy = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await _auth.signInWithGoogle();
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } catch (e) {
      _errorMessage = 'Sign-in failed: $e';
    } finally {
      _googleBusy = false;
      notifyListeners();
    }
  }

  String _mapError(ApiException e) {
    switch (e.code) {
      case 'ACCOUNT_INACTIVE':
        return 'Your account is inactive. Please contact HR.';
      case 'ACCOUNT_LOCKED':
        // Backend includes the minutes-remaining hint.
        return e.message;
      case 'INVALID_CREDENTIALS':
        // Backend includes the attempts-remaining hint.
        return e.message.isNotEmpty ? e.message : 'Invalid email or password.';
      default:
        return 'Invalid email or password.';
    }
  }
}
