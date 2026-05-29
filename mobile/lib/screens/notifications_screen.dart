import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/notifications_controller.dart';
import '../models/notification_model.dart';
import '../repositories/notifications_repository.dart';
import '../services/logging_service.dart';
import '../widgets/empty_state.dart';
import 'leave_detail_screen.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => NotificationsController(NotificationsRepository()),
      child: const _NotificationsView(),
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

String _timeAgo(String dateStr) {
  final dt = DateTime.tryParse(dateStr);
  if (dt == null) return '';
  final diff = DateTime.now().difference(dt);
  if (diff.inDays > 30) return '${(diff.inDays / 30).floor()}mo ago';
  if (diff.inDays > 0) return '${diff.inDays}d ago';
  if (diff.inHours > 0) return '${diff.inHours}h ago';
  if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
  return 'Just now';
}

// ── View ───────────────────────────────────────────────────────────────────

class _NotificationsView extends StatefulWidget {
  const _NotificationsView();

  @override
  State<_NotificationsView> createState() => _NotificationsViewState();
}

class _NotificationsViewState extends State<_NotificationsView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<NotificationsController>().load(),
    );
  }

  Future<void> _markAllRead(NotificationsController controller) async {
    try {
      await controller.markAllRead();
    } catch (e) {
      showLog('NotificationsScreen._markAllRead: $e', type: LogType.error);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<NotificationsController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (controller.hasUnread)
            TextButton(
              onPressed: () => _markAllRead(controller),
              child: const Text(
                'Mark all read',
                style: TextStyle(
                  color: AppColors.accent,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      body: switch (controller.status) {
        NotificationsStatus.idle ||
        NotificationsStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        NotificationsStatus.error => Center(
            child: Text(
              controller.error ?? 'Something went wrong',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        NotificationsStatus.success => RefreshIndicator(
            onRefresh: controller.load,
            child: controller.notifications.isEmpty
                ? ListView(
                    children: const [
                      SizedBox(height: 80),
                      EmptyStateWidget(
                        icon: Icons.notifications_none,
                        title: 'No notifications',
                        description:
                            'You will be notified about your leave requests here.',
                      ),
                    ],
                  )
                : _NotificationList(controller: controller),
          ),
      },
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _NotificationList extends StatelessWidget {
  const _NotificationList({required this.controller});

  final NotificationsController controller;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: controller.notifications.length,
      separatorBuilder: (_, __) =>
          const Divider(height: 1, color: AppColors.border),
      itemBuilder: (context, index) {
        final notif = controller.notifications[index];
        return _NotificationTile(
          notification: notif,
          onTap: () {
            controller.markRead(index);
            if (notif.leaveRequestId != null) {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) =>
                      LeaveDetailScreen(requestId: notif.leaveRequestId!),
                ),
              );
            }
          },
        );
      },
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isRead = notification.isRead;

    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          border: isRead
              ? null
              : const Border(
                  left: BorderSide(color: AppColors.accent, width: 3),
                ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isRead)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 5, right: 10),
                  decoration: const BoxDecoration(
                    color: AppColors.accent,
                    shape: BoxShape.circle,
                  ),
                )
              else
                const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight:
                            isRead ? FontWeight.w500 : FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      notification.body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 13),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _timeAgo(notification.createdAt),
                      style: const TextStyle(
                          color: AppColors.textSecondary, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
