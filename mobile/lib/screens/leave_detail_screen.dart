import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/theme.dart';
import '../models/leave_models.dart';
import '../services/api_service.dart';
import '../services/leave_service.dart';
import '../widgets/leave_balance_card.dart' show hexToColor;
import '../widgets/status_badge.dart';

class LeaveDetailScreen extends StatefulWidget {
  final String requestId;

  const LeaveDetailScreen({super.key, required this.requestId});

  @override
  State<LeaveDetailScreen> createState() => _LeaveDetailScreenState();
}

class _LeaveDetailScreenState extends State<LeaveDetailScreen> {
  bool _isLoading = true;
  LeaveRequest? _request;
  bool _isCancelling = false;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    setState(() => _isLoading = true);

    try {
      final data = await LeaveService.getRequestById(widget.requestId);
      if (mounted) {
        setState(() {
          _request = LeaveRequest.fromJson(data);
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
            content: Text('Failed to load details: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _handleCancel() async {
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

    if (confirmed != true) return;

    setState(() => _isCancelling = true);

    try {
      await LeaveService.cancelRequest(widget.requestId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave request cancelled successfully'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _isCancelling = false);
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
        setState(() => _isCancelling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cancellation failed: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String _formatDateTime(String? dateStr) {
    if (dateStr == null) return '';
    final dt = DateTime.tryParse(dateStr);
    if (dt == null) return dateStr;
    return DateFormat('dd MMM yyyy, HH:mm').format(dt);
  }

  String _formatDays(double days) {
    return days == days.roundToDouble()
        ? '${days.toInt()}'
        : days.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Leave Details'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _request == null
              ? const Center(
                  child: Text(
                    'Request not found',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                )
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final req = _request!;
    final accentColor = hexToColor(req.leaveType.color);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Color bar + type + status
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                // Color bar at top
                Container(
                  height: 6,
                  color: accentColor,
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Leave type and status
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              req.leaveType.label,
                              style: TextStyle(
                                color: accentColor,
                                fontSize: 20,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          StatusBadge(status: req.status),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Details grid
                      _DetailRow(
                        icon: Icons.calendar_today_outlined,
                        label: 'Dates',
                        value: req.startDate == req.endDate
                            ? req.startDate
                            : '${req.startDate} - ${req.endDate}',
                      ),
                      const SizedBox(height: 10),
                      _DetailRow(
                        icon: Icons.schedule_outlined,
                        label: 'Duration',
                        value:
                            '${req.durationType.label} - ${_formatDays(req.workingDays)} working day${req.workingDays != 1 ? 's' : ''}',
                      ),
                      const SizedBox(height: 10),
                      _DetailRow(
                        icon: Icons.notes_outlined,
                        label: 'Reason',
                        value: req.reason,
                      ),
                      if (req.submittedByAdmin != null) ...[
                        const SizedBox(height: 10),
                        _DetailRow(
                          icon: Icons.admin_panel_settings_outlined,
                          label: 'Submitted by',
                          value: req.submittedByAdmin!.name,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Sandwich leave banner
          if (req.sandwichFlag) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.pendingL1Bg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.warning.withOpacity(0.3)),
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
                        color: AppColors.pendingL1Text,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Approval timeline
          const Text(
            'Approval Timeline',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          _buildApprovalTimeline(req.approvals),
          const SizedBox(height: 24),

          // Cancel button
          if (req.canCancel) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _isCancelling ? null : _handleCancel,
                icon: _isCancelling
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cancel_outlined, size: 20),
                label: Text(_isCancelling
                    ? 'Cancelling...'
                    : 'Cancel This Request'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: AppColors.danger),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildApprovalTimeline(List<LeaveApproval> approvals) {
    if (approvals.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: const Text(
          'No approval steps recorded yet.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: List.generate(approvals.length, (index) {
          final approval = approvals[index];
          final isLast = index == approvals.length - 1;

          final (icon, iconColor, bgColor) = _approvalStepVisuals(approval);

          return IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Timeline indicator
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
                          width: 2,
                          color: AppColors.border,
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),

                // Content
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
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

  (IconData, Color, Color) _approvalStepVisuals(LeaveApproval approval) {
    switch (approval.action) {
      case 'APPROVED':
        return (Icons.check, AppColors.approvedText, AppColors.approvedBg);
      case 'DECLINED':
        return (Icons.close, AppColors.declinedText, AppColors.declinedBg);
      case 'ESCALATED':
        return (Icons.arrow_upward, AppColors.escalatedText, AppColors.escalatedBg);
      default:
        // Pending
        return (Icons.schedule, AppColors.pendingL1Text, AppColors.pendingL1Bg);
    }
  }

  String _approvalStatusText(LeaveApproval approval) {
    switch (approval.action) {
      case 'APPROVED':
        return 'Approved';
      case 'DECLINED':
        return 'Declined';
      case 'ESCALATED':
        return 'Escalated';
      default:
        return 'Pending';
    }
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

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
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
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
