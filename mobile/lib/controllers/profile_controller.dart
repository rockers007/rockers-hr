import 'package:flutter/foundation.dart';

import '../models/leave_models.dart';
import '../repositories/profile_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum ProfileStatus { idle, loading, success, error }

class ProfileController extends ChangeNotifier {
  ProfileController(this._repo);

  final ProfileRepository _repo;

  ProfileStatus _status = ProfileStatus.idle;
  ProfileStatus get status => _status;

  String? _error;
  String? get error => _error;

  List<LeaveBalance> _balances = [];
  List<LeaveBalance> get balances => List.unmodifiable(_balances);

  Future<void> load() async {
    _status = ProfileStatus.loading;
    notifyListeners();
    try {
      _balances = await _repo.getBalances();
      _status = ProfileStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = ProfileStatus.error;
      showLog('ProfileController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = 'Failed to load balances: $e';
      _status = ProfileStatus.error;
      showLog('ProfileController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }
}
