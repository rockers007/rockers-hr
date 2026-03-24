import 'api_service.dart';

class LeaveService {
  static final ApiService _api = ApiService.instance;

  static Future<List<dynamic>> getEligibleLeaveTypes() async {
    final data = await _api.get('/leave/types/eligible');
    return data as List<dynamic>;
  }

  static Future<Map<String, dynamic>> calculateLeave(Map<String, dynamic> body) async {
    final data = await _api.post('/leave/calculate', body: body);
    return data as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> submitRequest(Map<String, dynamic> body) async {
    final data = await _api.post('/leave/requests', body: body);
    return data as Map<String, dynamic>;
  }

  static Future<List<dynamic>> getRequests({
    String? status,
    int? year,
    int page = 1,
  }) async {
    final queryParts = <String>['page=$page'];
    if (status != null) queryParts.add('status=$status');
    if (year != null) queryParts.add('year=$year');
    final query = queryParts.join('&');

    final data = await _api.get('/leave/requests?$query');
    return data as List<dynamic>;
  }

  static Future<Map<String, dynamic>> getRequestById(String id) async {
    final data = await _api.get('/leave/requests/$id');
    return data as Map<String, dynamic>;
  }

  static Future<void> cancelRequest(String id) async {
    await _api.patch('/leave/requests/$id/cancel');
  }

  static Future<List<dynamic>> getBalances({int? year}) async {
    final path = year != null ? '/leave/balance/$year' : '/leave/balance';
    final data = await _api.get(path);
    return data as List<dynamic>;
  }

  static Future<List<dynamic>> getPendingManagerApprovals() async {
    final data = await _api.get('/manager/approvals/pending');
    return data as List<dynamic>;
  }

  static Future<void> approveL1(String id) async {
    await _api.post('/manager/approvals/$id/approve');
  }

  static Future<void> declineL1(String id, String reason) async {
    await _api.post('/manager/approvals/$id/decline', body: {
      'reason': reason,
    });
  }

  static Future<List<dynamic>> getNotifications({
    bool? unreadOnly,
    int page = 1,
  }) async {
    final queryParts = <String>['page=$page'];
    if (unreadOnly == true) queryParts.add('unreadOnly=true');
    final query = queryParts.join('&');

    final data = await _api.get('/notifications?$query');
    return data as List<dynamic>;
  }

  static Future<void> markNotificationRead(String id) async {
    await _api.patch('/notifications/$id/read');
  }

  static Future<void> markAllNotificationsRead() async {
    await _api.patch('/notifications/read-all');
  }

  static Future<int> getUnreadCount() async {
    final data = await _api.get('/notifications/count');
    if (data is Map<String, dynamic>) {
      return data['unread'] as int;
    }
    return data as int;
  }
}
