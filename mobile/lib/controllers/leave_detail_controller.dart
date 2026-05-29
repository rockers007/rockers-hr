import 'package:flutter/foundation.dart';

import '../models/leave_models.dart';
import '../repositories/leave_detail_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum LeaveDetailStatus { idle, loading, success, error }

class LeaveDetailController extends ChangeNotifier {
  LeaveDetailController(this._repo, this.requestId);

  final LeaveDetailRepository _repo;
  final String requestId;

  LeaveDetailStatus _status = LeaveDetailStatus.idle;
  LeaveDetailStatus get status => _status;

  String? _error;
  String? get error => _error;

  LeaveRequest? _request;
  LeaveRequest? get request => _request;

  bool _cancelling = false;
  bool get cancelling => _cancelling;

  Future<void> load() async {
    _status = LeaveDetailStatus.loading;
    notifyListeners();
    try {
      _request = await _repo.getById(requestId);
      _status = LeaveDetailStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = LeaveDetailStatus.error;
      showLog('LeaveDetailController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Failed to load details: $e';
      _status = LeaveDetailStatus.error;
      showLog('LeaveDetailController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  // Returns true on success so the screen can pop and show a snackbar.
  Future<bool> cancel() async {
    _cancelling = true;
    notifyListeners();
    try {
      await _repo.cancel(requestId);
      _cancelling = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _cancelling = false;
      showLog('LeaveDetailController.cancel: ${e.message}', type: LogType.error);
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Cancellation failed: $e';
      _cancelling = false;
      showLog('LeaveDetailController.cancel: $e', type: LogType.error);
      notifyListeners();
      return false;
    }
  }
}
