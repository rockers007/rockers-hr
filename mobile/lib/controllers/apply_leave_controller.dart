import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter/foundation.dart';

import '../models/leave_models.dart';
import '../models/user_model.dart';
import '../repositories/apply_leave_repository.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/logging_service.dart';
import '../services/master_data_service.dart';

enum ApplyLeaveStatus { initial, loading, ready, error }

class ApplyLeaveController extends ChangeNotifier {
  ApplyLeaveController({
    required ApplyLeaveRepository repo,
    required MasterDataService masterData,
    required AuthService auth,
  })  : _repo = repo,
        _masterData = masterData,
        _auth = auth;

  final ApplyLeaveRepository _repo;
  final MasterDataService _masterData;
  final AuthService _auth;

  // ── Load state ──
  ApplyLeaveStatus _status = ApplyLeaveStatus.initial;
  ApplyLeaveStatus get status => _status;

  String? _error;
  String? get error => _error;

  // Transient error for calculate/submit failures, shown as a SnackBar by the view.
  String? _actionError;
  String? get actionError => _actionError;
  void clearActionError() => _actionError = null;

  // ── Wizard state ──
  int _step = 0;
  int get step => _step;

  List<LeaveType> _leaveTypes = [];
  List<LeaveType> get leaveTypes => _leaveTypes;

  List<LeaveBalance> _balances = [];

  List<LeaveDuration> _durations = [];
  List<LeaveDuration> get durations => _durations;

  LeaveType? _selectedType;
  LeaveType? get selectedType => _selectedType;

  LeaveDuration? _selectedDuration;
  LeaveDuration? get selectedDuration => _selectedDuration;

  DateTime? _startDate;
  DateTime? get startDate => _startDate;

  DateTime? _endDate;
  DateTime? get endDate => _endDate;

  CalculateResult? _calcResult;
  CalculateResult? get calcResult => _calcResult;

  bool _calculating = false;
  bool get calculating => _calculating;

  DateTime? _earlyLeaveDate;
  DateTime? get earlyLeaveDate => _earlyLeaveDate;

  TimeOfDay? _earlyLeaveStartTime;
  TimeOfDay? get earlyLeaveStartTime => _earlyLeaveStartTime;

  TimeOfDay? _earlyLeaveEndTime;
  TimeOfDay? get earlyLeaveEndTime => _earlyLeaveEndTime;

  String _reason = '';
  String get reason => _reason;

  bool _sandwichAcknowledged = false;
  bool get sandwichAcknowledged => _sandwichAcknowledged;

  bool _submitting = false;
  bool get submitting => _submitting;

  // ── Derived ──
  User? get currentUser => _auth.currentUser;

  bool get isEarlyLeave =>
      _selectedType?.label.toLowerCase().contains('early') == true;

  bool get isEmploymentEnded {
    final user = _auth.currentUser;
    if (user == null) return false;
    if (user.employmentStatus != 'active') return true;
    if (user.lastWorkingDay == null) return false;
    final lwd = DateTime.tryParse(user.lastWorkingDay!);
    if (lwd == null) return false;
    final today = DateTime.now();
    return DateTime(today.year, today.month, today.day)
        .isAfter(DateTime(lwd.year, lwd.month, lwd.day));
  }

  double getBalance(String typeId) {
    final match = _balances.where((b) => b.leaveType.id == typeId);
    return match.isNotEmpty ? match.first.availableDays : 0;
  }

  String formatDays(double days) => days == days.roundToDouble()
      ? '${days.toInt()}'
      : days.toStringAsFixed(1);

  // ── Data loading ──

