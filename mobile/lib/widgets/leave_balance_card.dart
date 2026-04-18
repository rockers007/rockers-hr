import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Parses a hex color string (e.g. "#3b82f6" or "3b82f6") into a [Color].
Color hexToColor(String hex) {
  hex = hex.replaceFirst('#', '');
  if (hex.length == 6) {
    hex = 'FF$hex';
  }
  return Color(int.parse(hex, radix: 16));
}

class LeaveBalanceCard extends StatelessWidget {
  final String label;
  final String color;
  final double available;
  final double total;
  final double pending;

  const LeaveBalanceCard({
    super.key,
    required this.label,
    required this.color,
    required this.available,
    required this.total,
    required this.pending,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = hexToColor(color);
    final used = total - available;
    final usagePercent = total > 0 ? (used / total).clamp(0.0, 1.0) : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          // Color indicator strip on the left
          Container(
            width: 4,
            height: 100,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                bottomLeft: Radius.circular(12),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Label
                  Text(
                    label,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Available / Total
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        _formatDays(available),
                        style: TextStyle(
                          color: accentColor,
                          fontSize: 28,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '/ ${_formatDays(total)}',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: usagePercent,
                      minHeight: 6,
                      backgroundColor: AppColors.border,
                      valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                    ),
                  ),

                  // Pending indicator
                  if (pending > 0) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${_formatDays(pending)}d pending',
                      style: const TextStyle(
                        color: AppColors.warning,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
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
  }

  /// Formats a day count: shows integer if whole, one decimal otherwise.
  String _formatDays(double days) {
    return days == days.roundToDouble() ? days.toInt().toString() : days.toStringAsFixed(1);
  }
}
