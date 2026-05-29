import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../config/theme.dart';
import '../models/leave_models.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/leave_service.dart';
import '../widgets/avatar_circle.dart';
import '../widgets/leave_balance_card.dart';
import 'change_password_screen.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = true;
  List<LeaveBalance> _balances = [];

  @override
  void initState() {
    super.initState();
    _loadBalances();
  }

  Future<void> _loadBalances() async {
    setState(() => _isLoading = true);

    try {
      final data = await LeaveService.getBalances();
      if (mounted) {
        setState(() {
          _balances = data
              .map((e) => LeaveBalance.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
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

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '-';
    final dt = DateTime.tryParse(dateStr);
    if (dt == null) return dateStr;
    return DateFormat('dd MMM yyyy').format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;

    if (user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Avatar + name + email + role
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  AvatarCircle(
                    name: user.name,
                    photoUrl: user.photoUrl,
                    size: 80,
                  ),
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
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withOpacity(0.1),
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
            ),
            const SizedBox(height: 20),

            // Info tiles
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.cardBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  _InfoTile(
                    icon: Icons.phone_outlined,
                    label: 'Phone',
                    value: user.phone ?? '-',
                  ),
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
                  const Divider(height: 20, color: AppColors.border),
                  if (user.gender != null) ...[
                    _InfoTile(
                      icon: Icons.person_outline,
                      label: 'Gender',
                      value: user.gender!.label,
                    ),
                    const Divider(height: 20, color: AppColors.border),
                  ],
                  if (user.qualification != null) ...[
                    _InfoTile(
                      icon: Icons.school_outlined,
                      label: 'Qualification',
                      value: user.qualification!.label,
                    ),
                    const Divider(height: 20, color: AppColors.border),
                  ],
                  _InfoTile(
                    icon: Icons.event_outlined,
                    label: 'Join Date',
                    value: _formatDate(user.joinDate),
                  ),
                  const Divider(height: 20, color: AppColors.border),
                  if (user.confirmationDate != null) ...[
                    _InfoTile(
                      icon: Icons.event_available_outlined,
                      label: 'Confirmation Date',
                      value: _formatDate(user.confirmationDate),
                    ),
                    const Divider(height: 20, color: AppColors.border),
                  ],
                  _InfoTile(
                    icon: Icons.verified_user_outlined,
                    label: 'Probation',
                    trailing: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: user.isInProbation
                            ? AppColors.pendingL1Bg
                            : AppColors.approvedBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        user.isInProbation ? 'In Probation' : 'Confirmed',
                        style: TextStyle(
                          color: user.isInProbation
                              ? AppColors.pendingL1Text
                              : AppColors.approvedText,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  // Separation details (only show if not active)
                  if (user.employmentStatus != 'active') ...[
                    const Divider(height: 20, color: AppColors.border),
                    _InfoTile(
                      icon: Icons.work_off_outlined,
                      label: 'Status',
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          user.employmentStatus[0].toUpperCase() +
                              user.employmentStatus.substring(1),
                          style: const TextStyle(
                            color: AppColors.danger,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
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
            ),
            const SizedBox(height: 24),

            // Leave Balance section
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
            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_balances.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'No leave balances available',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              )
            else
              ...List.generate(_balances.length, (index) {
                final b = _balances[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: LeaveBalanceCard(
                    label: b.leaveType.label,
                    color: b.leaveType.color,
                    available: b.availableDays,
                    total: b.totalDays,
                    pending: b.pendingDays,
                  ),
                );
              }),
            const SizedBox(height: 24),

            // Account actions — mirrors the action set on the web
            // /profile page (Edit Profile, Change Password, Logout).
            // Family / Documents / Bank sections are intentionally
            // not on mobile yet — those screens use S3 presigned PUT
            // uploads and are best done from the web for now.
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const EditProfileScreen(),
                    ),
                  );
                  // Refresh user on return so the read-only info
                  // tiles at the top reflect the new values.
                  if (mounted) {
                    try {
                      await context.read<AuthService>().fetchUser();
                    } catch (_) {}
                  }
                },
                icon: const Icon(Icons.edit_outlined, size: 20),
                label: const Text('Edit Profile'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.accent,
                  side: const BorderSide(color: AppColors.accent),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ChangePasswordScreen(),
                    ),
                  );
                },
                icon: const Icon(Icons.lock_outline, size: 20),
                label: const Text('Change Password'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.textPrimary,
                  side: const BorderSide(color: AppColors.border),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),

            // Logout button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _handleLogout,
                icon: const Icon(Icons.logout, size: 20),
                label: const Text('Logout'),
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
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? value;
  final Widget? trailing;

  const _InfoTile({
    required this.icon,
    required this.label,
    this.value,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.textSecondary),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
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
