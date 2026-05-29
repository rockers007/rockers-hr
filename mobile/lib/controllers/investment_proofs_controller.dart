import 'package:flutter/foundation.dart';

import '../models/payroll_models.dart';
import '../repositories/investment_proofs_repository.dart';
import '../services/logging_service.dart';

enum InvestmentProofsStatus { idle, loading, success, error }

class InvestmentProofsController extends ChangeNotifier {
  InvestmentProofsController(this._repo) : _fy = _currentFy();

  final InvestmentProofsRepository _repo;

  InvestmentProofsStatus _status = InvestmentProofsStatus.idle;
  InvestmentProofsStatus get status => _status;

  String? _error;
  String? get error => _error;

  String _fy;
  String get fy => _fy;

  List<InvestmentProof> _rows = [];
  List<InvestmentProof> get rows => List.unmodifiable(_rows);

  static String _currentFy() {
    final now = DateTime.now();
    final y = now.month >= 4 ? now.year : now.year - 1;
    return '$y-${y + 1}';
  }

  void setFy(String fy) {
    _fy = fy;
    notifyListeners();
    load();
  }

  Future<void> load() async {
    _status = InvestmentProofsStatus.loading;
    _error = null;
    notifyListeners();
    try {
      _rows = await _repo.getProofs(_fy);
      _status = InvestmentProofsStatus.success;
    } catch (e) {
      _error = e.toString();
      _status = InvestmentProofsStatus.error;
      showLog('InvestmentProofsController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  // Returns true on success so the screen can show a snackbar on failure.
  Future<bool> delete(InvestmentProof proof) async {
    try {
      await _repo.deleteProof(proof.id);
      await load();
      return true;
    } catch (e) {
      showLog('InvestmentProofsController.delete: $e', type: LogType.error);
      return false;
    }
  }
}
