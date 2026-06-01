import 'package:flutter/foundation.dart';

import '../models/notification_model.dart';
import '../repositories/notifications_repository.dart';
import '../services/api_service.dart';
import '../services/logging_service.dart';

enum NotificationsStatus { idle, loading, success, error }

class NotificationsController extends ChangeNotifier {
  NotificationsController(this._repo);

  final NotificationsRepository _repo;

  NotificationsStatus _status = NotificationsStatus.idle;
  NotificationsStatus get status => _status;

  String? _error;
  String? get error => _error;

  List<AppNotification> _notifications = [];
  List<AppNotification> get notifications => List.unmodifiable(_notifications);

  bool get hasUnread => _notifications.any((n) => !n.isRead);

  Future<void> load() async {
    _status = NotificationsStatus.loading;
    notifyListeners();
    try {
      _notifications = await _repo.getNotifications();
      _status = NotificationsStatus.success;
    } on ApiException catch (e) {
      _error = e.message;
      _status = NotificationsStatus.error;
      showLog('NotificationsController.load: ${e.message}',
          type: LogType.error);
    } catch (e) {
      _error = 'Failed to load notifications: $e';
      _status = NotificationsStatus.error;
      showLog('NotificationsController.load: $e', type: LogType.error);
    }
    notifyListeners();
  }

  Future<void> markAllRead() async {
    try {
      await _repo.markAllRead();
      _notifications =
          _notifications.map((n) => n.isRead ? n : n.copyWith(isRead: true)).toList();
      notifyListeners();
    } on ApiException catch (e) {
      showLog('NotificationsController.markAllRead: ${e.message}',
          type: LogType.error);
      rethrow;
    }
  }

  // Best-effort — swallows errors; optimistically flips the read flag.
  Future<void> markRead(int index) async {
    final notif = _notifications[index];
    if (notif.isRead) return;
    try {
      await _repo.markRead(notif.id);
      _notifications = List.of(_notifications)
        ..[index] = notif.copyWith(isRead: true);
      notifyListeners();
    } catch (_) {
      // Best-effort — do not surface errors for silent read marks.
    }
  }
}
