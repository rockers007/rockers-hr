import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/leave_detail_controller.dart';
import '../models/leave_models.dart';
import '../repositories/leave_detail_repository.dart';
import '../widgets/leave_balance_card.dart' show hexToColor;
import '../widgets/status_badge.dart';

class LeaveDetailScreen extends StatelessWidget {
  const LeaveDetailScreen({super.key, required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => LeaveDetailController(LeaveDetailRepository(), requestId),
      child: const _LeaveDetailView(),
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

String _formatDateTime(String? dateStr) {
  if (dateStr == null) return '';
  final dt = DateTime.tryParse(dateStr);
  if (dt == null) return dateStr;
  return DateFormat('dd MMM yyyy, HH:mm').format(dt);
}

String _formatDays(double days) =>
    days == days.roundToDouble() ? '${days.toInt()}' : days.toStringAsFixed(1);

(IconData, Color, Color) _approvalStepVisuals(LeaveApproval approval) =>
    switch (approval.action) {
      'APPROVED' => (Icons.check, AppColors.approvedText, AppColors.approvedBg),
      'DECLINED' => (Icons.close, AppColors.declinedText, AppColors.declinedBg),
      'ESCALATED' => (
          Icons.arrow_upward,
          AppColors.escalatedText,
          AppColors.escalatedBg
        ),
      _ => (Icons.schedule, AppColors.pendingL1Text, AppColors.pendingL1Bg),
    };

String _approvalStatusText(LeaveApproval approval) =>
    switch (approval.action) {
      'APPROVED' => 'Approved',
      'DECLINED' => 'Declined',
      'ESCALATED' => 'Escalated',
      _ => 'Pending',
    };

// ── View ───────────────────────────────────────────────────────────────────

class _LeaveDetailView extends StatefulWidget {
  const _LeaveDetailView();

  @override
  State<_LeaveDetailView> createState() => _LeaveDetailViewState();
}

class _LeaveDetailViewState extends State<_LeaveDetailView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<LeaveDetailController>().load(),
    );
  }

  Future<void> _handleCancel(LeaveDetailController controller) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Leave Request'),
        content: const Text(
          'Are you sure you want to cancel this leave request? Your balance will be restored.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Request'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            child: const Text('Cancel Request'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final ok = await controller.cancel();
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Leave request cancelled successfully'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.error ?? 'Cancellation failed'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<LeaveDetailController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(title: const Text('Leave Details')),
      body: switch (controller.status) {
        LeaveDetailStatus.idle ||
        LeaveDetailStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        LeaveDetailStatus.error => Center(
            child: Text(
              controller.error ?? 'Failed to load',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        LeaveDetailStatus.success when controller.request == null =>
          const Center(
            child: Text(
              'Request not found',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
        LeaveDetailStatus.success => SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _LeaveDetailCard(request: controller.request!),
                const SizedBox(height: 20),
                if (controller.request!.sandwichFlag) ...[
                  const _SandwichBanner(),
                  const SizedBox(height: 20),
                ],
                const Text(
                  'Approval Timeline',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                _ApprovalTimeline(
                    approvals: controller.request!.approvals),
                const SizedBox(height: 24),
                if (controller.request!.canCancel)
                  _CancelButton(
                    cancelling: controller.cancelling,
                    onCancel: () => _handleCancel(controller),
                  ),
              ],
            ),
          ),
      },
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _LeaveDetailCard extends StatelessWidget {
  const _LeaveDetailCard({required this.request});

  final LeaveRequest request;

  @override
  Widget build(BuildContext context) {
    final accentColor = hexToColor(request.leaveType.color);

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(height: 6, color: accentColor),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        request.leaveType.label,
                        style: TextStyle(
                          color: accentColor,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    StatusBadge(status: request.status),
                  ],
                ),
                const SizedBox(height: 16),
                _DetailRow(
                  icon: Icons.calendar_today_outlined,
                  label: 'Dates',
                  value: request.startDate == request.endDate
                      ? request.startDate
                      : '${request.startDate} - ${request.endDate}',
                ),
                const SizedBox(height: 10),
                _DetailRow(
                  icon: Icons.schedule_outlined,
                  label: 'Duration',
                  value:
                      '${request.durationType.label} - ${_formatDays(request.workingDays)} '
                      'working day${request.workingDays != 1 ? 's' : ''}',
                ),
                const SizedBox(height: 10),
                _DetailRow(
                  icon: Icons.notes_outlined,
                  label: 'Reason',
                  value: request.reason,
                ),
                if (request.submittedByAdmin != null) ...[
                  const SizedBox(height: 10),
                  _DetailRow(
                    icon: Icons.admin_panel_settings_outlined,
                    label: 'Submitted by',
                    value: request.submittedByAdmin!.name,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SandwichBanner extends StatelessWidget {
  const _SandwichBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.pendingL1Bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: const Row(
        children: [
          Icon(Icons.warning_amber_rounded,
              size: 20, color: AppColors.warning),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'This is a sandwich leave. Weekend / holiday days between leave dates are counted as leave days.',
              style: TextStyle(
                  color: AppColors.pendingL1Text, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _ApprovalTimeline extends StatelessWidget {
  const _ApprovalTimeline({required this.approvals});

  final List<LeaveApproval> approvals;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: approvals.isEmpty
          ? const Text(
              'No approval steps recorded yet.',
              style:
                  TextStyle(color: AppColors.textSecondary, fontSize: 13),
            )
          : Column(
              children: List.generate(approvals.length, (index) {
                final approval = approvals[index];
                final isLast = index == approvals.length - 1;
                final (icon, iconColor, bgColor) =
                    _approvalStepVisuals(approval);

                return IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: bgColor,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(icon, size: 16, color: iconColor),
                          ),
                          if (!isLast)
                            Expanded(
                              child: Container(
                                  width: 2, color: AppColors.border),
                            ),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Padding(
                          padding:
                              EdgeInsets.only(bottom: isLast ? 0 : 20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Level ${approval.level} - ${approval.approver.name}',
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _approvalStatusText(approval),
                                style: TextStyle(
                                  color: iconColor,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if (approval.actionedAt != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  _formatDateTime(approval.actionedAt),
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                              if (approval.reason != null &&
                                  approval.reason!.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  '"${approval.reason}"',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12,
                                    fontStyle: FontStyle.italic,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
    );
  }
}

class _CancelButton extends StatelessWidget {
  const _CancelButton({
    required this.cancelling,
    required this.onCancel,
  });

  final bool cancelling;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: cancelling ? null : onCancel,
        icon: cancelling
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.cancel_outlined, size: 20),
        label: Text(cancelling ? 'Cancelling...' : 'Cancel This Request'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.danger,
          side: const BorderSide(color: AppColors.danger),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
