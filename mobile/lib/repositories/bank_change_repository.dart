import '../models/payroll_models.dart';
import '../services/payroll_service.dart';

class BankChangeRepository {
  Future<PayrollSalary> getSalary() => PayrollService.instance.getSalary();

  Future<List<BankChangeRequest>> getHistory() =>
      PayrollService.instance.getMyBankChangeRequests();

  Future<void> submitChange({
    required String newBankName,
    required String newAccountNo,
    required String newIfsc,
  }) =>
      PayrollService.instance.submitBankChange(
        newBankName: newBankName,
        newAccountNo: newAccountNo,
        newIfsc: newIfsc,
      );

  Future<void> setFirstTime({
    required String bankName,
    required String accountNo,
    required String ifsc,
  }) =>
      PayrollService.instance.setBankDetailsFirstTime(
        bankName: bankName,
        accountNo: accountNo,
        ifsc: ifsc,
      );
}
