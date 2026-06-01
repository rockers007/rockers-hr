import 'package:flutter/foundation.dart';

import '../models/payroll_models.dart';
import '../repositories/payroll_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum SalaryStatus { idle, loading, success, error }

class SalaryController extends ChangeNotifier {
  SalaryController(this._repo);

  final PayrollRepository _repo;

  SalaryStatus _status = SalaryStatus.idle;
  SalaryStatus get status => _status;

  String? _error;
  String? get error => _error;

  PayrollSalary? _salary;
  PayrollSalary? get salary => _salary;

  Future<void> load() async {
    _status = SalaryStatus.loading;
    _error = null;
    notifyListeners();
    try {
      _salary = await _repo.getSalary();
      _status = SalaryStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = SalaryStatus.error;
      showLog('SalaryController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = e.toString();
      _status = SalaryStatus.error;
      showLog('SalaryController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }
}
