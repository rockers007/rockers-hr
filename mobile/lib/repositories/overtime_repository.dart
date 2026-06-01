import '../services/overtime_service.dart';

class OvertimeRepository {
  final _svc = OvertimeService();

  Future<List<OvertimeRequest>> getRequests() => _svc.getMyOvertime();

  Future<OvertimeSummary> getSummary() => _svc.getMySummary();

  Future<void> apply({
    required String date,
    required String startTime,
    required String endTime,
    required String reason,
  }) =>
      _svc.apply(
        date: date,
        startTime: startTime,
        endTime: endTime,
        reason: reason,
      );

  Future<void> cancel(String id) => _svc.cancel(id);
}
