import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/home_controller.dart';
import '../models/leave_models.dart';
import '../repositories/home_repository.dart';
import '../services/auth_service.dart';
import '../widgets/empty_state.dart';
import '../widgets/leave_balance_card.dart';
import '../widgets/leave_request_card.dart';
import 'apply_leave_screen.dart';
import 'leave_detail_screen.dart';
import 'notifications_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => HomeController(HomeRepository()),
      child: const _HomeView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _HomeView extends StatefulWidget {
  const _HomeView();

  @override
  State<_HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<_HomeView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<HomeController>().load(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<HomeController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: controller.load,
          child: switch (controller.status) {
            HomeStatus.idle ||
            HomeStatus.loading =>
              const Center(child: CircularProgressIndicator()),
            HomeStatus.error => ListView(
                children: [
                  const SizedBox(height: 80),
                  Center(
                    child: Text(
                      controller.error ?? 'Something went wrong',
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ),
                ],
              ),
            HomeStatus.success => CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: _HomeHeader(controller: controller)),
                  const SliverToBoxAdapter(child: _SectionTitle('Leave Balance')),
                  SliverToBoxAdapter(child: _BalanceCards(controller: controller)),
                  SliverToBoxAdapter(child: _ApplyButton(controller: controller)),
                  const SliverToBoxAdapter(child: _SectionTitle('Active Requests', topPadding: 28)),
                  _ActiveRequestsList(controller: controller),
                  const SliverToBoxAdapter(child: SizedBox(height: 24)),
                ],
              ),
          },
        ),
      ),
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

String _firstName(String fullName) {
  final parts = fullName.trim().split(RegExp(r'\s+'));
  return parts.isNotEmpty ? parts.first : fullName;
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.controller});

  final HomeController controller;

  @override
  Widget build(BuildContext context) {
    final user = context.select((AuthService a) => a.currentUser);

    return Padding(
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
                      color: AppColors.textSecondary, fontSize: 14),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(
                  builder: (_) => const NotificationsScreen(),
                ))
                .then((_) => controller.load()),
            icon: Badge(
              isLabelVisible: controller.unreadCount > 0,
              label: Text(
                controller.unreadCount > 99
                    ? '99+'
                    : '${controller.unreadCount}',
                style: const TextStyle(color: Colors.white, fontSize: 10),
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
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, {this.topPadding = 24});

  final String title;
  final double topPadding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, topPadding, 20, 12),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _BalanceCards extends StatelessWidget {
  const _BalanceCards({required this.controller});

  final HomeController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.balances.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 20),
        child: Text(
          'No leave balances available',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
      );
    }
    return SizedBox(
      height: 130,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: controller.balances.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final b = controller.balances[index];
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
    );
  }
}

class _ApplyButton extends StatelessWidget {
  const _ApplyButton({required this.controller});

  final HomeController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () => Navigator.of(context)
              .push(MaterialPageRoute(
                builder: (_) =>
                    const ApplyLeaveScreen(showBackButton: true),
              ))
              .then((_) => controller.load()),
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
    );
  }
}

class _ActiveRequestsList extends StatelessWidget {
  const _ActiveRequestsList({required this.controller});

  final HomeController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.activeRequests.isEmpty) {
      return const SliverToBoxAdapter(
        child: EmptyStateWidget(
          icon: Icons.inbox_outlined,
          title: 'No active requests',
          description: 'Your pending leave requests will appear here.',
        ),
      );
    }
    return SliverList(
      delegate: SliverChildBuilderDelegate(
        (context, index) => _ActiveRequestItem(
          request: controller.activeRequests[index],
          onRefresh: controller.load,
        ),
        childCount: controller.activeRequests.length,
      ),
    );
  }
}

class _ActiveRequestItem extends StatelessWidget {
  const _ActiveRequestItem({
    required this.request,
    required this.onRefresh,
  });

  final LeaveRequest request;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return LeaveRequestCard(
      leaveTypeLabel: request.leaveType.label,
      leaveTypeColor: request.leaveType.color,
      startDate: request.startDate,
      endDate: request.endDate,
      workingDays: request.workingDays,
      status: request.status,
      onTap: () => Navigator.of(context)
          .push(MaterialPageRoute(
            builder: (_) => LeaveDetailScreen(requestId: request.id),
          ))
          .then((_) => onRefresh()),
    );
  }
}
