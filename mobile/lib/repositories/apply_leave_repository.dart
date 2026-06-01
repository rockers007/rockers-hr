import 'package:flutter/material.dart' show TimeOfDay;
import 'package:intl/intl.dart';

import '../models/leave_models.dart';
import '../services/leave_service.dart';

class ApplyLeaveRepository {
  static final DateFormat _dateFmt = DateFormat('yyyy-MM-dd');

  Future<List<LeaveType>> getEligibleLeaveTypes() async {
    final raw = await LeaveService.getEligibleLeaveTypes();
    return raw
        .map((e) => LeaveType.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<LeaveBalance>> getBalances() async {
    final raw = await LeaveService.getBalances();
    return raw
        .map((e) => LeaveBalance.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<CalculateResult> calculateLeave({
    required String leaveTypeId,
    required String durationTypeId,
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    final result = await LeaveService.calculateLeave({
      'leave_type_id': leaveTypeId,
      'duration_type_id': durationTypeId,
      'start_date': _dateFmt.format(startDate),
      'end_date': _dateFmt.format(endDate),
    });
    return CalculateResult.fromJson(result);
  }

  Future<void> submitRequest({
    required String leaveTypeId,
    required String durationTypeId,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
    DateTime? earlyLeaveDate,
    TimeOfDay? earlyLeaveStartTime,
    TimeOfDay? earlyLeaveEndTime,
  }) async {
    final body = <String, dynamic>{
      'leave_type_id': leaveTypeId,
      'duration_type_id': durationTypeId,
      'start_date': _dateFmt.format(startDate),
      'end_date': _dateFmt.format(endDate),
      'reason': reason,
    };
    if (earlyLeaveDate != null &&
        earlyLeaveStartTime != null &&
        earlyLeaveEndTime != null) {
      body['early_leave_date'] = _dateFmt.format(earlyLeaveDate);
      body['early_leave_start_time'] = _hhmm(earlyLeaveStartTime);
      body['early_leave_end_time'] = _hhmm(earlyLeaveEndTime);
    }
    await LeaveService.submitRequest(body);
  }

  static String _hhmm(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
}
