class Department {
  final String id;
  final String label;

  Department({
    required this.id,
    required this.label,
  });

  factory Department.fromJson(Map<String, dynamic> json) {
    return Department(
      id: json['id'] as String,
      label: json['label'] as String,
    );
  }
}

class Manager {
  final String id;
  final String name;

  Manager({
    required this.id,
    required this.name,
  });

  factory Manager.fromJson(Map<String, dynamic> json) {
    return Manager(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }
}

class Qualification {
  final String id;
  final String label;

  Qualification({required this.id, required this.label});

  factory Qualification.fromJson(Map<String, dynamic> json) {
    return Qualification(
      id: json['id'] as String,
      label: json['label'] as String,
    );
  }
}

class Gender {
  final String id;
  final String label;

  Gender({required this.id, required this.label});

  factory Gender.fromJson(Map<String, dynamic> json) {
    return Gender(
      id: json['id'] as String,
      label: json['label'] as String,
    );
  }
}

class ProfileDetail {
  final String? phone;
  final String? dob;
  final String? emergencyPhone;
  final String? currentAddress;
  final String? permanentAddress;
  final String? pfUanNo;
  final String? esicNo;
  final String? genderId;
  final String? qualificationId;
  final String? maritalStatusId;

  ProfileDetail({
    this.phone,
    this.dob,
    this.emergencyPhone,
    this.currentAddress,
    this.permanentAddress,
    this.pfUanNo,
    this.esicNo,
    this.genderId,
    this.qualificationId,
    this.maritalStatusId,
  });

  factory ProfileDetail.fromJson(Map<String, dynamic> json) {
    return ProfileDetail(
      phone: json['phone'] as String?,
      dob: json['dob'] as String?,
      emergencyPhone: json['emergency_phone'] as String?,
      currentAddress: json['current_address'] as String?,
      permanentAddress: json['permanent_address'] as String?,
      pfUanNo: json['pf_uan_no'] as String?,
      esicNo: json['esic_no'] as String?,
      genderId:
          (json['gender'] as Map<String, dynamic>?)?['id'] as String?,
      qualificationId:
          (json['qualification'] as Map<String, dynamic>?)?['id'] as String?,
      maritalStatusId: json['marital_status_id'] as String?,
    );
  }
}

class User {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final Department? department;
  final String? photoUrl;
  final Manager? manager;
  final String? joinDate;
  final String? confirmationDate;
  final bool isInProbation;
  final bool isManager;
  final Gender? gender;
  final Qualification? qualification;
  final String? resignationDate;
  final String? lastWorkingDay;
  final String employmentStatus;

  User({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    this.department,
    this.photoUrl,
    this.manager,
    this.joinDate,
    this.confirmationDate,
    required this.isInProbation,
    required this.isManager,
    this.gender,
    this.qualification,
    this.resignationDate,
    this.lastWorkingDay,
    this.employmentStatus = 'active',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['gmail'] as String? ?? json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      role: json['role'] as String? ?? 'employee',
      department: json['department'] != null
          ? Department.fromJson(json['department'] as Map<String, dynamic>)
          : null,
      photoUrl: json['photo_url'] as String?,
      manager: json['manager'] != null
          ? Manager.fromJson(json['manager'] as Map<String, dynamic>)
          : null,
      joinDate: json['join_date'] as String?,
      confirmationDate: json['confirmation_date'] as String?,
      isInProbation: json['is_in_probation'] as bool? ?? false,
      isManager: json['is_manager'] as bool? ?? false,
      gender: json['gender'] != null
          ? Gender.fromJson(json['gender'] as Map<String, dynamic>)
          : null,
      qualification: json['qualification'] != null
          ? Qualification.fromJson(json['qualification'] as Map<String, dynamic>)
          : null,
      resignationDate: json['resignation_date'] as String?,
      lastWorkingDay: json['last_working_day'] as String?,
      employmentStatus: json['employment_status'] as String? ?? 'active',
    );
  }
}
