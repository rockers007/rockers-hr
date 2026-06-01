import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/approvals_controller.dart';
import '../models/leave_models.dart';
import '../repositories/approvals_repository.dart';
import '../widgets/approval_card.dart';
import '../widgets/empty_state.dart';

class ApprovalsScreen extends StatelessWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ApprovalsController(ApprovalsRepository()),
      child: const _ApprovalsView(),
    );
  }
}

class _ApprovalsView extends StatefulWidget {
  const _ApprovalsView();

  @override
  State<_ApprovalsView> createState() => _ApprovalsViewState();
}

class _ApprovalsViewState extends State<_ApprovalsView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<ApprovalsController>().load(),
    );
  }

  Future<void> _handleApprove(
      ApprovalsController controller, String id, int index) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Approval'),
        content:
            const Text('Are you sure you want to approve this leave request?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.success,
              foregroundColor: Colors.white,
            ),
            child: const Text('Approve'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final ok = await controller.approve(id, index);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Leave request approved'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.actionError ?? 'Approval failed'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      controller.clearActionError();
    }
  }

  Future<void> _handleDecline(
      ApprovalsController controller, String id, int index) async {
    final reasonController = TextEditingController();

    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _DeclineSheet(reasonController: reasonController),
    );

    reasonController.dispose();

    if (reason == null || reason.isEmpty || !mounted) return;

    final ok = await controller.decline(id, index, reason);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Leave request declined'),
          backgroundColor: AppColors.warning,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.actionError ?? 'Decline failed'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      controller.clearActionError();
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<ApprovalsController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(title: const Text('Approvals')),
      body: switch (controller.status) {
        ApprovalsStatus.idle ||
        ApprovalsStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        ApprovalsStatus.error => Center(
            child: Text(
              controller.error ?? 'Something went wrong',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        ApprovalsStatus.success => RefreshIndicator(
            onRefresh: controller.load,
            child: controller.approvals.isEmpty
                ? _emptyState()
                : _approvalsList(controller),
          ),
      },
    );
  }

  Widget _emptyState() {
    return ListView(
      children: const [
        SizedBox(height: 80),
        EmptyStateWidget(
          icon: Icons.check_circle_outline,
          title: "You're all caught up!",
          description: 'No pending leave requests to review.',
        ),
      ],
    );
  }

  Widget _approvalsList(ApprovalsController controller) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 12),
      itemCount: controller.approvals.length,
      itemBuilder: (context, index) {
        final item = controller.approvals[index];
        return _ApprovalItem(
          item: item,
          onApprove: () => _handleApprove(controller, item.id, index),
          onDecline: () => _handleDecline(controller, item.id, index),
        );
      },
    );
  }
}

class _ApprovalItem extends StatelessWidget {
  const _ApprovalItem({
    required this.item,
    required this.onApprove,
    required this.onDecline,
  });

  final PendingApproval item;
  final VoidCallback onApprove;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    return ApprovalCard(
      employeeName: item.employeeName,
      employeeEmail: item.employeeEmail,
      leaveTypeLabel: item.leaveTypeLabel,
      leaveTypeColor: item.leaveTypeColor,
      startDate: item.startDate,
      endDate: item.endDate,
      workingDays: item.workingDays,
      reason: item.reason,
      sandwichFlag: item.sandwichFlag,
      slaDeadline: item.slaDeadline,
      onApprove: onApprove,
      onDecline: onDecline,
    );
  }
}

class _DeclineSheet extends StatelessWidget {
  const _DeclineSheet({required this.reasonController});

  final TextEditingController reasonController;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        24,
        20,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Decline Leave Request',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: reasonController,
            maxLines: 4,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Please provide a reason for declining...',
              hintStyle: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    final text = reasonController.text.trim();
                    if (text.isNotEmpty) Navigator.pop(context, text);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.danger,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Decline'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
