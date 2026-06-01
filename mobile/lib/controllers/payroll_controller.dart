import 'package:flutter/foundation.dart';

import '../models/payroll_models.dart';
import '../repositories/payroll_repository.dart';
import '../services/logging_service.dart';

enum PayrollStatus { idle, loading, success, error }

class PayrollController extends ChangeNotifier {
  PayrollController(this._repo);

  final PayrollRepository _repo;

  PayrollStatus _status = PayrollStatus.idle;
  PayrollStatus get status => _status;

  String? _error;
  String? get error => _error;

  SalaryPreview? _preview;
  SalaryPreview? get preview => _preview;

  List<PayslipRow> _payslips = [];
  List<PayslipRow> get payslips => List.unmodifiable(_payslips);

  List<YtdRow> _ytd = [];
  List<YtdRow> get ytd => List.unmodifiable(_ytd);

  Future<void> load() async {
    _status = PayrollStatus.loading;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _repo.getSalaryPreview(),
        _repo.getPayslips(),
        _repo.getYtd(),
      ]);
      _preview = results[0] as SalaryPreview?;
      _payslips = results[1] as List<PayslipRow>;
      _ytd = results[2] as List<YtdRow>;
      _status = PayrollStatus.success;
    } catch (e) {
      _error = e.toString();
      _status = PayrollStatus.error;
      showLog('PayrollController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }
}
