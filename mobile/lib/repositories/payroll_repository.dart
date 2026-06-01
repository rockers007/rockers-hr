import '../models/payroll_models.dart';
import '../services/payroll_service.dart';

class PayrollRepository {
  Future<PayrollSalary> getSalary() => PayrollService.instance.getSalary();

  Future<SalaryPreview?> getSalaryPreview() =>
      PayrollService.instance.getSalaryPreview();

  Future<List<PayslipRow>> getPayslips() =>
      PayrollService.instance.getPayslips();

  Future<List<YtdRow>> getYtd() => PayrollService.instance.getYtd();

  Future<Map<String, dynamic>?> getPayslipDownload(int year, int month) =>
      PayrollService.instance.getPayslipDownload(year, month);
}
