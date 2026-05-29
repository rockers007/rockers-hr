import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/master_data_service.dart';

/// Lightweight Flutter equivalent of the PersonalSection in the web
/// /profile page. Lets the employee edit the fields the backend
/// accepts via PATCH /users/me:
///   - phone, dob
///   - gender_id, qualification_id, marital_status_id
///   - current_address, permanent_address
///   - emergency_phone
///   - pf_uan_no, esic_no
///
/// Read-only fields (department, join_date, email, emp_number) are
/// admin-controlled and surfaced for context but not editable —
/// same UX contract as the web.
///
/// Master data dropdowns (gender, qualification) come from
/// MasterDataService. Marital status is fetched on demand from
/// /master/marital_statuses because the global MasterDataService
/// doesn't track it (yet).
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _emergencyCtrl = TextEditingController();
  final _currentAddressCtrl = TextEditingController();
  final _permanentAddressCtrl = TextEditingController();
  final _pfUanCtrl = TextEditingController();
  final _esicCtrl = TextEditingController();

  String? _genderId;
  String? _qualificationId;
  String? _maritalStatusId;
  DateTime? _dob;

  List<Map<String, dynamic>> _maritalStatuses = const [];

  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _dobCtrl.dispose();
    _emergencyCtrl.dispose();
    _currentAddressCtrl.dispose();
    _permanentAddressCtrl.dispose();
    _pfUanCtrl.dispose();
    _esicCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      // Pull the full /users/me payload — Provider's User model is
      // intentionally lean and doesn't carry marital status or the
      // address/statutory bag.
      final me = await ApiService.instance.get('/users/me')
          as Map<String, dynamic>;
      _phoneCtrl.text = (me['phone'] as String?) ?? '';
      _dobCtrl.text = (me['dob'] as String?) ?? '';
      if ((me['dob'] as String?) != null) {
        _dob = DateTime.tryParse(me['dob']);
      }
      _emergencyCtrl.text = (me['emergency_phone'] as String?) ?? '';
      _currentAddressCtrl.text = (me['current_address'] as String?) ?? '';
      _permanentAddressCtrl.text = (me['permanent_address'] as String?) ?? '';
      _pfUanCtrl.text = (me['pf_uan_no'] as String?) ?? '';
      _esicCtrl.text = (me['esic_no'] as String?) ?? '';
      _genderId = (me['gender'] as Map<String, dynamic>?)?['id'] as String?;
      _qualificationId =
          (me['qualification'] as Map<String, dynamic>?)?['id'] as String?;
      _maritalStatusId = me['marital_status_id'] as String?;

      // Best-effort marital status fetch. If it fails the dropdown
      // just won't appear — the save still works without changing it.
      try {
        final data = await ApiService.instance.get('/master/marital_statuses');
        if (data is List) {
          _maritalStatuses = data.cast<Map<String, dynamic>>();
        }
      } catch (_) {
        _maritalStatuses = const [];
      }
    } catch (e) {
      _error = 'Failed to load profile: $e';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 25),
      firstDate: DateTime(1900),
      lastDate: now.subtract(const Duration(days: 1)),
    );
    if (picked != null) {
      setState(() {
        _dob = picked;
        _dobCtrl.text =
            '${picked.year.toString().padLeft(4, '0')}-'
            '${picked.month.toString().padLeft(2, '0')}-'
            '${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  String? _validatePhone(String? v) {
    final value = (v ?? '').replaceAll(RegExp(r'\s'), '');
    if (value.isEmpty) return null; // optional in PATCH
    if (!RegExp(r'^(\+?\d{10,15})$').hasMatch(value)) {
      return 'Enter a valid phone number (10+ digits)';
    }
    return null;
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      // Build a sparse patch — only include non-empty / non-null
      // values so we don't accidentally NULL out fields the backend
      // doesn't allow as null. Mirrors the web PersonalSection's
      // PATCH shape.
      final patch = <String, dynamic>{
        if (_phoneCtrl.text.trim().isNotEmpty) 'phone': _phoneCtrl.text.trim(),
        if (_dobCtrl.text.isNotEmpty) 'dob': _dobCtrl.text,
        if (_genderId != null) 'gender_id': _genderId,
        if (_qualificationId != null) 'qualification_id': _qualificationId,
        if (_maritalStatusId != null) 'marital_status_id': _maritalStatusId,
        if (_currentAddressCtrl.text.trim().isNotEmpty)
          'current_address': _currentAddressCtrl.text.trim(),
        if (_permanentAddressCtrl.text.trim().isNotEmpty)
          'permanent_address': _permanentAddressCtrl.text.trim(),
        if (_emergencyCtrl.text.trim().isNotEmpty)
          'emergency_phone': _emergencyCtrl.text.trim(),
        if (_pfUanCtrl.text.trim().isNotEmpty)
          'pf_uan_no': _pfUanCtrl.text.trim(),
        if (_esicCtrl.text.trim().isNotEmpty) 'esic_no': _esicCtrl.text.trim(),
      };
      await context.read<AuthService>().updateProfile(patch);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated.')),
      );
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message.isNotEmpty
            ? e.message
            : 'Failed to save profile. Please try again.');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Failed to save profile: $e');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final master = context.watch<MasterDataService>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Edit Profile'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _sectionCard(
                        title: 'Contact',
                        children: [
                          TextFormField(
                            controller: _phoneCtrl,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'Phone',
                              prefixIcon: Icon(Icons.phone_outlined),
                            ),
                            validator: _validatePhone,
                            enabled: !_saving,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _emergencyCtrl,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              labelText: 'Emergency phone',
                              prefixIcon: Icon(Icons.contact_phone_outlined),
                            ),
                            validator: _validatePhone,
                            enabled: !_saving,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _sectionCard(
                        title: 'Personal',
                        children: [
                          TextFormField(
                            controller: _dobCtrl,
                            readOnly: true,
                            onTap: _saving ? null : _pickDob,
                            decoration: const InputDecoration(
                              labelText: 'Date of birth',
                              prefixIcon: Icon(Icons.cake_outlined),
                            ),
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            initialValue: _genderId,
                            isExpanded: true,
                            decoration: const InputDecoration(
                              labelText: 'Gender',
                              prefixIcon: Icon(Icons.person_outline),
                            ),
                            items: master.genders
                                .map((g) => DropdownMenuItem<String>(
                                      value: g['id'] as String,
                                      child: Text(g['label'] as String),
                                    ))
                                .toList(),
                            onChanged: _saving
                                ? null
                                : (v) => setState(() => _genderId = v),
                          ),
                          const SizedBox(height: 12),
                          DropdownButtonFormField<String>(
                            initialValue: _qualificationId,
                            isExpanded: true,
                            decoration: const InputDecoration(
                              labelText: 'Qualification',
                              prefixIcon: Icon(Icons.school_outlined),
                            ),
                            items: master.qualifications
                                .map((q) => DropdownMenuItem<String>(
                                      value: q['id'] as String,
                                      child: Text(q['label'] as String),
                                    ))
                                .toList(),
                            onChanged: _saving
                                ? null
                                : (v) => setState(() => _qualificationId = v),
                          ),
                          if (_maritalStatuses.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String>(
                              initialValue: _maritalStatusId,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Marital status',
                                prefixIcon:
                                    Icon(Icons.family_restroom_outlined),
                              ),
                              items: _maritalStatuses
                                  .map((m) => DropdownMenuItem<String>(
                                        value: m['id'] as String,
                                        child: Text(m['label'] as String),
                                      ))
                                  .toList(),
                              onChanged: _saving
                                  ? null
                                  : (v) =>
                                      setState(() => _maritalStatusId = v),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 12),
                      _sectionCard(
                        title: 'Address',
                        children: [
                          TextFormField(
                            controller: _currentAddressCtrl,
                            minLines: 2,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              labelText: 'Current address',
                              prefixIcon: Icon(Icons.home_outlined),
                            ),
                            enabled: !_saving,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _permanentAddressCtrl,
                            minLines: 2,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              labelText: 'Permanent address',
                              prefixIcon: Icon(Icons.location_on_outlined),
                            ),
                            enabled: !_saving,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _sectionCard(
                        title: 'Statutory IDs',
                        children: [
                          TextFormField(
                            controller: _pfUanCtrl,
                            decoration: const InputDecoration(
                              labelText: 'PF / UAN number',
                              prefixIcon: Icon(Icons.badge_outlined),
                            ),
                            enabled: !_saving,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _esicCtrl,
                            decoration: const InputDecoration(
                              labelText: 'ESIC number',
                              prefixIcon: Icon(Icons.medical_information_outlined),
                            ),
                            enabled: !_saving,
                          ),
                        ],
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.declinedBg,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              color: AppColors.declinedText,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _saving ? null : _save,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _saving
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Save changes',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _sectionCard({
    required String title,
    required List<Widget> children,
  }) =>
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      );
}
