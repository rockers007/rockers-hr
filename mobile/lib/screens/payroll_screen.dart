import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/payroll_controller.dart';
import '../models/payroll_models.dart';
import '../repositories/payroll_repository.dart';
import 'bank_change_screen.dart';
import 'investment_proofs_screen.dart';
import 'payslips_screen.dart';
import 'salary_screen.dart';

/// Employee payroll home — mirrors frontend `/payroll` dashboard.
class PayrollScreen extends StatelessWidget {
  const PayrollScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => PayrollController(PayrollRepository()),
      child: const _PayrollView(),
    );
  }
}

class _PayrollView extends StatefulWidget {
  const _PayrollView();

  @override
  State<_PayrollView> createState() => _PayrollViewState();
}

class _PayrollViewState extends State<_PayrollView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<PayrollController>().load(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<PayrollController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('My Payroll'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: switch (controller.status) {
        PayrollStatus.idle ||
        PayrollStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        PayrollStatus.error => RefreshIndicator(
            onRefresh: controller.load,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [_ErrorBanner(message: controller.error!)],
            ),
          ),
        PayrollStatus.success => RefreshIndicator(
            onRefresh: controller.load,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _CurrentMonthCard(preview: controller.preview),
                const SizedBox(height: 12),
                _LastPayslipCard(
                  last: controller.payslips.isNotEmpty
                      ? controller.payslips.first
                      : null,
                ),
                const SizedBox(height: 12),
                _YtdCard(
                    row: controller.ytd.isNotEmpty
                        ? controller.ytd.first
                        : null),
                const SizedBox(height: 24),
                _QuickLink(
                  icon: Icons.receipt_long_outlined,
                  title: 'My Payslips',
                  subtitle: 'Download password-protected PDFs',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const PayslipsScreen()),
                  ),
                ),
                _QuickLink(
                  icon: Icons.pie_chart_outline,
                  title: 'Salary Breakdown',
                  subtitle: 'Current structure and 7-component split',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const SalaryScreen()),
                  ),
                ),
                _QuickLink(
                  icon: Icons.account_balance_outlined,
                  title: 'Bank Details',
                  subtitle: 'View or request a change',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const BankChangeScreen()),
                  ),
                ),
                _QuickLink(
                  icon: Icons.folder_open_outlined,
                  title: 'Investment Proofs',
                  subtitle: 'Tax-saving documents for the FY',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => const InvestmentProofsScreen()),
                  ),
                ),
              ],
            ),
          ),
      },
    );
  }
}

class _CurrentMonthCard extends StatelessWidget {
  final SalaryPreview? preview;
  const _CurrentMonthCard({required this.preview});

  @override
  Widget build(BuildContext context) {
    if (preview == null) {
      return const _Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardTitle('Current Month Preview'),
            SizedBox(height: 4),
            Text(
              'Salary config not yet set.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle('Current Month Preview'),
          const SizedBox(height: 4),
          Text(
            '${preview!.previewMonth} ${preview!.previewYear} — if paid today',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            formatInr(preview!.estimatedNetPayable),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            preview!.note,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _LastPayslipCard extends StatelessWidget {
  final PayslipRow? last;
  const _LastPayslipCard({required this.last});

  @override
  Widget build(BuildContext context) {
    if (last == null) {
      return const _Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardTitle('Last Payslip'),
            SizedBox(height: 8),
            Text(
              'No payslips released yet.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }
    final m = DateFormat('MMMM').format(DateTime(0, last!.month));
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle('Last Payslip'),
          const SizedBox(height: 4),
          Text(
            '$m ${last!.year}',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            formatInr(last!.netPayable),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _YtdCard extends StatelessWidget {
  final YtdRow? row;
  const _YtdCard({required this.row});

  @override
  Widget build(BuildContext context) {
    if (row == null) {
      return const _Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardTitle('YTD Summary'),
            SizedBox(height: 8),
            Text(
              'No YTD data yet — starts after first released payroll.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardTitle('YTD ${row!.financialYear}'),
          const SizedBox(height: 12),
          Text(
            formatInr(row!.ytdNetPayable),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          _KV('Earnings', formatInr(row!.ytdEarnings)),
          _KV('PF contributed', formatInr(row!.ytdEmployeePf)),
          _KV('TDS paid', formatInr(row!.ytdTds)),
          _KV('Months', row!.monthsProcessed),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: child,
      );
}

class _CardTitle extends StatelessWidget {
  final String text;
  const _CardTitle(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.5,
          color: AppColors.textSecondary,
        ),
      );
}

class _KV extends StatelessWidget {
  final String k;
  final String v;
  const _KV(this.k, this.v);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              k,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
            ),
            Text(v, style: const TextStyle(fontSize: 12)),
          ],
        ),
      );
}

class _QuickLink extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _QuickLink({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 8),
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: ListTile(
          leading: Icon(icon, color: AppColors.accent),
          title: Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
          trailing: const Icon(Icons.chevron_right, size: 18),
          onTap: onTap,
        ),
      );
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.declinedBg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          message,
          style: const TextStyle(color: AppColors.declinedText, fontSize: 13),
        ),
      );
}
