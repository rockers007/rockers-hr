import '../models/leave_models.dart';
import '../services/leave_service.dart';

class LeaveHistoryRepository {
  Future<List<LeaveRequest>> getRequests({
    String? status,
    required int year,
  }) async {
    final raw = await LeaveService.getRequests(status: status, year: year);
    return raw
        .map((e) => LeaveRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
