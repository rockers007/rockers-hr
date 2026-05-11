/// DTOs for the payroll module — mirrors the endpoints under /api/v1/payroll/me/*.

String _s(dynamic v) => v?.toString() ?? '';
double _d(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

/// Per-row entry in the salary breakdown (earnings or deductions).
/// Mirrors the shape produced by SalaryService.previewComputation on
/// the backend so we can render the same component-level table the
/// web app uses on /payroll/salary and the admin salary-config page.
class BreakdownRow {
  final String code;
  final String label;
  final String amount;
  final bool isPfBase;

  BreakdownRow({
    required this.code,
    required this.label,
    required this.amount,
    this.isPfBase = false,
  });

  factory BreakdownRow.fromJson(Map<String, dynamic> j) => BreakdownRow(
        code: _s(j['code']),
        label: _s(j['label']),
        amount: _s(j['amount']),
        isPfBase: j['is_pf_base'] == true,
      );
}

class ComputedPreview {
  final String gross;
  final String salForCalc;
  final String totalEarnings;
  final String totalDeductions;
  final String estimatedNetPayable;
  final String ctc;
  final String ctcAsPerIt;
  final String employeePf;
  final String professionalTax;
  // Per-component arrays — earnings (Basic, HRA, …, Incentive,
  // Employer PF) and deductions (Employee PF, ESIC if applied, PT,
  // TDS, Loan EMI, Salary Deduction, Employer-PF offset). Optional
  // for back-compat with older deployments that don't yet emit these
  // — the screen falls back to the flat view in that case.
  final List<BreakdownRow> earnings;
  final List<BreakdownRow> deductions;

  ComputedPreview({
    required this.gross,
    required this.salForCalc,
    required this.totalEarnings,
    required this.totalDeductions,
    required this.estimatedNetPayable,
    required this.ctc,
    required this.ctcAsPerIt,
    required this.employeePf,
    required this.professionalTax,
    this.earnings = const [],
    this.deductions = const [],
  });

  factory ComputedPreview.fromJson(Map<String, dynamic> j) => ComputedPreview(
        gross: _s(j['gross']),
        salForCalc: _s(j['sal_for_calc']),
        totalEarnings: _s(j['total_earnings']),
        totalDeductions: _s(j['total_deductions']),
        estimatedNetPayable: _s(j['estimated_net_payable']),
        ctc: _s(j['ctc']),
        ctcAsPerIt: _s(j['ctc_as_per_it']),
        employeePf: _s(j['employee_pf']),
        professionalTax: _s(j['professional_tax']),
        earnings: (j['earnings'] as List?)
                ?.map((e) => BreakdownRow.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
        deductions: (j['deductions'] as List?)
                ?.map((e) => BreakdownRow.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );

  bool get hasComponentRows =>
      earnings.isNotEmpty || deductions.isNotEmpty;
}

class PayrollSalary {
  final String userId;
  final String? empNumber;
  final String? name;
  final String? designation;
  final String gross;
  final String incentive;
  final String tds;
  final String loanEmi;
  final String salDeduction;
  final String securityReturn;
  final bool pfApplicable;
  // Per-employee ESIC gate added in EsicApplicableFlag1712000000090.
  // Defaults to true to match the backend column default and the
  // behavior employees saw before the flag existed.
  final bool esicApplicable;
  final String? bankName;
  final String? bankAccountNo;
  final String? bankIfsc;
  final String? dob;
  final ComputedPreview? computedPreview;

  PayrollSalary({
    required this.userId,
    this.empNumber,
    this.name,
    this.designation,
    required this.gross,
    required this.incentive,
    required this.tds,
    required this.loanEmi,
    required this.salDeduction,
    required this.securityReturn,
    required this.pfApplicable,
    this.esicApplicable = true,
    this.bankName,
    this.bankAccountNo,
    this.bankIfsc,
    this.dob,
    this.computedPreview,
  });

  factory PayrollSalary.fromJson(Map<String, dynamic> j) => PayrollSalary(
        userId: _s(j['user_id']),
        empNumber: j['emp_number'] as String?,
        name: j['name'] as String?,
        designation: j['designation'] as String?,
        gross: _s(j['gross']),
        incentive: _s(j['incentive']),
        tds: _s(j['tds']),
        loanEmi: _s(j['loan_emi']),
        salDeduction: _s(j['sal_deduction']),
        securityReturn: _s(j['security_return']),
        pfApplicable: j['pf_applicable'] == true,
        // Default to true when missing so older API responses (or
        // builds that pre-date the column) still surface ESIC rows
        // exactly as before.
        esicApplicable: j['esic_applicable'] == null
            ? true
            : j['esic_applicable'] == true,
        bankName: j['bank_name'] as String?,
        bankAccountNo: j['bank_account_no'] as String?,
        bankIfsc: j['bank_ifsc'] as String?,
        dob: j['dob'] as String?,
        computedPreview: j['computed_preview'] is Map<String, dynamic>
            ? ComputedPreview.fromJson(j['computed_preview'])
            : null,
      );
}

class SalaryPreview {
  final String previewMonth;
  final int previewYear;
  final String note;
  final String? estimatedNetPayable;
  final String? totalEarnings;
  final String? totalDeductions;
  final String? ctc;

  SalaryPreview({
    required this.previewMonth,
    required this.previewYear,
    required this.note,
    this.estimatedNetPayable,
    this.totalEarnings,
    this.totalDeductions,
    this.ctc,
  });

  factory SalaryPreview.fromJson(Map<String, dynamic> j) => SalaryPreview(
        previewMonth: _s(j['preview_month']),
        previewYear: j['preview_year'] is int
            ? j['preview_year']
            : int.tryParse(_s(j['preview_year'])) ?? 0,
        note: _s(j['note']),
        estimatedNetPayable: j['estimated_net_payable'] as String?,
        totalEarnings: j['total_earnings'] as String?,
        totalDeductions: j['total_deductions'] as String?,
        ctc: j['ctc'] as String?,
      );
}

class PayslipRow {
  final String runId;
  final int month;
  final int year;
  final String? releaseDate;
  final String netPayable;
  final String totalEarnings;
  final String totalDeductions;

  PayslipRow({
    required this.runId,
    required this.month,
    required this.year,
    this.releaseDate,
    required this.netPayable,
    required this.totalEarnings,
    required this.totalDeductions,
  });

  factory PayslipRow.fromJson(Map<String, dynamic> j) => PayslipRow(
        runId: _s(j['run_id']),
        month: j['month'] is int ? j['month'] : int.tryParse(_s(j['month'])) ?? 0,
        year: j['year'] is int ? j['year'] : int.tryParse(_s(j['year'])) ?? 0,
        releaseDate: j['release_date'] as String?,
        netPayable: _s(j['net_payable']),
        totalEarnings: _s(j['total_earnings']),
        totalDeductions: _s(j['total_deductions']),
      );
}

class YtdRow {
  final String financialYear;
  final String ytdEarnings;
  final String ytdEmployeePf;
  final String ytdTds;
  final String ytdNetPayable;
  final String monthsProcessed;

  YtdRow({
    required this.financialYear,
    required this.ytdEarnings,
    required this.ytdEmployeePf,
    required this.ytdTds,
    required this.ytdNetPayable,
    required this.monthsProcessed,
  });

  factory YtdRow.fromJson(Map<String, dynamic> j) => YtdRow(
        financialYear: _s(j['financial_year']),
        ytdEarnings: _s(j['ytd_earnings']),
        ytdEmployeePf: _s(j['ytd_employee_pf']),
        ytdTds: _s(j['ytd_tds']),
        ytdNetPayable: _s(j['ytd_net_payable']),
        monthsProcessed: _s(j['months_processed']),
      );
}

class BankChangeRequest {
  final String id;
  final String userId;
  final String? currentBankName;
  final String? currentAccountNo;
  final String? currentIfsc;
  final String newBankName;
  final String newAccountNo;
  final String newIfsc;
  final String? proofS3Key;
  final String status;
  final String submittedAt;
  final String? reviewedBy;
  final String? reviewedAt;
  final String? rejectionReason;

  BankChangeRequest({
    required this.id,
    required this.userId,
    this.currentBankName,
    this.currentAccountNo,
    this.currentIfsc,
    required this.newBankName,
    required this.newAccountNo,
    required this.newIfsc,
    this.proofS3Key,
    required this.status,
    required this.submittedAt,
    this.reviewedBy,
    this.reviewedAt,
    this.rejectionReason,
  });

  factory BankChangeRequest.fromJson(Map<String, dynamic> j) => BankChangeRequest(
        id: _s(j['id']),
        userId: _s(j['user_id']),
        currentBankName: j['current_bank_name'] as String?,
        currentAccountNo: j['current_account_no'] as String?,
        currentIfsc: j['current_ifsc'] as String?,
        newBankName: _s(j['new_bank_name']),
        newAccountNo: _s(j['new_account_no']),
        newIfsc: _s(j['new_ifsc']),
        proofS3Key: j['proof_s3_key'] as String?,
        status: _s(j['status']),
        submittedAt: _s(j['submitted_at']),
        reviewedBy: j['reviewed_by'] as String?,
        reviewedAt: j['reviewed_at'] as String?,
        rejectionReason: j['rejection_reason'] as String?,
      );
}

class InvestmentProof {
  final String id;
  final String userId;
  final String financialYear;
  final String category;
  final String? description;
  final String? amount;
  final String s3Key;
  final String? mimeType;
  final String uploadedAt;

  InvestmentProof({
    required this.id,
    required this.userId,
    required this.financialYear,
    required this.category,
    this.description,
    this.amount,
    required this.s3Key,
    this.mimeType,
    required this.uploadedAt,
  });

  factory InvestmentProof.fromJson(Map<String, dynamic> j) => InvestmentProof(
        id: _s(j['id']),
        userId: _s(j['user_id']),
        financialYear: _s(j['financial_year']),
        category: _s(j['category']),
        description: j['description'] as String?,
        amount: j['amount'] as String?,
        s3Key: _s(j['s3_key']),
        mimeType: j['mime_type'] as String?,
        uploadedAt: _s(j['uploaded_at']),
      );
}

String formatInr(dynamic value) {
  final n = _d(value);
  // Indian grouping: 12,34,567.89. Flutter's default NumberFormat.currency
  // uses Western grouping; hand-rolled to match the web app.
  final abs = n.abs();
  final parts = abs.toStringAsFixed(2).split('.');
  final intPart = parts[0];
  final decimal = parts[1];
  String grouped;
  if (intPart.length <= 3) {
    grouped = intPart;
  } else {
    final last3 = intPart.substring(intPart.length - 3);
    var rest = intPart.substring(0, intPart.length - 3);
    final buf = StringBuffer();
    while (rest.length > 2) {
      buf.write(rest.substring(rest.length - 2) + ',' + (buf.isEmpty ? '' : buf.toString()));
      // rebuild properly — simpler reverse approach below
      rest = rest.substring(0, rest.length - 2);
    }
    // simpler rewrite
    grouped = _indianGroup(intPart);
  }
  final sign = n < 0 ? '-' : '';
  return '$sign₹$grouped.$decimal';
}

String _indianGroup(String intPart) {
  if (intPart.length <= 3) return intPart;
  final last3 = intPart.substring(intPart.length - 3);
  final rest = intPart.substring(0, intPart.length - 3);
  final chunks = <String>[];
  for (var i = rest.length; i > 0; i -= 2) {
    final start = (i - 2) < 0 ? 0 : i - 2;
    chunks.insert(0, rest.substring(start, i));
  }
  return '${chunks.join(',')},$last3';
}
