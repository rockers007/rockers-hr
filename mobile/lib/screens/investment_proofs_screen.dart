import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/investment_proofs_controller.dart';
import '../models/payroll_models.dart';
import '../repositories/investment_proofs_repository.dart';
import '../services/logging_service.dart';

class InvestmentProofsScreen extends StatelessWidget {
  const InvestmentProofsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => InvestmentProofsController(InvestmentProofsRepository()),
      child: const _InvestmentProofsView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _InvestmentProofsView extends StatefulWidget {
  const _InvestmentProofsView();

  @override
  State<_InvestmentProofsView> createState() => _InvestmentProofsViewState();
}

class _InvestmentProofsViewState extends State<_InvestmentProofsView> {
  late TextEditingController _fyCtrl;

  @override
  void initState() {
    super.initState();
    final controller = context.read<InvestmentProofsController>();
    _fyCtrl = TextEditingController(text: controller.fy);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => controller.load(),
    );
  }

  @override
  void dispose() {
    _fyCtrl.dispose();
    super.dispose();
  }

  void _applyFy(InvestmentProofsController controller) {
    controller.setFy(_fyCtrl.text.trim());
  }

  Future<void> _confirmDelete(
      InvestmentProofsController controller, InvestmentProof proof) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove proof?'),
        content:
            Text('Remove "${proof.category}" (${proof.financialYear})?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final success = await controller.delete(proof);
    if (!mounted) return;
    if (!success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to delete proof.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<InvestmentProofsController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Investment Proofs'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: Column(
        children: [
          _FySelector(
            fyCtrl: _fyCtrl,
            onApply: () => _applyFy(controller),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Uploads are done from the web portal. Past proofs can be viewed and removed here.',
              style: TextStyle(
                  fontSize: 11, color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: RefreshIndicator(
              onRefresh: controller.load,
              child: _buildBody(controller),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(InvestmentProofsController controller) {
    return switch (controller.status) {
      InvestmentProofsStatus.idle ||
      InvestmentProofsStatus.loading =>
        const Center(child: CircularProgressIndicator()),
      InvestmentProofsStatus.error => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              controller.error ?? 'Failed to load',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.declinedText),
            ),
          ),
        ),
      InvestmentProofsStatus.success => controller.rows.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 80),
                Center(
                  child: Text(
                    'No proofs uploaded for ${controller.fy}.',
                    style:
                        const TextStyle(color: AppColors.textSecondary),
                  ),
                ),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: controller.rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) => _ProofRow(
                proof: controller.rows[i],
                onDelete: () =>
                    _confirmDelete(controller, controller.rows[i]),
              ),
            ),
    };
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _FySelector extends StatelessWidget {
  const _FySelector({required this.fyCtrl, required this.onApply});

  final TextEditingController fyCtrl;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: fyCtrl,
              decoration: const InputDecoration(
                labelText: 'Financial Year',
                hintText: 'e.g. 2025-2026',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => onApply(),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: onApply,
            child: const Text('Load'),
          ),
        ],
      ),
    );
  }
}

class _ProofRow extends StatelessWidget {
  const _ProofRow({required this.proof, required this.onDelete});

  final InvestmentProof proof;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    String uploaded = '—';
    try {
      uploaded =
          DateFormat('dd MMM yyyy').format(DateTime.parse(proof.uploadedAt));
    } catch (e) {
      showLog('InvestmentProofsScreen._ProofRow date parse: $e', type: LogType.error);
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      proof.category,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                    if (proof.amount != null &&
                        proof.amount!.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Text(
                        formatInr(proof.amount),
                        style: const TextStyle(fontSize: 13),
                      ),
                    ],
                  ],
                ),
                if (proof.description != null &&
                    proof.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      proof.description!,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Uploaded $uploaded',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppColors.danger),
            onPressed: onDelete,
          ),
        ],
      ),
    );
  }
}
