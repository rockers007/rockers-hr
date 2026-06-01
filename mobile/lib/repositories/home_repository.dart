import '../models/leave_models.dart';
import '../services/leave_service.dart';

class HomeRepository {
  Future<List<LeaveBalance>> getBalances() async {
    final raw = await LeaveService.getBalances();
    return raw
        .map((e) => LeaveBalance.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<LeaveRequest>> getActiveRequests() async {
    final raw =
        await LeaveService.getRequests(status: 'PENDING_L1,PENDING_L2');
    return raw
        .map((e) => LeaveRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<int> getUnreadCount() => LeaveService.getUnreadCount();
}
