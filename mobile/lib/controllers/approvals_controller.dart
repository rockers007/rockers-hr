import 'package:flutter/foundation.dart';

import '../models/leave_models.dart';
import '../repositories/approvals_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum ApprovalsStatus { idle, loading, success, error }

class ApprovalsController extends ChangeNotifier {
  ApprovalsController(this._repo);

  final ApprovalsRepository _repo;

  ApprovalsStatus _status = ApprovalsStatus.idle;
  ApprovalsStatus get status => _status;

  String? _error;
  String? get error => _error;

  List<PendingApproval> _approvals = [];
  List<PendingApproval> get approvals => List.unmodifiable(_approvals);

  String? _actionError;
  String? get actionError => _actionError;
  void clearActionError() {
    _actionError = null;
    notifyListeners();
  }

  Future<void> load() async {
    _status = ApprovalsStatus.loading;
    notifyListeners();
    try {
      _approvals = await _repo.getPending();
      _status = ApprovalsStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = ApprovalsStatus.error;
      showLog('ApprovalsController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Failed to load approvals: $e';
      _status = ApprovalsStatus.error;
      showLog('ApprovalsController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  Future<bool> approve(String id, int index) async {
    try {
      await _repo.approve(id);
      _approvals = List.of(_approvals)..removeAt(index);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _actionError = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _actionError = 'Approval failed: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> decline(String id, int index, String reason) async {
    try {
      await _repo.decline(id, reason);
      _approvals = List.of(_approvals)..removeAt(index);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _actionError = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _actionError = 'Decline failed: $e';
      notifyListeners();
      return false;
    }
  }
}
