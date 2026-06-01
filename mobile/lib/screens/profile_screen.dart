import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/profile_controller.dart';
import '../models/leave_models.dart';
import '../models/user_model.dart';
import '../repositories/profile_repository.dart';
import '../services/auth_service.dart';
import '../services/logging_service.dart';
import '../widgets/avatar_circle.dart';
import '../widgets/leave_balance_card.dart';
import 'change_password_screen.dart';
import 'edit_profile_screen.dart';

String _formatDate(String? dateStr) {
  if (dateStr == null) return '-';
  final dt = DateTime.tryParse(dateStr);
  if (dt == null) return dateStr;
  return DateFormat('dd MMM yyyy').format(dt);
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ProfileController(ProfileRepository()),
      child: const _ProfileView(),
    );
  }
}

class _ProfileView extends StatefulWidget {
  const _ProfileView();

  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<_ProfileView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ProfileController>().load();
    });
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;
    await context.read<AuthService>().logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().currentUser;

    if (user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final controller = context.watch<ProfileController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(title: const Text('Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            _ProfileHeaderCard(user: user),
            const SizedBox(height: 20),
            _ProfileInfoCard(user: user),
            const SizedBox(height: 24),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Leave Balance',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 12),
            _BalancesSection(status: controller.status, balances: controller.balances),
            const SizedBox(height: 24),
            _ProfileActions(onLogout: _handleLogout),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sub-widgets
// ---------------------------------------------------------------------------

class _ProfileHeaderCard extends StatelessWidget {
  const _ProfileHeaderCard({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          AvatarCircle(name: user.name, photoUrl: user.photoUrl, size: 80),
          const SizedBox(height: 14),
          Text(
            user.name,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            user.email,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              user.role,
              style: const TextStyle(
                color: AppColors.accent,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileInfoCard extends StatelessWidget {
  const _ProfileInfoCard({required this.user});

  final User user;

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
      child: Column(
        children: [
          _InfoTile(icon: Icons.phone_outlined, label: 'Phone', value: user.phone ?? '-'),
          const Divider(height: 20, color: AppColors.border),
          _InfoTile(
            icon: Icons.business_outlined,
            label: 'Department',
            value: user.department?.label ?? '-',
          ),
          const Divider(height: 20, color: AppColors.border),
          _InfoTile(
            icon: Icons.supervisor_account_outlined,
            label: 'Manager',
            value: user.manager?.name ?? '-',
          ),
          if (user.gender != null) ...[
            const Divider(height: 20, color: AppColors.border),
            _InfoTile(
              icon: Icons.person_outline,
              label: 'Gender',
              value: user.gender!.label,
            ),
          ],
          if (user.qualification != null) ...[
            const Divider(height: 20, color: AppColors.border),
            _InfoTile(
              icon: Icons.school_outlined,
              label: 'Qualification',
              value: user.qualification!.label,
            ),
          ],
          const Divider(height: 20, color: AppColors.border),
          _InfoTile(
            icon: Icons.event_outlined,
            label: 'Join Date',
            value: _formatDate(user.joinDate),
          ),
          if (user.confirmationDate != null) ...[
            const Divider(height: 20, color: AppColors.border),
            _InfoTile(
              icon: Icons.event_available_outlined,
              label: 'Confirmation Date',
              value: _formatDate(user.confirmationDate),
            ),
          ],
          const Divider(height: 20, color: AppColors.border),
          _InfoTile(
            icon: Icons.verified_user_outlined,
            label: 'Probation',
            trailing: _ProbationBadge(inProbation: user.isInProbation),
          ),
          if (user.employmentStatus != 'active') ...[
            const Divider(height: 20, color: AppColors.border),
            _InfoTile(
              icon: Icons.work_off_outlined,
              label: 'Status',
              trailing: _StatusBadge(status: user.employmentStatus),
            ),
            if (user.resignationDate != null) ...[
              const Divider(height: 20, color: AppColors.border),
              _InfoTile(
                icon: Icons.exit_to_app_outlined,
                label: 'Resignation Date',
                value: _formatDate(user.resignationDate),
              ),
            ],
            if (user.lastWorkingDay != null) ...[
              const Divider(height: 20, color: AppColors.border),
              _InfoTile(
                icon: Icons.calendar_today_outlined,
                label: 'Last Working Day',
                value: _formatDate(user.lastWorkingDay),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _ProbationBadge extends StatelessWidget {
  const _ProbationBadge({required this.inProbation});

  final bool inProbation;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: inProbation ? AppColors.pendingL1Bg : AppColors.approvedBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        inProbation ? 'In Probation' : 'Confirmed',
        style: TextStyle(
          color: inProbation ? AppColors.pendingL1Text : AppColors.approvedText,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status[0].toUpperCase() + status.substring(1),
        style: const TextStyle(
          color: AppColors.danger,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _BalancesSection extends StatelessWidget {
  const _BalancesSection({required this.status, required this.balances});

  final ProfileStatus status;
  final List<LeaveBalance> balances;

  @override
  Widget build(BuildContext context) {
    return switch (status) {
      ProfileStatus.idle || ProfileStatus.loading => const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: CircularProgressIndicator(),
          ),
        ),
      ProfileStatus.error || ProfileStatus.success when balances.isEmpty =>
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'No leave balances available',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
        ),
      ProfileStatus.success => ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: balances.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final b = balances[i];
            return LeaveBalanceCard(
              label: b.leaveType.label,
              color: b.leaveType.color,
              available: b.availableDays,
              total: b.totalDays,
              pending: b.pendingDays,
            );
          },
        ),
      _ => const SizedBox.shrink(),
    };
  }
}

class _ProfileActions extends StatefulWidget {
  const _ProfileActions({required this.onLogout});

  final VoidCallback onLogout;

  @override
  State<_ProfileActions> createState() => _ProfileActionsState();
}

class _ProfileActionsState extends State<_ProfileActions> {
  Future<void> _openEditProfile() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const EditProfileScreen()),
    );
    if (mounted) {
      try {
        await context.read<AuthService>().fetchUser();
      } catch (e) {
        showLog('ProfileScreen._openEditProfile fetchUser: $e', type: LogType.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ActionButton(
          onPressed: _openEditProfile,
          icon: Icons.edit_outlined,
          label: 'Edit Profile',
          foregroundColor: AppColors.accent,
          borderColor: AppColors.accent,
        ),
        const SizedBox(height: 10),
        _ActionButton(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
          ),
          icon: Icons.lock_outline,
          label: 'Change Password',
          foregroundColor: AppColors.textPrimary,
          borderColor: AppColors.border,
        ),
        const SizedBox(height: 10),
        _ActionButton(
          onPressed: widget.onLogout,
          icon: Icons.logout,
          label: 'Logout',
          foregroundColor: AppColors.danger,
          borderColor: AppColors.danger,
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.onPressed,
    required this.icon,
    required this.label,
    required this.foregroundColor,
    required this.borderColor,
  });

  final VoidCallback onPressed;
  final IconData icon;
  final String label;
  final Color foregroundColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: foregroundColor,
          side: BorderSide(color: borderColor),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.icon,
    required this.label,
    this.value,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String? value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.textSecondary),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
        ),
        trailing ??
            Text(
              value ?? '-',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
      ],
    );
  }
}
