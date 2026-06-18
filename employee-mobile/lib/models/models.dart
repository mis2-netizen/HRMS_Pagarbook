class EmployeeUser {
  final String userId;
  final String employeeId;
  final String name;
  final String email;
  final String role;
  final String companyId;
  final String? branchId;

  EmployeeUser({
    required this.userId,
    required this.employeeId,
    required this.name,
    required this.email,
    required this.role,
    required this.companyId,
    this.branchId,
  });

  factory EmployeeUser.fromJson(Map<String, dynamic> json) {
    return EmployeeUser(
      userId: json['userId'] ?? '',
      employeeId: json['employeeId'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? '',
      companyId: json['companyId'] ?? '',
      branchId: json['branchId'],
    );
  }
}

class AttendanceRecord {
  final String date;
  final String? inTime;
  final String? outTime;
  final double workingHours;
  final String status;
  final int lateMinutes;
  final String? inPhotoUrl;

  AttendanceRecord({
    required this.date,
    this.inTime,
    this.outTime,
    required this.workingHours,
    required this.status,
    required this.lateMinutes,
    this.inPhotoUrl,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      date: json['date'] ?? '',
      inTime: json['inTime'],
      outTime: json['outTime'],
      workingHours: (json['workingHours'] ?? 0.0) as double,
      status: json['status'] ?? 'Absent',
      lateMinutes: json['lateMinutes'] ?? 0,
      inPhotoUrl: json['inPhotoUrl'],
    );
  }
}

class LeaveBalance {
  final String leaveType;
  final double opening;
  final double available;

  LeaveBalance({
    required this.leaveType,
    required this.opening,
    required this.available,
  });

  factory LeaveBalance.fromJson(Map<String, dynamic> json) {
    return LeaveBalance(
      leaveType: json['leaveType'] ?? '',
      opening: (json['opening'] ?? 0.0).toDouble(),
      available: (json['available'] ?? 0.0).toDouble(),
    );
  }
}

class LeaveRequest {
  final String leaveId;
  final String leaveType;
  final String fromDate;
  final String toDate;
  final double totalDays;
  final String status;
  final String reason;
  final String? rejectionReason;

  LeaveRequest({
    required this.leaveId,
    required this.leaveType,
    required this.fromDate,
    required this.toDate,
    required this.totalDays,
    required this.status,
    required this.reason,
    this.rejectionReason,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      leaveId: json['leaveId'] ?? '',
      leaveType: json['leaveType'] ?? '',
      fromDate: json['fromDate'] ?? '',
      toDate: json['toDate'] ?? '',
      totalDays: (json['totalDays'] ?? 0.0).toDouble(),
      status: json['status'] ?? 'Pending',
      reason: json['reason'] ?? '',
      rejectionReason: json['rejectionReason'],
    );
  }
}

class PayrollRecord {
  final String payrollId;
  final int month;
  final int year;
  final double grossSalary;
  final double netSalary;
  final String paymentStatus;

  PayrollRecord({
    required this.payrollId,
    required this.month,
    required this.year,
    required this.grossSalary,
    required this.netSalary,
    required this.paymentStatus,
  });

  factory PayrollRecord.fromJson(Map<String, dynamic> json) {
    return PayrollRecord(
      payrollId: json['payrollId'] ?? '',
      month: json['month'] ?? 0,
      year: json['year'] ?? 0,
      grossSalary: (json['grossSalary'] ?? 0.0).toDouble(),
      netSalary: (json['netSalary'] ?? 0.0).toDouble(),
      paymentStatus: json['paymentStatus'] ?? 'Pending',
    );
  }
}
