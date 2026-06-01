import '../models/leave_models.dart';
import '../services/leave_service.dart';

class ApprovalsRepository {
  Future<List<PendingApproval>> getPending() async {
    final raw = await LeaveService.getPendingManagerApprovals();
    return raw
        .map((e) => PendingApproval.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> approve(String id) => LeaveService.approveL1(id);

  Future<void> decline(String id, String reason) =>
      LeaveService.declineL1(id, reason);
}
