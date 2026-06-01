import '../models/notification_model.dart';
import '../services/leave_service.dart';

class NotificationsRepository {
  Future<List<AppNotification>> getNotifications() async {
    final raw = await LeaveService.getNotifications();
    return raw
        .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markRead(String id) => LeaveService.markNotificationRead(id);

  Future<void> markAllRead() => LeaveService.markAllNotificationsRead();
}
