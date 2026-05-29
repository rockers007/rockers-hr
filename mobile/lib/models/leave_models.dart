class LeaveType {
  final String id;
  final String label;
  final int annualDays;
  final bool probationAllowed;
  final bool docRequired;
  final int? docThresholdDays;
  final String color;
  final int sortOrder;
  final bool isActive;

  LeaveType({
    required this.id,
    required this.label,
    required this.annualDays,
    required this.probationAllowed,
    required this.docRequired,
    this.docThresholdDays,
    required this.color,
    required this.sortOrder,
    required this.isActive,
  });

  factory LeaveType.fromJson(Map<String, dynamic> json) {
    return LeaveType(
      id: json['id'] as String,
      label: json['label'] as String,
      annualDays: json['annual_days'] as int,
      probationAllowed: json['probation_allowed'] as bool? ?? false,
      docRequired: json['doc_required'] as bool? ?? false,
      docThresholdDays: json['doc_threshold_days'] as int?,
      color: json['color'] as String,
      sortOrder: json['sort_order'] as int? ?? 0,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class LeaveDuration {
  final String id;
  final String label;
  final double dayValue;

  LeaveDuration({
    required this.id,
    required this.label,
    required this.dayValue,
  });

  factory LeaveDuration.fromJson(Map<String, dynamic> json) {
    return LeaveDuration(
      id: json['id'] as String,
      label: json['label'] as String,
      dayValue: (json['day_value'] as num).toDouble(),
    );
  }
}

class LeaveTypeRef {
  final String id;
  final String label;
  final String color;

  LeaveTypeRef({
    required this.id,
    required this.label,
    required this.color,
  });

  factory LeaveTypeRef.fromJson(Map<String, dynamic> json) {
    return LeaveTypeRef(
      id: json['id'] as String,
      label: json['label'] as String,
      color: json['color'] as String,
    );
  }
}

class LeaveBalance {
  final LeaveTypeRef leaveType;
  final int year;
  final double totalDays;
  final double usedDays;
  final double pendingDays;
  final double availableDays;

  LeaveBalance({
    required this.leaveType,
    required this.year,
    required this.totalDays,
    required this.usedDays,
    required this.pendingDays,
    required this.availableDays,
  });

  factory LeaveBalance.fromJson(Map<String, dynamic> json) {
    return LeaveBalance(
      leaveType:
          LeaveTypeRef.fromJson(json['leave_type'] as Map<String, dynamic>),
      year: json['year'] as int,
      totalDays: (json['total_days'] as num).toDouble(),
      usedDays: (json['used_days'] as num).toDouble(),
      pendingDays: (json['pending_days'] as num).toDouble(),
      availableDays: (json['available_days'] as num).toDouble(),
    );
  }
}

class LeaveDurationRef {
  final String label;
  final double dayValue;

  LeaveDurationRef({
    required this.label,
    required this.dayValue,
  });

  factory LeaveDurationRef.fromJson(Map<String, dynamic> json) {
    return LeaveDurationRef(
      label: json['label'] as String,
      dayValue: (json['day_value'] as num).toDouble(),
    );
  }
}

class SubmittedByAdmin {
  final String name;

  SubmittedByAdmin({
    required this.name,
  });

  factory SubmittedByAdmin.fromJson(Map<String, dynamic> json) {
    return SubmittedByAdmin(
      name: json['name'] as String,
    );
  }
}

class ApproverRef {
  final String name;

  ApproverRef({
    required this.name,
  });

  factory ApproverRef.fromJson(Map<String, dynamic> json) {
    return ApproverRef(
      name: json['name'] as String,
    );
  }
}

class LeaveApproval {
  final int level;
  final ApproverRef approver;
  final String? action;
  final String? actionedAt;
  final String? reason;
  final String? slaDeadline;

  LeaveApproval({
    required this.level,
    required this.approver,
    this.action,
    this.actionedAt,
    this.reason,
    this.slaDeadline,
  });

  factory LeaveApproval.fromJson(Map<String, dynamic> json) {
    return LeaveApproval(
      level: json['level'] as int,
      approver: ApproverRef.fromJson(json['approver'] as Map<String, dynamic>),
      action: json['action'] as String?,
      actionedAt: json['actioned_at'] as String?,
      reason: json['reason'] as String?,
      slaDeadline: json['sla_deadline'] as String?,
    );
  }
}

class LeaveRequest {
  final String id;
  final LeaveTypeRef leaveType;
  final LeaveDurationRef durationType;
  final String startDate;
  final String endDate;
  final double workingDays;
  final String status;
  final String reason;
  final bool sandwichFlag;
  final SubmittedByAdmin? submittedByAdmin;
  final bool canCancel;
  final List<LeaveApproval> approvals;
  final String createdAt;

  LeaveRequest({
    required this.id,
    required this.leaveType,
    required this.durationType,
    required this.startDate,
    required this.endDate,
    required this.workingDays,
    required this.status,
    required this.reason,
    required this.sandwichFlag,
    this.submittedByAdmin,
    required this.canCancel,
    required this.approvals,
    required this.createdAt,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] as String,
      leaveType:
          LeaveTypeRef.fromJson(json['leave_type'] as Map<String, dynamic>),
      durationType: LeaveDurationRef.fromJson(
          json['duration_type'] as Map<String, dynamic>),
      startDate: json['start_date'] as String,
      endDate: json['end_date'] as String,
      workingDays: (json['working_days'] as num).toDouble(),
      status: json['status'] as String,
      reason: json['reason'] as String,
      sandwichFlag: json['sandwich_flag'] as bool? ?? false,
      submittedByAdmin: json['submitted_by_admin'] != null
          ? SubmittedByAdmin.fromJson(
              json['submitted_by_admin'] as Map<String, dynamic>)
          : null,
      canCancel: json['can_cancel'] as bool? ?? false,
      approvals: (json['approvals'] as List<dynamic>?)
              ?.map((e) =>
                  LeaveApproval.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: json['created_at'] as String,
    );
  }
}

class PendingApproval {
  final String id;
  final String employeeName;
  final String employeeEmail;
  final String leaveTypeLabel;
  final String leaveTypeColor;
  final String startDate;
  final String endDate;
  final double workingDays;
  final String reason;
  final bool sandwichFlag;
  final DateTime slaDeadline;

  PendingApproval({
    required this.id,
    required this.employeeName,
    required this.employeeEmail,
    required this.leaveTypeLabel,
    required this.leaveTypeColor,
    required this.startDate,
    required this.endDate,
    required this.workingDays,
    required this.reason,
    required this.sandwichFlag,
    required this.slaDeadline,
  });

  factory PendingApproval.fromJson(Map<String, dynamic> json) {
    final employee = json['employee'] as Map<String, dynamic>? ?? {};
    final leaveType = json['leave_type'] as Map<String, dynamic>? ?? {};
    final slaStr = json['sla_deadline'] as String?;
    return PendingApproval(
      id: json['id'] as String,
      employeeName: employee['name'] as String? ?? 'Unknown',
      employeeEmail: employee['email'] as String? ??
          employee['gmail'] as String? ??
          '',
      leaveTypeLabel: leaveType['label'] as String? ?? '',
      leaveTypeColor: leaveType['color'] as String? ?? '#3b82f6',
      startDate: json['start_date'] as String? ?? '',
      endDate: json['end_date'] as String? ?? '',
      workingDays: (json['working_days'] as num?)?.toDouble() ?? 0,
      reason: json['reason'] as String? ?? '',
      sandwichFlag: json['sandwich_flag'] as bool? ?? false,
      slaDeadline: slaStr != null
          ? DateTime.tryParse(slaStr) ??
              DateTime.now().add(const Duration(hours: 5))
          : DateTime.now().add(const Duration(hours: 5)),
    );
  }
}

class CalculateResult {
  final double workingDays;
  final double balanceBefore;
  final double balanceAfter;
  final bool sandwichDetected;
  final String? sandwichDetail;
  final bool docRequired;

  CalculateResult({
    required this.workingDays,
    required this.balanceBefore,
    required this.balanceAfter,
    required this.sandwichDetected,
    this.sandwichDetail,
    required this.docRequired,
  });

  factory CalculateResult.fromJson(Map<String, dynamic> json) {
    return CalculateResult(
      workingDays: (json['working_days'] as num).toDouble(),
      balanceBefore: (json['balance_before'] as num).toDouble(),
      balanceAfter: (json['balance_after'] as num).toDouble(),
      sandwichDetected: json['sandwich_detected'] as bool? ?? false,
      sandwichDetail: json['sandwich_detail'] as String?,
      docRequired: json['doc_required'] as bool? ?? false,
    );
  }
}
