import 'package:flutter/material.dart';

import '../config/theme.dart';
import '../models/payroll_models.dart';

/// Top-level presenter for the salary breakdown body.
/// Renders structure card → component sections (or legacy flat preview)
/// → summary → footer note.
class SalaryBreakdownView extends StatelessWidget {
  const SalaryBreakdownView({super.key, required this.salary});

  final PayrollSalary salary;

  @override
  Widget build(BuildContext context) {
    final preview = salary.computedPreview;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SalaryStructureCard(salary: salary),
        const SizedBox(height: 12),
        if (preview == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text(
              'Salary breakdown not available — please contact HR.',
              style: TextStyle(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          )
        else if (preview.hasComponentRows) ...[
          _SectionCard(
            title: 'Earnings',
            rows: preview.earnings,
            totalLabel: 'Total Earnings',
            totalAmount: preview.totalEarnings,
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: 'Deductions',
            rows: preview.deductions,
            emptyMessage: 'No deductions for the current configuration.',
            totalLabel: 'Total Deductions',
            totalAmount: preview.totalDeductions,
          ),
          const SizedBox(height: 12),
          _SummaryCard(preview: preview),
        ] else
          _LegacyFlatPreview(preview: preview),
        const SizedBox(height: 24),
        const Text(
          'For detailed per-component changes or corrections, contact HR.',
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Section cards
// ---------------------------------------------------------------------------

class _SalaryStructureCard extends StatelessWidget {
  const _SalaryStructureCard({required this.salary});

  final PayrollSalary salary;

  @override
  Widget build(BuildContext context) {
    return _ShellCard(
      title: 'Structure',
      children: [
        _KvRow(k: 'Gross', v: formatInr(salary.gross)),
        _KvRow(k: 'Incentive / Fix Variable', v: formatInr(salary.incentive)),
        _KvRow(k: 'PF Applicable', v: salary.pfApplicable ? 'Yes' : 'No'),
        _KvRow(k: 'ESIC Applicable', v: salary.esicApplicable ? 'Yes' : 'No'),
        _KvRow(k: 'Monthly TDS', v: formatInr(salary.tds)),
        _KvRow(k: 'Loan EMI', v: formatInr(salary.loanEmi)),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.rows,
    required this.totalLabel,
    required this.totalAmount,
    this.emptyMessage,
  });

  final String title;
  final List<BreakdownRow> rows;
  final String totalLabel;
  final String totalAmount;
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    return _ShellCard(
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
          ...rows.map((r) => _ComponentRow(row: r)),
        const Divider(height: 20),
        _KvRow(k: totalLabel, v: formatInr(totalAmount), bold: true),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.preview});

  final ComputedPreview preview;

  @override
  Widget build(BuildContext context) {
    return _ShellCard(
      title: 'Summary',
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.accent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Estimated Net Payable',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
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
  }
}

class _LegacyFlatPreview extends StatelessWidget {
  const _LegacyFlatPreview({required this.preview});

  final ComputedPreview preview;

  @override
  Widget build(BuildContext context) {
    return _ShellCard(
      title: 'This Month (0 LWP, 0 OT)',
      children: [
        _KvRow(k: 'Total Earnings', v: formatInr(preview.totalEarnings)),
        _KvRow(k: 'Total Deductions', v: formatInr(preview.totalDeductions)),
        const Divider(height: 20),
        _KvRow(
          k: 'Estimated Net Payable',
          v: formatInr(preview.estimatedNetPayable),
          bold: true,
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

class _ShellCard extends StatelessWidget {
  const _ShellCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
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
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _ComponentRow extends StatelessWidget {
  const _ComponentRow({required this.row});

  final BreakdownRow row;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    row.label,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (row.isPfBase) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.10),
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
            formatInr(row.amount),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}

class _KvRow extends StatelessWidget {
  const _KvRow({required this.k, required this.v, this.bold = false});

  final String k;
  final String v;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            k,
            style: TextStyle(
              fontSize: bold ? 14 : 13,
              color: bold ? AppColors.textPrimary : AppColors.textSecondary,
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
}
