import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter/foundation.dart';

import '../repositories/overtime_repository.dart';
import '../services/logging_service.dart';
import '../services/overtime_service.dart';

enum OvertimeStatus { idle, loading, success, error }

class OvertimeController extends ChangeNotifier {
  OvertimeController(this._repo);

  final OvertimeRepository _repo;

  OvertimeStatus _status = OvertimeStatus.idle;
  OvertimeStatus get status => _status;

  String? _error;
  String? get error => _error;

  List<OvertimeRequest> _requests = [];
  List<OvertimeRequest> get requests => List.unmodifiable(_requests);

  OvertimeSummary? _summary;
  OvertimeSummary? get summary => _summary;

  bool _showForm = false;
  bool get showForm => _showForm;

  bool _submitting = false;
  bool get submitting => _submitting;

  DateTime? _selectedDate;
  DateTime? get selectedDate => _selectedDate;

  TimeOfDay? _startTime;
  TimeOfDay? get startTime => _startTime;

  TimeOfDay? _endTime;
  TimeOfDay? get endTime => _endTime;

  String get calcHours {
    if (_startTime == null || _endTime == null) return '';
    final diff =
        (_endTime!.hour * 60 + _endTime!.minute) -
        (_startTime!.hour * 60 + _startTime!.minute);
    if (diff <= 0) return '0h';
    return '${(diff / 60).toStringAsFixed(1)}h';
  }

  void toggleForm() {
    _showForm = !_showForm;
    notifyListeners();
  }

  void setDate(DateTime date) {
    _selectedDate = date;
    notifyListeners();
  }

  void setStartTime(TimeOfDay time) {
    _startTime = time;
    notifyListeners();
  }

  void setEndTime(TimeOfDay time) {
    _endTime = time;
    notifyListeners();
  }

  void resetForm() {
    _showForm = false;
    _selectedDate = null;
    _startTime = null;
    _endTime = null;
    notifyListeners();
  }

  Future<void> load() async {
    _status = OvertimeStatus.loading;
    notifyListeners();
    try {
      final results = await Future.wait([
        _repo.getRequests(),
        _repo.getSummary(),
      ]);
      _requests = results[0] as List<OvertimeRequest>;
      _summary = results[1] as OvertimeSummary;
      _status = OvertimeStatus.success;
    } catch (e) {
      _error = 'Failed to load overtime data: $e';
      _status = OvertimeStatus.error;
      showLog('OvertimeController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  // Returns true on success so the screen can show the snackbar and clear controllers.
  Future<bool> submit({
    required String date,
    required String startTime,
    required String endTime,
    required String reason,
  }) async {
    if (_selectedDate == null || _startTime == null || _endTime == null) {
      return false;
    }
    _submitting = true;
    notifyListeners();
    try {
      await _repo.apply(
        date: date,
        startTime: startTime,
        endTime: endTime,
        reason: reason,
      );
      resetForm();
      await load();
      return true;
    } catch (e) {
      showLog('OvertimeController.submit: $e', type: LogType.error);
      return false;
    } finally {
      _submitting = false;
      notifyListeners();
    }
  }

  // Returns true on success.
  Future<bool> cancelRequest(String id) async {
    try {
      await _repo.cancel(id);
      await load();
      return true;
    } catch (e) {
      showLog('OvertimeController.cancelRequest: $e', type: LogType.error);
      return false;
    }
  }
}
