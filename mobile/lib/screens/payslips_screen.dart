import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/payslips_controller.dart';
import '../models/payroll_models.dart';
import '../repositories/payroll_repository.dart';

class PayslipsScreen extends StatelessWidget {
  const PayslipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => PayslipsController(PayrollRepository()),
      child: const _PayslipsView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _PayslipsView extends StatefulWidget {
  const _PayslipsView();

  @override
  State<_PayslipsView> createState() => _PayslipsViewState();
}

class _PayslipsViewState extends State<_PayslipsView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<PayslipsController>().load(),
    );
  }

  Future<void> _download(
      PayslipsController controller, PayslipRow row) async {
    final data = await controller.getDownload(row.year, row.month);
    if (!mounted) return;

    if (data == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Payslip is not yet generated. Contact HR if this persists.',
          ),
        ),
      );
      return;
    }

    final url = data['signed_url']?.toString();
    if (url == null || url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No download URL returned.')),
      );
      return;
    }

    await Clipboard.setData(ClipboardData(text: url));
    if (!mounted) return;

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Download URL copied'),
        content: Text(
          'Password: ${data['password_hint'] ?? 'DOB in DDMM'}\n\n'
          'Signed URL has been copied to clipboard — paste into a browser to download the PDF.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<PayslipsController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('My Payslips'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: controller.load,
        child: switch (controller.status) {
          PayslipsStatus.idle ||
          PayslipsStatus.loading =>
            const Center(child: CircularProgressIndicator()),
          PayslipsStatus.error => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  controller.error ?? '',
                  style: const TextStyle(color: AppColors.declinedText),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          PayslipsStatus.success when controller.rows.isEmpty =>
            ListView(
              children: const [
                SizedBox(height: 120),
                Icon(Icons.inbox_outlined,
                    size: 48, color: AppColors.textSecondary),
                SizedBox(height: 8),
                Center(
                  child: Text(
                    'No payslips released yet.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          PayslipsStatus.success => ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: controller.rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _PayslipCard(
                row: controller.rows[i],
                onDownload: () => _download(controller, controller.rows[i]),
              ),
            ),
        },
      ),
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _PayslipCard extends StatelessWidget {
  const _PayslipCard({required this.row, required this.onDownload});

  final PayslipRow row;
  final VoidCallback onDownload;

  @override
  Widget build(BuildContext context) {
    final month = DateFormat('MMMM').format(DateTime(0, row.month));

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$month ${row.year}',
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 15),
              ),
              Text(
                formatInr(row.netPayable),
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 15),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Earnings ${formatInr(row.totalEarnings)}',
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
              ),
              Text(
                'Deductions ${formatInr(row.totalDeductions)}',
                style: const TextStyle(
                    fontSize: 12, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: onDownload,
            icon: const Icon(Icons.download_outlined, size: 18),
            label: const Text('Download'),
          ),
        ],
      ),
    );
  }
}
