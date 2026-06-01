import 'api_service.dart';

class OvertimeRequest {
  final String id;
  final String date;
  final String startTime;
  final String endTime;
  final double hours;
  final String reason;
  final String status;
  final String paymentStatus;
  final String? adminRemarks;
  final String? reviewedByName;
  final String? reviewedAt;
  final String createdAt;

  OvertimeRequest({
    required this.id,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.hours,
    required this.reason,
    required this.status,
    required this.paymentStatus,
    this.adminRemarks,
    this.reviewedByName,
    this.reviewedAt,
    required this.createdAt,
  });

  factory OvertimeRequest.fromJson(Map<String, dynamic> json) {
    return OvertimeRequest(
      id: json['id'] ?? '',
      date: json['date'] ?? '',
      startTime: json['start_time'] ?? '',
      endTime: json['end_time'] ?? '',
      hours: (json['hours'] is String)
          ? double.tryParse(json['hours']) ?? 0
          : (json['hours'] as num?)?.toDouble() ?? 0,
      reason: json['reason'] ?? '',
      status: json['status'] ?? 'pending',
      paymentStatus: json['payment_status'] ?? 'unpaid',
      adminRemarks: json['admin_remarks'],
      reviewedByName: json['reviewed_by'] is Map
          ? json['reviewed_by']['name']
          : null,
      reviewedAt: json['reviewed_at'],
      createdAt: json['created_at'] ?? '',
    );
  }
}

class OvertimeSummary {
  final int year;
  final double totalApprovedHours;
  final double totalPaidHours;

  OvertimeSummary({
    required this.year,
    required this.totalApprovedHours,
    required this.totalPaidHours,
  });

  factory OvertimeSummary.fromJson(Map<String, dynamic> json) {
    double parseDouble(dynamic v) {
      if (v == null) return 0.0;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v) ?? 0.0;
      return 0.0;
    }
    return OvertimeSummary(
      year: json['year'] ?? DateTime.now().year,
      totalApprovedHours: parseDouble(json['total_approved_hours']),
      totalPaidHours: parseDouble(json['total_paid_hours']),
    );
  }
}

class OvertimeService {
  final _api = ApiService.instance;

  Future<List<OvertimeRequest>> getMyOvertime({String? status}) async {
    final path = status != null
        ? '/overtime/my?status=$status'
        : '/overtime/my';
    final data = await _api.get(path);
    if (data is List) {
      return data.map((e) => OvertimeRequest.fromJson(e)).toList();
    }
    return [];
  }

  Future<OvertimeSummary> getMySummary({int? year}) async {
    final y = year ?? DateTime.now().year;
    final data = await _api.get('/overtime/my/summary?year=$y');
    return OvertimeSummary.fromJson(data);
  }

  Future<OvertimeRequest> apply({
    required String date,
    required String startTime,
    required String endTime,
    required String reason,
  }) async {
    final data = await _api.post('/overtime', body: {
      'date': date,
      'start_time': startTime,
      'end_time': endTime,
      'reason': reason,
    });
    return OvertimeRequest.fromJson(data);
  }

  Future<void> cancel(String id) async {
    await _api.delete('/overtime/$id');
  }
}
