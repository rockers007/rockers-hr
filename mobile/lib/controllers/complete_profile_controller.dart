import 'package:flutter/foundation.dart';

import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/logging_service.dart';

enum CompleteProfileStatus { idle, submitting, error }

class CompleteProfileController extends ChangeNotifier {
  CompleteProfileController(this._auth);

  final AuthService _auth;

  CompleteProfileStatus _status = CompleteProfileStatus.idle;
  CompleteProfileStatus get status => _status;
  bool get submitting => _status == CompleteProfileStatus.submitting;

  String? _error;
  String? get error => _error;

  String? _genderId;
  String? get genderId => _genderId;

  String? _qualificationId;
  String? get qualificationId => _qualificationId;

  DateTime? _dob;
  DateTime? get dob => _dob;

  void setGender(String? id) {
    _genderId = id;
    notifyListeners();
  }

  void setQualification(String? id) {
    _qualificationId = id;
    notifyListeners();
  }

  void setDob(DateTime picked) {
    _dob = picked;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    _status = CompleteProfileStatus.idle;
    notifyListeners();
  }

  // ── Validators ──────────────────────────────────────────────────────────

  String? validateRequired(String? v, String label) =>
      (v == null || v.trim().isEmpty) ? '$label is required' : null;

  String? validatePhone(String? v) {
    final value = (v ?? '').replaceAll(RegExp(r'\s'), '');
    if (value.isEmpty) return 'Phone is required';
    if (!RegExp(r'^(\+?\d{10,15})$').hasMatch(value)) {
      return 'Enter a valid phone number (10+ digits)';
    }
    return null;
  }

  String? validateNewPassword(String? v) {
    final value = v ?? '';
    if (value.length < 8) return 'At least 8 characters';
    if (!RegExp(r'[A-Za-z]').hasMatch(value)) return 'Must include a letter';
    if (!RegExp(r'\d').hasMatch(value)) return 'Must include a digit';
    return null;
  }

  String? validateConfirm(String? v, {required String newPassword}) {
    if ((v ?? '').isEmpty) return 'Re-enter the new password';
    if (v != newPassword) return 'Passwords do not match';
    return null;
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  // Returns true on success; AuthGate transitions automatically when
  // needsActivation flips false.
  Future<bool> submit({
    required String phone,
    required String dobText,
    required String newPassword,
    required String confirmPassword,
  }) async {
    if (_genderId == null) {
      _error = 'Gender is required';
      _status = CompleteProfileStatus.error;
      notifyListeners();
      return false;
    }
    if (_qualificationId == null) {
      _error = 'Qualification is required';
      _status = CompleteProfileStatus.error;
      notifyListeners();
      return false;
    }
    if (_dob == null) {
      _error = 'Date of birth is required';
      _status = CompleteProfileStatus.error;
      notifyListeners();
      return false;
    }

    _status = CompleteProfileStatus.submitting;
    _error = null;
    notifyListeners();

    try {
      await _auth.activateAccount(
        phone: phone,
        dob: dobText,
        genderId: _genderId!,
        qualificationId: _qualificationId!,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
      );
      _status = CompleteProfileStatus.idle;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message.isNotEmpty
          ? e.message
          : 'Activation failed. Please try again.';
      _status = CompleteProfileStatus.error;
      showLog('CompleteProfileController.submit: ${e.message}',
          type: LogType.error);
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Activation failed. Please try again.';
      _status = CompleteProfileStatus.error;
      showLog('CompleteProfileController.submit: $e', type: LogType.error);
      notifyListeners();
      return false;
    }
  }
}
