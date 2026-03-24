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
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['gmail'] as String,
      phone: json['phone'] as String?,
      role: json['role'] as String,
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
    );
  }
}
