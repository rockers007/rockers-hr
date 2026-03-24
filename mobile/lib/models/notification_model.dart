class AppNotification {
  final String id;
  final String title;
  final String body;
  final bool isRead;
  final String? leaveRequestId;
  final String createdAt;

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.isRead,
    this.leaveRequestId,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      title: json['rendered_title'] as String,
      body: json['rendered_body'] as String,
      isRead: json['is_read'] as bool? ?? false,
      leaveRequestId: json['leave_request_id'] as String?,
      createdAt: json['created_at'] as String,
    );
  }
}
