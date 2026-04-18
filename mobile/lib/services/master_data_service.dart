import 'package:flutter/foundation.dart';
import 'api_service.dart';

class MasterDataService extends ChangeNotifier {
  final ApiService _api = ApiService.instance;

  List<Map<String, dynamic>> _leaveTypes = [];
  List<Map<String, dynamic>> _genders = [];
  List<Map<String, dynamic>> _qualifications = [];
  List<Map<String, dynamic>> _departments = [];
  List<Map<String, dynamic>> _leaveDurations = [];
  bool _isLoading = false;

  List<Map<String, dynamic>> get leaveTypes => _leaveTypes;
  List<Map<String, dynamic>> get genders => _genders;
  List<Map<String, dynamic>> get qualifications => _qualifications;
  List<Map<String, dynamic>> get departments => _departments;
  List<Map<String, dynamic>> get leaveDurations => _leaveDurations;
  bool get isLoading => _isLoading;

  Future<void> loadAll() async {
    _isLoading = true;
    notifyListeners();

    try {
      final results = await Future.wait([
        _fetchTable('master_leave_types'),
        _fetchTable('master_genders'),
        _fetchTable('master_qualifications'),
        _fetchTable('master_departments'),
        _fetchTable('master_leave_durations'),
      ]);

      _leaveTypes = results[0];
      _genders = results[1];
      _qualifications = results[2];
      _departments = results[3];
      _leaveDurations = results[4];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<Map<String, dynamic>>> _fetchTable(String table) async {
    final data = await _api.get('/master/$table');
    if (data is List) {
      return data.cast<Map<String, dynamic>>();
    }
    return [];
  }

  List<Map<String, dynamic>> getLeaveTypes() => _leaveTypes;
  List<Map<String, dynamic>> getGenders() => _genders;
  List<Map<String, dynamic>> getQualifications() => _qualifications;
  List<Map<String, dynamic>> getDepartments() => _departments;
  List<Map<String, dynamic>> getLeaveDurations() => _leaveDurations;
}
