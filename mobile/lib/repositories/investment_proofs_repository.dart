import '../models/payroll_models.dart';
import '../services/payroll_service.dart';

class InvestmentProofsRepository {
  Future<List<InvestmentProof>> getProofs(String fy) =>
      PayrollService.instance.getInvestmentProofs(fy);

  Future<void> deleteProof(String id) =>
      PayrollService.instance.deleteInvestmentProof(id);
}
