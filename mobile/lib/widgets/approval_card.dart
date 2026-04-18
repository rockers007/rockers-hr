import 'package:flutter/material.dart';
import '../config/theme.dart';
import 'avatar_circle.dart';
import 'leave_balance_card.dart' show hexToColor;

class ApprovalCard extends StatelessWidget {
  final String employeeName;
  final String employeeEmail;
  final String leaveTypeLabel;
  final String leaveTypeColor;
  final String startDate;
  final String endDate;
  final double workingDays;
  final String reason;
  final bool sandwichFlag;
  final DateTime slaDeadline;
  final VoidCallback onApprove;
  final VoidCallback onDecline;

  const ApprovalCard({
    super.key,
    required this.employeeName,
    required this.employeeEmail,
    required this.leaveTypeLabel,
    required this.leaveTypeColor,
    required this.startDate,
    required this.endDate,
    required this.workingDays,
    required this.reason,
    required this.sandwichFlag,
    required this.slaDeadline,
    required this.onApprove,
    required this.onDecline,
  });

  String _formatDays(double days) {
    return days == days.roundToDouble()
        ? '${days.toInt()}d'
        : '${days.toStringAsFixed(1)}d';
  }

  /// Returns the SLA remaining text and its color.
  (String, Color) _slaInfo() {
    final remaining = slaDeadline.difference(DateTime.now());

    if (remaining.isNegative) {
      return ('OVERDUE', AppColors.danger);
    }

    final hours = remaining.inHours;
    final minutes = remaining.inMinutes % 60;

    final text = hours > 0 ? '${hours}h ${minutes}m remaining' : '${minutes}m remaining';

    if (remaining.inMinutes < 60) {
      return (text, AppColors.danger);
    } else if (remaining.inMinutes < 120) {
      return (text, AppColors.warning);
    } else {
      return (text, AppColors.success);
    }
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = hexToColor(leaveTypeColor);
    final (slaText, slaColor) = _slaInfo();

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      elevation: 0,
      color: AppColors.cardBg,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Employee info row
            Row(
              children: [
                AvatarCircle(name: employeeName, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        employeeName,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        employeeEmail,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: 12),

            // Leave type + dates
            Row(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: accentColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  leaveTypeLabel,
                  style: TextStyle(
                    color: accentColor,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              startDate == endDate
                  ? '$startDate  ·  ${_formatDays(workingDays)}'
                  : '$startDate - $endDate  ·  ${_formatDays(workingDays)}',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 8),

            // Reason
            Text(
              reason,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 10),

            // Sandwich leave badge
            if (sandwichFlag) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.pendingL1Bg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.warning_amber_rounded,
                        size: 14, color: AppColors.warning),
                    SizedBox(width: 4),
                    Text(
                      'Sandwich Leave',
                      style: TextStyle(
                        color: AppColors.pendingL1Text,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],

            // SLA countdown
            Row(
              children: [
                Icon(Icons.schedule, size: 14, color: slaColor),
                const SizedBox(width: 4),
                Text(
                  slaText,
                  style: TextStyle(
                    color: slaColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: onDecline,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      side: const BorderSide(color: AppColors.danger),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: onApprove,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Approve'),
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
