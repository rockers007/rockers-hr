import '../models/payroll_models.dart';
import 'api_service.dart';
import 'logging_service.dart';

class PayrollService {
  PayrollService._();
  static final PayrollService instance = PayrollService._();

  final ApiService _api = ApiService.instance;

  // ---- Dashboard ----

  Future<PayrollSalary> getSalary() async {
    final data = await _api.get('/payroll/me/salary');
    return PayrollSalary.fromJson(data as Map<String, dynamic>);
  }

  Future<SalaryPreview?> getSalaryPreview() async {
    try {
      final data = await _api.get('/payroll/me/salary-preview');
      return SalaryPreview.fromJson(data as Map<String, dynamic>);
    } on ApiException catch (e) {
      showLog('PayrollService.getSalaryPreview: ${e.message}', type: LogType.error);
      return null;
    }
  }

  Future<List<PayslipRow>> getPayslips({int? year}) async {
    final path = year != null
        ? '/payroll/me/payslips?year=$year'
        : '/payroll/me/payslips';
    final data = await _api.get(path);
    if (data is! List) return [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(PayslipRow.fromJson)
        .toList();
  }

  Future<List<YtdRow>> getYtd({String? fy}) async {
    final path = fy != null ? '/payroll/me/ytd?fy=$fy' : '/payroll/me/ytd';
    final data = await _api.get(path);
    if (data is! List) return [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(YtdRow.fromJson)
        .toList();
  }

  /// Returns the signed S3 URL for downloading this month's payslip PDF, or
  /// null when not yet ready (the server returns `success: false` wrapped in
  /// the envelope, which ApiService throws as an exception we swallow here).
  Future<Map<String, dynamic>?> getPayslipDownload(int year, int month) async {
    try {
      final data = await _api.get('/payroll/me/payslips/$year/$month/download');
      return data as Map<String, dynamic>?;
    } on ApiException catch (e) {
      showLog('PayrollService.getPayslipDownload: ${e.message}', type: LogType.error);
      return null;
    }
  }

  // ---- Bank change ----

  Future<List<BankChangeRequest>> getMyBankChangeRequests() async {
    final data = await _api.get('/payroll/bank-change/mine');
    if (data is! List) return [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(BankChangeRequest.fromJson)
        .toList();
  }

  Future<BankChangeRequest> submitBankChange({
    required String newBankName,
    required String newAccountNo,
    required String newIfsc,
    String? proofS3Key,
  }) async {
    final data = await _api.post('/payroll/bank-change', body: {
      'new_bank_name': newBankName,
      'new_account_no': newAccountNo,
      'new_ifsc': newIfsc,
      if (proofS3Key != null) 'proof_s3_key': proofS3Key,
    });
    return BankChangeRequest.fromJson(data as Map<String, dynamic>);
  }

  /// First-time bank entry — PATCH /users/me with all three bank
  /// fields together. Backend gates this in
  /// UsersService.updateProfile: it only accepts bank fields when the
  /// existing user row has all three columns null. Once any are set,
  /// further changes go through the bank-change request workflow
  /// above. Server enforces the same IFSC + 9–18 digit account
  /// validators that submitBankChange does, so the client doesn't
  /// need to do double-checking — it just surfaces whichever
  /// BadRequest the server returns.
  Future<void> setBankDetailsFirstTime({
    required String bankName,
    required String accountNo,
    required String ifsc,
  }) async {
    await _api.patch('/users/me', body: {
      'bank_name': bankName,
      'bank_account_no': accountNo,
      'bank_ifsc': ifsc,
    });
  }

  // ---- Investment proofs ----

  Future<List<InvestmentProof>> getInvestmentProofs(String fy) async {
    final data = await _api.get('/payroll/investment-proofs/mine?fy=$fy');
    if (data is! List) return [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(InvestmentProof.fromJson)
        .toList();
  }

  Future<void> deleteInvestmentProof(String id) async {
    await _api.delete('/payroll/investment-proofs/$id');
  }

  /// Registers an already-uploaded investment proof (caller does the S3 PUT
  /// via the presigned URL first).
  Future<InvestmentProof> registerInvestmentProof({
    required String financialYear,
    required String category,
    String? description,
    double? amount,
    required String s3Key,
    int? fileSizeBytes,
    String? mimeType,
  }) async {
    final data = await _api.post('/payroll/investment-proofs', body: {
      'financial_year': financialYear,
      'category': category,
      if (description != null) 'description': description,
      if (amount != null) 'amount': amount,
      's3_key': s3Key,
      if (fileSizeBytes != null) 'file_size_bytes': fileSizeBytes,
      if (mimeType != null) 'mime_type': mimeType,
    });
    return InvestmentProof.fromJson(data as Map<String, dynamic>);
  }
}
