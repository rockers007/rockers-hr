import 'package:flutter/foundation.dart';

import '../models/leave_models.dart';
import '../repositories/home_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum HomeStatus { idle, loading, success, error }

class HomeController extends ChangeNotifier {
  HomeController(this._repo);

  final HomeRepository _repo;

  HomeStatus _status = HomeStatus.idle;
  HomeStatus get status => _status;

  String? _error;
  String? get error => _error;

  List<LeaveBalance> _balances = [];
  List<LeaveBalance> get balances => List.unmodifiable(_balances);

  List<LeaveRequest> _activeRequests = [];
  List<LeaveRequest> get activeRequests => List.unmodifiable(_activeRequests);

  int _unreadCount = 0;
  int get unreadCount => _unreadCount;

  Future<void> load() async {
    _status = HomeStatus.loading;
    notifyListeners();
    try {
      final results = await Future.wait([
        _repo.getBalances(),
        _repo.getActiveRequests(),
        _repo.getUnreadCount(),
      ]);
      _balances = results[0] as List<LeaveBalance>;
      _activeRequests = results[1] as List<LeaveRequest>;
      _unreadCount = results[2] as int;
      _status = HomeStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = HomeStatus.error;
      showLog('HomeController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Failed to load data: $e';
      _status = HomeStatus.error;
      showLog('HomeController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }
}
