import 'package:flutter/material.dart';
import '../config/theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  static const Map<String, String> _statusLabels = {
    'PENDING_L1': 'Pending L1',
    'PENDING_L2': 'Pending L2',
    'APPROVED': 'Approved',
    'DECLINED': 'Declined',
    'ESCALATED': 'Escalated',
    'CANCELLED': 'Cancelled',
  };

  (Color, Color) _colors() {
    switch (status) {
      case 'PENDING_L1':
        return (AppColors.pendingL1Bg, AppColors.pendingL1Text);
      case 'PENDING_L2':
        return (AppColors.pendingL2Bg, AppColors.pendingL2Text);
      case 'APPROVED':
        return (AppColors.approvedBg, AppColors.approvedText);
      case 'DECLINED':
        return (AppColors.declinedBg, AppColors.declinedText);
      case 'ESCALATED':
        return (AppColors.escalatedBg, AppColors.escalatedText);
      case 'CANCELLED':
        return (AppColors.cancelledBg, AppColors.cancelledText);
      default:
        return (AppColors.cancelledBg, AppColors.cancelledText);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (bgColor, textColor) = _colors();
    final label = _statusLabels[status] ?? status;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
