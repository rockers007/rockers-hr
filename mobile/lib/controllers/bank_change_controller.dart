import 'package:flutter/foundation.dart';

import '../models/payroll_models.dart';
import '../repositories/bank_change_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum BankChangeStatus { idle, loading, success, error }

class BankChangeController extends ChangeNotifier {
  BankChangeController(this._repo);

  final BankChangeRepository _repo;

  static final ifscRegex = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');
  static final digitsRegex = RegExp(r'^\d{9,18}$');

  BankChangeStatus _status = BankChangeStatus.idle;
  BankChangeStatus get status => _status;

  String? _error;
  String? get error => _error;

  PayrollSalary? _salary;
  PayrollSalary? get salary => _salary;

  List<BankChangeRequest> _history = [];
  List<BankChangeRequest> get history => List.unmodifiable(_history);

  bool _showForm = false;

  bool _submitting = false;
  bool get submitting => _submitting;

  String? _actionError;
  String? get actionError => _actionError;
  void clearActionError() {
    _actionError = null;
    notifyListeners();
  }

  bool get isFirstTimeEntry =>
      (_salary?.bankName ?? '').isEmpty &&
      (_salary?.bankAccountNo ?? '').isEmpty &&
      (_salary?.bankIfsc ?? '').isEmpty;

  bool get hasPending => _history.any((h) => h.status == 'PENDING');

  // First-time entry always shows the form; otherwise controlled by _showForm.
  bool get showForm => _showForm || isFirstTimeEntry;

  void openForm() {
    _showForm = true;
    notifyListeners();
  }

  void closeForm() {
    _showForm = false;
    notifyListeners();
  }

  Future<void> load() async {
    _status = BankChangeStatus.loading;
    notifyListeners();
    try {
      final results = await Future.wait([
        _repo.getSalary(),
        _repo.getHistory(),
      ]);
      _salary = results[0] as PayrollSalary;
      _history = results[1] as List<BankChangeRequest>;
      _status = BankChangeStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = BankChangeStatus.error;
      showLog('BankChangeController.load: ${e.message}', type: LogType.error);
    } catch (e) {
      _error = e.toString();
      _status = BankChangeStatus.error;
      showLog('BankChangeController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  // Returns a success message string on success, null on failure.
  Future<String?> submit({
    required String bankName,
    required String accountNo,
    required String ifsc,
  }) async {
    _submitting = true;
    _actionError = null;
    notifyListeners();

    try {
      String message;
      if (isFirstTimeEntry) {
        await _repo.setFirstTime(
          bankName: bankName,
          accountNo: accountNo,
          ifsc: ifsc,
        );
        message =
            'Bank details saved. Future changes will need HR approval.';
      } else {
        await _repo.submitChange(
          newBankName: bankName,
          newAccountNo: accountNo,
          newIfsc: ifsc,
        );
        message = 'Request submitted — HR will review.';
      }
      _showForm = false;
      await load();
      return message;
    } on ApiException catch (e) {
      _actionError = e.message;
      notifyListeners();
      return null;
    } catch (e) {
      _actionError = e.toString();
      notifyListeners();
      return null;
    } finally {
      _submitting = false;
      notifyListeners();
    }
  }
}
