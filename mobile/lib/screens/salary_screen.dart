import 'package:flutter/material.dart';

import '../config/theme.dart';
import '../models/payroll_models.dart';
import '../services/payroll_service.dart';

/// Mirrors the web app's /payroll/salary view: per-component Earnings
/// and Deductions tables (driven by the backend's
/// SalaryService.previewComputation) plus an employee-only Summary
/// that shows just the Estimated Net Payable. The four-row admin
/// summary (Sal-for-Calc, Net Payable, CTC, CTC as per IT) is HR
/// internal — collapsing it on the employee view keeps the focus on
/// the number that matters to the employee.
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
                        children: _buildBody(_salary!),
                      ),
                    ),
    );
  }

  List<Widget> _buildBody(PayrollSalary salary) {
    final preview = salary.computedPreview;

    // Structure card — basic fields HR captures but the engine doesn't
    // necessarily render in earnings/deductions (e.g. PF flag for
    // visibility, raw incentive value).
    final widgets = <Widget>[
      _structureCard(salary),
      const SizedBox(height: 12),
    ];

    if (preview == null) {
      widgets.add(const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Text(
          'Salary breakdown not available — please contact HR.',
          style: TextStyle(color: AppColors.textSecondary),
          textAlign: TextAlign.center,
        ),
      ));
    } else if (preview.hasComponentRows) {
      // Preferred path: full component-level breakdown matching the
      // web /payroll/salary layout.
      widgets.addAll([
        _section(
          title: 'Earnings',
          rows: preview.earnings,
          totalLabel: 'Total Earnings',
          totalAmount: preview.totalEarnings,
        ),
        const SizedBox(height: 12),
        _section(
          title: 'Deductions',
          rows: preview.deductions,
          emptyMessage:
              'No deductions for the current configuration.',
          totalLabel: 'Total Deductions',
          totalAmount: preview.totalDeductions,
        ),
        const SizedBox(height: 12),
        // Employee summary — only Estimated Net Payable. Sal-for-Calc
        // / CTC / CTC-as-per-IT are HR-internal and intentionally
        // hidden on the employee view (see web SalaryBreakdownTable
        // summaryLevel="employee").
        _summaryCard(preview),
      ]);
    } else {
      // Older backend that doesn't emit earnings/deductions arrays —
      // fall back to a flat summary so we don't black out the screen.
      widgets.addAll([
        _legacyFlatPreview(preview),
      ]);
    }

    widgets.addAll([
      const SizedBox(height: 24),
      const Text(
        'For detailed per-component changes or corrections, contact HR.',
        style: TextStyle(
          fontSize: 12,
          color: AppColors.textSecondary,
        ),
      ),
    ]);
    return widgets;
  }

  Widget _structureCard(PayrollSalary s) => _shellCard(
        title: 'Structure',
        children: [
          _kv('Gross', formatInr(s.gross)),
          _kv('Incentive / Fix Variable', formatInr(s.incentive)),
          _kv('PF Applicable', s.pfApplicable ? 'Yes' : 'No'),
          _kv('ESIC Applicable', s.esicApplicable ? 'Yes' : 'No'),
          _kv('Monthly TDS', formatInr(s.tds)),
          _kv('Loan EMI', formatInr(s.loanEmi)),
        ],
      );

  Widget _section({
    required String title,
    required List<BreakdownRow> rows,
    required String totalLabel,
    required String totalAmount,
    String? emptyMessage,
  }) =>
      _shellCard(
        title: title,
        children: [
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                emptyMessage ?? 'No rows.',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
            )
          else
            ...rows.map(_componentRow),
          const Divider(height: 20),
          _kv(totalLabel, formatInr(totalAmount), bold: true),
        ],
      );

  Widget _summaryCard(ComputedPreview preview) => _shellCard(
        title: 'Summary',
        children: [
          // Highlight band identical in spirit to the web's
          // bg-[#f0f9ff] highlight on the Estimated Net Payable row.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.accent.withOpacity(0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Estimated Net Payable',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  formatInr(preview.estimatedNetPayable),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      );

  Widget _legacyFlatPreview(ComputedPreview preview) => _shellCard(
        title: 'This Month (0 LWP, 0 OT)',
        children: [
          _kv('Total Earnings', formatInr(preview.totalEarnings)),
          _kv('Total Deductions', formatInr(preview.totalDeductions)),
          const Divider(height: 20),
          _kv('Estimated Net Payable',
              formatInr(preview.estimatedNetPayable),
              bold: true),
        ],
      );

  // -------------------- shared bits --------------------

  Widget _shellCard({
    required String title,
    required List<Widget> children,
  }) =>
      Container(
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
            ...children,
          ],
        ),
      );

  Widget _componentRow(BreakdownRow r) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      r.label,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (r.isPfBase) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.accent.withOpacity(0.10),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'PF base',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accent,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              formatInr(r.amount),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
      );

  Widget _kv(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              k,
              style: TextStyle(
                fontSize: bold ? 14 : 13,
                color: bold
                    ? AppColors.textPrimary
                    : AppColors.textSecondary,
                fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
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
