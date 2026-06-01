import '../models/leave_models.dart';
import '../services/leave_service.dart';

class ProfileRepository {
  Future<List<LeaveBalance>> getBalances() async {
    final raw = await LeaveService.getBalances();
    return raw
        .map((e) => LeaveBalance.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
