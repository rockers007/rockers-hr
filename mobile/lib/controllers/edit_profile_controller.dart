import 'package:flutter/foundation.dart';

import '../models/user_model.dart';
import '../repositories/edit_profile_repository.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/logging_service.dart';

enum EditProfileStatus { idle, loading, success, error }

class EditProfileController extends ChangeNotifier {
  EditProfileController(this._repo, this._auth);

  final EditProfileRepository _repo;
  final AuthService _auth;

  EditProfileStatus _status = EditProfileStatus.idle;
  EditProfileStatus get status => _status;

  String? _error;
  String? get error => _error;

  bool _saving = false;
  bool get saving => _saving;

  ProfileDetail? _profile;
  ProfileDetail? get profile => _profile;

  String? _genderId;
  String? get genderId => _genderId;

  String? _qualificationId;
  String? get qualificationId => _qualificationId;

  String? _maritalStatusId;
  String? get maritalStatusId => _maritalStatusId;

  DateTime? _dob;
  DateTime? get dob => _dob;

  List<Map<String, dynamic>> _maritalStatuses = const [];
  List<Map<String, dynamic>> get maritalStatuses => _maritalStatuses;

  void setGender(String? id) {
    _genderId = id;
    notifyListeners();
  }

  void setQualification(String? id) {
    _qualificationId = id;
    notifyListeners();
  }

  void setMaritalStatus(String? id) {
    _maritalStatusId = id;
    notifyListeners();
  }

  void setDob(DateTime picked) {
    _dob = picked;
    notifyListeners();
  }

  String? validatePhone(String? v) {
    final value = (v ?? '').replaceAll(RegExp(r'\s'), '');
    if (value.isEmpty) return null; // optional in PATCH
    if (!RegExp(r'^(\+?\d{10,15})$').hasMatch(value)) {
      return 'Enter a valid phone number (10+ digits)';
    }
    return null;
  }

  Future<void> load() async {
    _status = EditProfileStatus.loading;
    notifyListeners();
    try {
      _profile = await _repo.loadProfile();
      _genderId = _profile!.genderId;
      _qualificationId = _profile!.qualificationId;
      _maritalStatusId = _profile!.maritalStatusId;
      if (_profile!.dob != null) _dob = DateTime.tryParse(_profile!.dob!);

      try {
        _maritalStatuses = await _repo.loadMaritalStatuses();
      } catch (_) {
        _maritalStatuses = const [];
      }

      _status = EditProfileStatus.success;
    } on ApiException catch (e) {
      _error = 'Failed to load profile: ${e.message}';
      _status = EditProfileStatus.error;
      showLog('EditProfileController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Failed to load profile: $e';
      _status = EditProfileStatus.error;
      showLog('EditProfileController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  // Returns true on success so the screen can pop.
  Future<bool> save({
    required String phone,
    required String dob,
    required String emergencyPhone,
    required String currentAddress,
    required String permanentAddress,
    required String pfUanNo,
    required String esicNo,
  }) async {
    _saving = true;
    _error = null;
    notifyListeners();

    final patch = <String, dynamic>{
      if (phone.trim().isNotEmpty) 'phone': phone.trim(),
      if (dob.isNotEmpty) 'dob': dob,
      if (_genderId != null) 'gender_id': _genderId,
      if (_qualificationId != null) 'qualification_id': _qualificationId,
      if (_maritalStatusId != null) 'marital_status_id': _maritalStatusId,
      if (currentAddress.trim().isNotEmpty)
        'current_address': currentAddress.trim(),
      if (permanentAddress.trim().isNotEmpty)
        'permanent_address': permanentAddress.trim(),
      if (emergencyPhone.trim().isNotEmpty)
        'emergency_phone': emergencyPhone.trim(),
      if (pfUanNo.trim().isNotEmpty) 'pf_uan_no': pfUanNo.trim(),
      if (esicNo.trim().isNotEmpty) 'esic_no': esicNo.trim(),
    };

    try {
      await _auth.updateProfile(patch);
      _saving = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message.isNotEmpty
          ? e.message
          : 'Failed to save profile. Please try again.';
      _saving = false;
      showLog('EditProfileController.save: ${e.message}', type: LogType.error);
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to save profile: $e';
      _saving = false;
      showLog('EditProfileController.save: $e', type: LogType.error);
      notifyListeners();
      return false;
    }
  }
}
