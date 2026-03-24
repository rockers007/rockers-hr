import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../config/theme.dart';
import '../models/leave_models.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/leave_service.dart';
import '../widgets/leave_balance_card.dart';
import '../widgets/leave_request_card.dart';
import '../widgets/empty_state.dart';
import 'notifications_screen.dart';
import 'leave_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  List<LeaveBalance> _balances = [];
  List<LeaveRequest> _activeRequests = [];
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);

    try {
      final results = await Future.wait([
        LeaveService.getBalances(),
        LeaveService.getRequests(status: 'PENDING_L1,PENDING_L2'),
        LeaveService.getUnreadCount(),
      ]);

      if (mounted) {
        setState(() {
          _balances = (results[0] as List<dynamic>)
              .map((e) => LeaveBalance.fromJson(e as Map<String, dynamic>))
              .toList();
          _activeRequests = (results[1] as List<dynamic>)
              .map((e) => LeaveRequest.fromJson(e as Map<String, dynamic>))
              .toList();
          _unreadCount = results[2] as int;
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
            content: Text('Failed to load data: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  String _firstName(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    return parts.isNotEmpty ? parts.first : fullName;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.currentUser;

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    // Header
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Hi, ${_firstName(user?.name ?? '')}',
                                    style: const TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 26,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    DateFormat('EEEE, MMM d').format(DateTime.now()),
                                    style: const TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            // Notification bell
                            IconButton(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const NotificationsScreen(),
                                  ),
                                ).then((_) => _loadData());
                              },
                              icon: Badge(
                                isLabelVisible: _unreadCount > 0,
                                label: Text(
                                  _unreadCount > 99 ? '99+' : '$_unreadCount',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                  ),
                                ),
                                child: const Icon(
                                  Icons.notifications_outlined,
                                  size: 28,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Leave Balances section
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(20, 24, 20, 12),
                        child: Text(
                          'Leave Balance',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),

                    // Horizontal scrollable balance cards
                    SliverToBoxAdapter(
                      child: _balances.isEmpty
                          ? const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 20),
                              child: Text(
                                'No leave balances available',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 14,
                                ),
                              ),
                            )
                          : SizedBox(
                              height: 130,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                padding: const EdgeInsets.symmetric(horizontal: 20),
                                itemCount: _balances.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(width: 12),
                                itemBuilder: (context, index) {
                                  final b = _balances[index];
                                  return SizedBox(
                                    width: 200,
                                    child: LeaveBalanceCard(
                                      label: b.leaveType.label,
                                      color: b.leaveType.color,
                                      available: b.availableDays,
                                      total: b.totalDays,
                                      pending: b.pendingDays,
                                    ),
                                  );
                                },
                              ),
                            ),
                    ),

                    // Apply for Leave button
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                        child: SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              // Navigate to Apply tab (index 1) via MainShell
                              // We use DefaultTabController or simply find the MainShell state
                              // For simplicity, navigate to ApplyLeaveScreen as a push
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const _ApplyLeaveWrapper(),
                                ),
                              ).then((_) => _loadData());
                            },
                            icon: const Icon(Icons.add, size: 20),
                            label: const Text('Apply for Leave'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Active Requests section
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(20, 28, 20, 12),
                        child: Text(
                          'Active Requests',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),

                    // Active requests list
                    if (_activeRequests.isEmpty)
                      const SliverToBoxAdapter(
                        child: EmptyStateWidget(
                          icon: Icons.inbox_outlined,
                          title: 'No active requests',
                          description:
                              'Your pending leave requests will appear here.',
                        ),
                      )
                    else
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) {
                            final req = _activeRequests[index];
                            return LeaveRequestCard(
                              leaveTypeLabel: req.leaveType.label,
                              leaveTypeColor: req.leaveType.color,
                              startDate: req.startDate,
                              endDate: req.endDate,
                              workingDays: req.workingDays,
                              status: req.status,
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => LeaveDetailScreen(
                                      requestId: req.id,
                                    ),
                                  ),
                                ).then((_) => _loadData());
                              },
                            );
                          },
                          childCount: _activeRequests.length,
                        ),
                      ),

                    // Bottom padding
                    const SliverToBoxAdapter(
                      child: SizedBox(height: 24),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Wrapper to push ApplyLeaveScreen as a full-screen route with its own Scaffold
class _ApplyLeaveWrapper extends StatelessWidget {
  const _ApplyLeaveWrapper();

  @override
  Widget build(BuildContext context) {
    return const ApplyLeaveScreen(showBackButton: true);
  }
}
