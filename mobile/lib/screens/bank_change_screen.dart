import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/bank_change_controller.dart';
import '../models/payroll_models.dart';
import '../repositories/bank_change_repository.dart';
import '../services/logging_service.dart';

class BankChangeScreen extends StatelessWidget {
  const BankChangeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => BankChangeController(BankChangeRepository()),
      child: const _BankChangeView(),
    );
  }
}

// ── Main view ──────────────────────────────────────────────────────────────

class _BankChangeView extends StatefulWidget {
  const _BankChangeView();

  @override
  State<_BankChangeView> createState() => _BankChangeViewState();
}

class _BankChangeViewState extends State<_BankChangeView> {
  final _formKey = GlobalKey<FormState>();
  final _bankCtrl = TextEditingController();
  final _accCtrl = TextEditingController();
  final _accConfirmCtrl = TextEditingController();
  final _ifscCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<BankChangeController>().load(),
    );
  }

  @override
  void dispose() {
    _bankCtrl.dispose();
    _accCtrl.dispose();
    _accConfirmCtrl.dispose();
    _ifscCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit(BankChangeController controller) async {
    if (!_formKey.currentState!.validate()) return;
    if (_accCtrl.text.trim() != _accConfirmCtrl.text.trim()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account number confirmation does not match.'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final message = await controller.submit(
      bankName: _bankCtrl.text.trim(),
      accountNo: _accCtrl.text.trim(),
      ifsc: _ifscCtrl.text.trim().toUpperCase(),
    );

    if (!mounted) return;

    if (message != null) {
      _bankCtrl.clear();
      _accCtrl.clear();
      _accConfirmCtrl.clear();
      _ifscCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.actionError ?? 'Submission failed'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      controller.clearActionError();
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<BankChangeController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Bank Details'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: switch (controller.status) {
        BankChangeStatus.idle ||
        BankChangeStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        BankChangeStatus.error => Center(
            child: Text(
              controller.error ?? 'Something went wrong',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        BankChangeStatus.success => RefreshIndicator(
            onRefresh: controller.load,
            child: _buildBody(controller),
          ),
      },
    );
  }

  Widget _buildBody(BankChangeController controller) {
    final firstTime = controller.isFirstTimeEntry;
    final showForm = controller.showForm;
    final hasPending = controller.hasPending;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (!firstTime) ...[
          _CurrentDetailsCard(salary: controller.salary),
          const SizedBox(height: 12),
        ],
        if (firstTime)
          _InfoBanner(
            color: AppColors.accent.withValues(alpha: 0.08),
            message:
                'Add your salary account here. You can fill these in once — '
                'after that, any change requires a bank-change request '
                'that HR will review and approve.',
          ),
        if (!showForm && !hasPending && !firstTime) ...[
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: controller.openForm,
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Request Change'),
            ),
          ),
        ],
        if (hasPending && !firstTime)
          const _InfoBanner(
            color: AppColors.pendingL1Bg,
            message:
                'You already have a pending change request. HR must approve or '
                'reject it before you can submit another.',
            textColor: AppColors.pendingL1Text,
          ),
        if (showForm)
          _BankChangeForm(
            formKey: _formKey,
            bankCtrl: _bankCtrl,
            accCtrl: _accCtrl,
            accConfirmCtrl: _accConfirmCtrl,
            ifscCtrl: _ifscCtrl,
            firstTime: firstTime,
            submitting: controller.submitting,
            onSubmit: () => _submit(controller),
            onCancel: controller.closeForm,
          ),
        if (!firstTime) ...[
          const SizedBox(height: 24),
          _HistoryCard(history: controller.history),
        ],
      ],
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({
    required this.message,
    required this.color,
    this.textColor,
  });

  final String message;
  final Color color;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: TextStyle(fontSize: 13, color: textColor),
      ),
    );
  }
}

class _CurrentDetailsCard extends StatelessWidget {
  const _CurrentDetailsCard({required this.salary});

  final PayrollSalary? salary;

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
          const Text(
            'Current Details',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          ),
          const SizedBox(height: 12),
          _kv('Bank', salary?.bankName ?? '—'),
          _kv('Account No.', salary?.bankAccountNo ?? '—'),
          _kv('IFSC', salary?.bankIfsc ?? '—'),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary)),
            Text(v, style: const TextStyle(fontSize: 13)),
          ],
        ),
      );
}

class _BankChangeForm extends StatelessWidget {
  const _BankChangeForm({
    required this.formKey,
    required this.bankCtrl,
    required this.accCtrl,
    required this.accConfirmCtrl,
    required this.ifscCtrl,
    required this.firstTime,
    required this.submitting,
    required this.onSubmit,
    required this.onCancel,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController bankCtrl;
  final TextEditingController accCtrl;
  final TextEditingController accConfirmCtrl;
  final TextEditingController ifscCtrl;
  final bool firstTime;
  final bool submitting;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final title = firstTime ? 'Bank Details' : 'New Bank Details';
    final submitLabel =
        firstTime ? (submitting ? 'Saving…' : 'Save Bank Details') : (submitting ? 'Submitting…' : 'Submit');

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 12),
            TextFormField(
              controller: bankCtrl,
              decoration: const InputDecoration(labelText: 'Bank Name'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: accCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Account Number',
                hintText: '9–18 digits',
              ),
              validator: (v) =>
                  (v == null || !BankChangeController.digitsRegex.hasMatch(v.trim()))
                      ? 'Must be 9–18 digits'
                      : null,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: accConfirmCtrl,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(labelText: 'Re-enter Account Number'),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: ifscCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'IFSC Code',
                hintText: 'e.g. HDFC0001234',
              ),
              validator: (v) =>
                  (v == null || !BankChangeController.ifscRegex.hasMatch(v.trim().toUpperCase()))
                      ? 'Format: ABCD0123456'
                      : null,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                if (!firstTime) ...[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: submitting ? null : onCancel,
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: FilledButton(
                    onPressed: submitting ? null : onSubmit,
                    child: Text(submitLabel),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.history});

  final List<BankChangeRequest> history;

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
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Request History',
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          ),
          const SizedBox(height: 12),
          if (history.isEmpty)
            const Text(
              'No past requests.',
              style: TextStyle(color: AppColors.textSecondary),
            )
          else
            ...history.map((h) => _HistoryRow(request: h)),
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.request});

  final BankChangeRequest request;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (request.status) {
      'APPROVED' => (AppColors.approvedBg, AppColors.approvedText),
      'REJECTED' => (AppColors.declinedBg, AppColors.declinedText),
      _ => (AppColors.pendingL1Bg, AppColors.pendingL1Text),
    };

    String dateLabel = '—';
    try {
      dateLabel =
          DateFormat('dd MMM yyyy').format(DateTime.parse(request.submittedAt));
    } catch (e) {
      showLog('BankChangeScreen._HistoryRow date parse: $e', type: LogType.error);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${request.newBankName} · ${request.newIfsc}',
                  style: const TextStyle(fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  request.status,
                  style: TextStyle(
                      color: fg, fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            'Submitted $dateLabel',
            style: const TextStyle(
                fontSize: 11, color: AppColors.textSecondary),
          ),
          if (request.rejectionReason != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                request.rejectionReason!,
                style: const TextStyle(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
