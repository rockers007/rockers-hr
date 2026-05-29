import 'package:flutter/foundation.dart';

import '../models/leave_models.dart';
import '../repositories/leave_history_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum HistoryStatus { idle, loading, success, error }

class HistoryController extends ChangeNotifier {
  HistoryController(this._repo);

  final LeaveHistoryRepository _repo;

  static const filters = [
    ('ALL', 'All'),
    ('PENDING_L1,PENDING_L2', 'Pending'),
    ('APPROVED', 'Approved'),
    ('DECLINED', 'Declined'),
    ('CANCELLED', 'Cancelled'),
  ];

  HistoryStatus _status = HistoryStatus.idle;
  HistoryStatus get status => _status;

  String? _error;
  String? get error => _error;

  List<LeaveRequest> _requests = [];
  List<LeaveRequest> get requests => List.unmodifiable(_requests);

  String _selectedFilter = 'ALL';
  String get selectedFilter => _selectedFilter;

  int _selectedYear = DateTime.now().year;
  int get selectedYear => _selectedYear;

  void setFilter(String filter) {
    _selectedFilter = filter;
    notifyListeners();
    load();
  }

  void setYear(int year) {
    _selectedYear = year;
    notifyListeners();
    load();
  }

  Future<void> load() async {
    _status = HistoryStatus.loading;
    notifyListeners();
    try {
      _requests = await _repo.getRequests(
        status: _selectedFilter == 'ALL' ? null : _selectedFilter,
        year: _selectedYear,
      );
      _status = HistoryStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = HistoryStatus.error;
      showLog('HistoryController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Failed to load history: $e';
      _status = HistoryStatus.error;
      showLog('HistoryController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }
}
