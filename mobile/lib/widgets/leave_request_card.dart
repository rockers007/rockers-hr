import 'package:flutter/material.dart';
import '../config/theme.dart';
import 'leave_balance_card.dart' show hexToColor;
import 'status_badge.dart';

class LeaveRequestCard extends StatelessWidget {
  final String leaveTypeLabel;
  final String leaveTypeColor;
  final String startDate;
  final String endDate;
  final double workingDays;
  final String status;
  final VoidCallback? onTap;

  const LeaveRequestCard({
    super.key,
    required this.leaveTypeLabel,
    required this.leaveTypeColor,
    required this.startDate,
    required this.endDate,
    required this.workingDays,
    required this.status,
    this.onTap,
  });

  String _formatDays(double days) {
    return days == days.roundToDouble()
        ? '${days.toInt()}d'
        : '${days.toStringAsFixed(1)}d';
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = hexToColor(leaveTypeColor);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      elevation: 0,
      color: AppColors.cardBg,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: IntrinsicHeight(
          child: Row(
            children: [
              // Colored left border
              Container(
                width: 4,
                color: accentColor,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  child: Row(
                    children: [
                      // Left content
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              leaveTypeLabel,
                              style: TextStyle(
                                color: accentColor,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              startDate == endDate
                                  ? startDate
                                  : '$startDate - $endDate',
                              style: const TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _formatDays(workingDays),
                              style: const TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Status badge on the right
                      StatusBadge(status: status),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
