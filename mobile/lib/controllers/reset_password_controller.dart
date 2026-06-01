import 'package:flutter/foundation.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/logging_service.dart';

enum ResetPasswordStatus { idle, submitting, error }

class ResetPasswordController extends ChangeNotifier {
  ResetPasswordController(this._authService);

  final AuthService _authService;

  ResetPasswordStatus _status = ResetPasswordStatus.idle;
  ResetPasswordStatus get status => _status;

  String? _error;
  String? get error => _error;

  bool get isSubmitting => _status == ResetPasswordStatus.submitting;

  String? validateNewPassword(String? v) {
    final value = v ?? '';
    if (value.length < 8) return 'At least 8 characters';
    if (!RegExp(r'[A-Za-z]').hasMatch(value)) return 'Must include a letter';
    if (!RegExp(r'\d').hasMatch(value)) return 'Must include a digit';
    return null;
  }

  String? validateConfirm(String? v, String newPassword) {
    if ((v ?? '').isEmpty) return 'Re-enter the new password';
    if (v != newPassword) return 'Passwords do not match';
    return null;
  }

  Future<void> submit({
    required String newPassword,
    required String confirmPassword,
  }) async {
    _status = ResetPasswordStatus.submitting;
    _error = null;
    notifyListeners();
    try {
      await _authService.finishPasswordReset(
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );
      // AuthService sets firstLoginRequired=false; AuthGate re-renders automatically.
      _status = ResetPasswordStatus.idle;
    } on ApiException catch (e) {
      _error = e.message.isNotEmpty
          ? e.message
          : 'Could not set new password. Please try again.';
      _status = ResetPasswordStatus.error;
      showLog('ResetPasswordController.submit: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Could not set new password. Please try again.';
      _status = ResetPasswordStatus.error;
      showLog('ResetPasswordController.submit: $e', type: LogType.error);
    }
    notifyListeners();
  }
}
