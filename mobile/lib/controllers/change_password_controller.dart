import 'package:flutter/foundation.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/logging_service.dart';

enum ChangePasswordStatus { idle, submitting, error }

class ChangePasswordController extends ChangeNotifier {
  ChangePasswordController(this._auth);

  final AuthService _auth;

  ChangePasswordStatus _status = ChangePasswordStatus.idle;
  ChangePasswordStatus get status => _status;

  String? _error;
  String? get error => _error;

  bool get submitting => _status == ChangePasswordStatus.submitting;

  void clearError() {
    _error = null;
    _status = ChangePasswordStatus.idle;
    notifyListeners();
  }

  String? validateNew(String? v, {required String currentPassword}) {
    final value = v ?? '';
    if (value.length < 8) return 'At least 8 characters';
    if (!RegExp(r'[A-Za-z]').hasMatch(value)) return 'Must include a letter';
    if (!RegExp(r'\d').hasMatch(value)) return 'Must include a digit';
    if (value == currentPassword) {
      return 'New password must differ from the current one';
    }
    return null;
  }

  String? validateConfirm(String? v, {required String newPassword}) {
    if ((v ?? '').isEmpty) return 'Re-enter the new password';
    if (v != newPassword) return 'Passwords do not match';
    return null;
  }

  // Returns true on success so the screen can pop.
  Future<bool> submit({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    _status = ChangePasswordStatus.submitting;
    _error = null;
    notifyListeners();
    try {
      await _auth.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );
      _status = ChangePasswordStatus.idle;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message.isNotEmpty
          ? e.message
          : 'Could not change password. Please try again.';
      _status = ChangePasswordStatus.error;
      showLog('ChangePasswordController.submit: ${e.message}',
          type: LogType.error);
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Could not change password. Please try again.';
      _status = ChangePasswordStatus.error;
      showLog('ChangePasswordController.submit: $e', type: LogType.error);
      notifyListeners();
      return false;
    }
  }
}
