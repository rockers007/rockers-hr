import 'package:flutter/material.dart';

import '../config/theme.dart';
import '../models/leave_models.dart';
import '../services/api_service.dart';
import '../services/leave_service.dart';
import '../widgets/approval_card.dart';
import '../widgets/empty_state.dart';

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  bool _isLoading = true;
  List<Map<String, dynamic>> _pendingApprovals = [];

  @override
  void initState() {
    super.initState();
    _loadApprovals();
  }

  Future<void> _loadApprovals() async {
    setState(() => _isLoading = true);

    try {
      final data = await LeaveService.getPendingManagerApprovals();
      if (mounted) {
        setState(() {
          _pendingApprovals =
              data.map((e) => e as Map<String, dynamic>).toList();
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load approvals: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _handleApprove(String id, int index) async {
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

    if (confirmed != true) return;

    try {
      await LeaveService.approveL1(id);
      if (mounted) {
        setState(() {
          _pendingApprovals.removeAt(index);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave request approved'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Approval failed: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _handleDecline(String id, int index) async {
    final reasonController = TextEditingController();

    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          24,
          20,
          MediaQuery.of(ctx).viewInsets.bottom + 24,
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
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      final text = reasonController.text.trim();
                      if (text.isNotEmpty) {
                        Navigator.pop(ctx, text);
                      }
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
      ),
    );

    reasonController.dispose();

    if (reason == null || reason.isEmpty) return;

    try {
      await LeaveService.declineL1(id, reason);
      if (mounted) {
        setState(() {
          _pendingApprovals.removeAt(index);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave request declined'),
            backgroundColor: AppColors.warning,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Decline failed: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Approvals'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadApprovals,
              child: _pendingApprovals.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 80),
                        EmptyStateWidget(
                          icon: Icons.check_circle_outline,
                          title: "You're all caught up!",
                          description:
                              'No pending leave requests to review.',
                        ),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      itemCount: _pendingApprovals.length,
                      itemBuilder: (context, index) {
                        final item = _pendingApprovals[index];
                        final id = item['id'] as String;

                        // Parse employee info
                        final employee =
                            item['employee'] as Map<String, dynamic>? ?? {};
                        final employeeName =
                            employee['name'] as String? ?? 'Unknown';
                        final employeeEmail =
                            employee['email'] as String? ??
                                employee['gmail'] as String? ??
                                '';

                        // Parse leave type
                        final leaveType =
                            item['leave_type'] as Map<String, dynamic>? ?? {};
                        final leaveTypeLabel =
                            leaveType['label'] as String? ?? '';
                        final leaveTypeColor =
                            leaveType['color'] as String? ?? '#3b82f6';

                        // Parse dates
                        final startDate =
                            item['start_date'] as String? ?? '';
                        final endDate = item['end_date'] as String? ?? '';
                        final workingDays =
                            (item['working_days'] as num?)?.toDouble() ?? 0;
                        final reason = item['reason'] as String? ?? '';
                        final sandwichFlag =
                            item['sandwich_flag'] as bool? ?? false;

                        // Parse SLA deadline
                        final slaStr = item['sla_deadline'] as String?;
                        final slaDeadline = slaStr != null
                            ? DateTime.tryParse(slaStr) ??
                                DateTime.now().add(const Duration(hours: 5))
                            : DateTime.now().add(const Duration(hours: 5));

                        return ApprovalCard(
                          employeeName: employeeName,
                          employeeEmail: employeeEmail,
                          leaveTypeLabel: leaveTypeLabel,
                          leaveTypeColor: leaveTypeColor,
                          startDate: startDate,
                          endDate: endDate,
                          workingDays: workingDays,
                          reason: reason,
                          sandwichFlag: sandwichFlag,
                          slaDeadline: slaDeadline,
                          onApprove: () => _handleApprove(id, index),
                          onDecline: () => _handleDecline(id, index),
                        );
                      },
                    ),
            ),
    );
  }
}
