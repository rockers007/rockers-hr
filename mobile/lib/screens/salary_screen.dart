import 'package:flutter/material.dart';

import '../config/theme.dart';
import '../models/payroll_models.dart';
import '../services/payroll_service.dart';

class SalaryScreen extends StatefulWidget {
  const SalaryScreen({super.key});

  @override
  State<SalaryScreen> createState() => _SalaryScreenState();
}

class _SalaryScreenState extends State<SalaryScreen> {
  final _svc = PayrollService.instance;
  bool _loading = true;
  String? _error;
  PayrollSalary? _salary;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _salary = await _svc.getSalary();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Salary Breakdown'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: AppColors.declinedText),
                      textAlign: TextAlign.center,
                    ),
                  ),
                )
              : _salary == null
                  ? const Center(child: Text('Salary not configured'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _card(
                            title: 'Structure',
                            rows: [
                              ['Gross', formatInr(_salary!.gross)],
                              ['Incentive / Fix Variable', formatInr(_salary!.incentive)],
                              ['PF Applicable', _salary!.pfApplicable ? 'Yes' : 'No'],
                              ['Monthly TDS', formatInr(_salary!.tds)],
                              ['Loan EMI', formatInr(_salary!.loanEmi)],
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (_salary!.computedPreview != null)
                            _card(
                              title: 'This Month (0 LWP, 0 OT)',
                              rows: [
                                ['Sal for Calc', formatInr(_salary!.computedPreview!.salForCalc)],
                                ['Total Earnings', formatInr(_salary!.computedPreview!.totalEarnings)],
                                ['Employee PF', formatInr(_salary!.computedPreview!.employeePf)],
                                ['Professional Tax', formatInr(_salary!.computedPreview!.professionalTax)],
                                ['Total Deductions', formatInr(_salary!.computedPreview!.totalDeductions)],
                              ],
                              bottomRow: [
                                'Estimated Net Payable',
                                formatInr(_salary!.computedPreview!.estimatedNetPayable),
                              ],
                              extraRows: [
                                ['CTC', formatInr(_salary!.computedPreview!.ctc)],
                                ['CTC As Per IT', formatInr(_salary!.computedPreview!.ctcAsPerIt)],
                              ],
                            ),
                          const SizedBox(height: 24),
                          const Text(
                            'For detailed per-component changes or corrections, contact HR.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
    );
  }

  Widget _card({
    required String title,
    required List<List<String>> rows,
    List<String>? bottomRow,
    List<List<String>>? extraRows,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 12),
          ...rows.map((r) => _row(r[0], r[1])),
          if (bottomRow != null) ...[
            const Divider(height: 20),
            _row(bottomRow[0], bottomRow[1], bold: true),
          ],
          if (extraRows != null) ...extraRows.map((r) => _row(r[0], r[1])),
        ],
      ),
    );
  }

  Widget _row(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              k,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
            Text(
              v,
              style: TextStyle(
                fontSize: bold ? 15 : 13,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      );
}