  Future<void> loadInitialData() async {
    _status = ApplyLeaveStatus.loading;
    notifyListeners();
    try {
      // Fire both requests concurrently, await individually to keep types.
      final typesFuture = _repo.getEligibleLeaveTypes();
      final balancesFuture = _repo.getBalances();
      _leaveTypes = await typesFuture;
      _balances = await balancesFuture;
      _durations = _masterData.leaveDurations
          .map((e) => LeaveDuration.fromJson(e))
          .toList();
      if (_durations.isNotEmpty) _selectedDuration = _durations.first;
      _status = ApplyLeaveStatus.ready;
    } on ApiException catch (e) {
      _error = e.message;
      _status = ApplyLeaveStatus.error;
      showLog('ApplyLeaveController.loadInitialData: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Failed to load leave types: $e';
      _status = ApplyLeaveStatus.error;
      showLog('ApplyLeaveController.loadInitialData: $e', type: LogType.error);
    }
    notifyListeners();
  }

  // ── Selections ──

  void selectType(LeaveType type) {
    _selectedType = type;
    notifyListeners();
    _triggerCalculate();
  }

  void selectDuration(LeaveDuration duration) {
    _selectedDuration = duration;
    notifyListeners();
    _triggerCalculate();
  }

  void setStartDate(DateTime date) {
    _startDate = date;
    if (_endDate != null && _endDate!.isBefore(date)) {
      _endDate = date;
    }
    notifyListeners();
    _triggerCalculate();
  }

  void setEndDate(DateTime date) {
    _endDate = date;
    notifyListeners();
    _triggerCalculate();
  }

  void setEarlyLeaveDate(DateTime date) {
    _earlyLeaveDate = date;
    notifyListeners();
  }

  void setEarlyLeaveStartTime(TimeOfDay time) {
    _earlyLeaveStartTime = time;
    notifyListeners();
  }

  void setEarlyLeaveEndTime(TimeOfDay time) {
    _earlyLeaveEndTime = time;
    notifyListeners();
  }

  void setReason(String value) {
    _reason = value;
    notifyListeners();
  }

  void setSandwichAcknowledged(bool value) {
    _sandwichAcknowledged = value;
    notifyListeners();
  }

  // ── Navigation ──

  bool canGoNext() {
    switch (_step) {
      case 0:
        return _selectedType != null &&
            _selectedDuration != null &&
            _startDate != null &&
            _endDate != null &&
            _calcResult != null;
      case 1:
        return _reason.trim().length >= 10 &&
            (!(_calcResult?.sandwichDetected ?? false) || _sandwichAcknowledged);
      default:
        return true;
    }
  }

  void nextStep() {
    if (_step < 2) {
      _step++;
      notifyListeners();
    }
  }

  void previousStep() {
    if (_step > 0) {
      _step--;
      notifyListeners();
    }
  }

  // ── Calculate ──

  Future<void> _triggerCalculate() async {
    if (_selectedType == null ||
        _selectedDuration == null ||
        _startDate == null ||
        _endDate == null) {
      return;
    }

    _calculating = true;
    _calcResult = null;
    notifyListeners();

    try {
      _calcResult = await _repo.calculateLeave(
        leaveTypeId: _selectedType!.id,
        durationTypeId: _selectedDuration!.id,
        startDate: _startDate!,
        endDate: _endDate!,
      );
    } on ApiException catch (e) {
      _actionError = e.message;
      showLog('ApplyLeaveController._triggerCalculate: ${e.message}', type: LogType.error);
    } catch (e) {
      showLog('ApplyLeaveController._triggerCalculate: $e', type: LogType.error);
    } finally {
      _calculating = false;
      notifyListeners();
    }
  }

  // ── Submit — returns true on success so the view can navigate ──

  Future<bool> submit() async {
    _submitting = true;
    _actionError = null;
    notifyListeners();

    try {
      await _repo.submitRequest(
        leaveTypeId: _selectedType!.id,
        durationTypeId: _selectedDuration!.id,
        startDate: isEarlyLeave ? _earlyLeaveDate! : _startDate!,
        endDate: isEarlyLeave ? _earlyLeaveDate! : _endDate!,
        reason: _reason.trim(),
        earlyLeaveDate: isEarlyLeave ? _earlyLeaveDate : null,
        earlyLeaveStartTime: isEarlyLeave ? _earlyLeaveStartTime : null,
        earlyLeaveEndTime: isEarlyLeave ? _earlyLeaveEndTime : null,
      );
      return true;
    } on ApiException catch (e) {
      _actionError = e.message;
      showLog('ApplyLeaveController.submit: ${e.message}', type: LogType.error);
    } catch (e) {
      _actionError = 'Submission failed: $e';
      showLog('ApplyLeaveController.submit: $e', type: LogType.error);
    } finally {
      _submitting = false;
      notifyListeners();
    }
    return false;
  }
}
