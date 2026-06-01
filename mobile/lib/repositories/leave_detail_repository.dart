import '../models/leave_models.dart';
import '../services/leave_service.dart';

class LeaveDetailRepository {
  Future<LeaveRequest> getById(String id) async {
    final data = await LeaveService.getRequestById(id);
    return LeaveRequest.fromJson(data);
  }

  Future<void> cancel(String id) => LeaveService.cancelRequest(id);
}
