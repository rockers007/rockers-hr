import 'package:flutter/foundation.dart';

import '../models/payroll_models.dart';
import '../repositories/payroll_repository.dart';
import '../services/logging_service.dart';

enum PayslipsStatus { idle, loading, success, error }

class PayslipsController extends ChangeNotifier {
  PayslipsController(this._repo);

  final PayrollRepository _repo;

  PayslipsStatus _status = PayslipsStatus.idle;
  PayslipsStatus get status => _status;

  String? _error;
  String? get error => _error;

  List<PayslipRow> _rows = [];
  List<PayslipRow> get rows => List.unmodifiable(_rows);

  Future<void> load() async {
    _status = PayslipsStatus.loading;
    _error = null;
    notifyListeners();
    try {
      _rows = await _repo.getPayslips();
      _status = PayslipsStatus.success;
    } catch (e) {
      _error = e.toString();
      _status = PayslipsStatus.error;
      showLog('PayslipsController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  // Returns the download payload, or null when not yet generated.
  Future<Map<String, dynamic>?> getDownload(int year, int month) async {
    try {
      return await _repo.getPayslipDownload(year, month);
    } catch (e) {
      showLog('PayslipsController.getDownload: $e', type: LogType.error);
      return null;
    }
  }
}
