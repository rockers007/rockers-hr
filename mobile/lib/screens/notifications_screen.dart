import 'package:flutter/material.dart';

import '../config/theme.dart';
import '../models/notification_model.dart';
import '../services/api_service.dart';
import '../services/leave_service.dart';
import '../widgets/empty_state.dart';
import 'leave_detail_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isLoading = true;
  List<AppNotification> _notifications = [];

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);

    try {
      final data = await LeaveService.getNotifications();
      if (mounted) {
        setState(() {
          _notifications = data
              .map((e) =>
                  AppNotification.fromJson(e as Map<String, dynamic>))
              .toList();
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
            content: Text('Failed to load notifications: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _markAllRead() async {
    try {
      await LeaveService.markAllNotificationsRead();
      if (mounted) {
        setState(() {
          _notifications = _notifications.map((n) {
            if (!n.isRead) {
              return AppNotification(
                id: n.id,
                title: n.title,
                body: n.body,
                isRead: true,
                leaveRequestId: n.leaveRequestId,
                createdAt: n.createdAt,
              );
            }
            return n;
          }).toList();
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _markRead(int index) async {
    final notif = _notifications[index];
    if (notif.isRead) return;

    try {
      await LeaveService.markNotificationRead(notif.id);
      if (mounted) {
        setState(() {
          _notifications[index] = AppNotification(
            id: notif.id,
            title: notif.title,
            body: notif.body,
            isRead: true,
            leaveRequestId: notif.leaveRequestId,
            createdAt: notif.createdAt,
          );
        });
      }
    } catch (_) {
      // Best-effort
    }
  }

  String _timeAgo(String dateStr) {
    final dt = DateTime.tryParse(dateStr);
    if (dt == null) return '';

    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inDays > 30) {
      final months = (diff.inDays / 30).floor();
      return '${months}mo ago';
    } else if (diff.inDays > 0) {
      return '${diff.inDays}d ago';
    } else if (diff.inHours > 0) {
      return '${diff.inHours}h ago';
    } else if (diff.inMinutes > 0) {
      return '${diff.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _notifications.any((n) => !n.isRead);

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadNotifications,
              child: _notifications.isEmpty
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
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: _notifications.length,
                      separatorBuilder: (_, __) =>
                          const Divider(height: 1, color: AppColors.border),
                      itemBuilder: (context, index) {
                        final notif = _notifications[index];
                        return _NotificationTile(
                          title: notif.title,
                          body: notif.body,
                          timeAgo: _timeAgo(notif.createdAt),
                          isRead: notif.isRead,
                          onTap: () {
                            _markRead(index);
                            if (notif.leaveRequestId != null) {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => LeaveDetailScreen(
                                    requestId: notif.leaveRequestId!,
                                  ),
                                ),
                              );
                            }
                          },
                        );
                      },
                    ),
            ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final String title;
  final String body;
  final String timeAgo;
  final bool isRead;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.title,
    required this.body,
    required this.timeAgo,
    required this.isRead,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
              // Unread dot
              if (!isRead)
                Container(
                  width: 8,
                  height: 8,
                  margin: const EdgeInsets.only(top: 5, right: 10),
                  decoration: const BoxDecoration(
                    color: AppColors.accent,
                    shape: BoxShape.circle,
                  ),
                ),
              if (isRead) const SizedBox(width: 18),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight:
                            isRead ? FontWeight.w500 : FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      timeAgo,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 11,
                      ),
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
