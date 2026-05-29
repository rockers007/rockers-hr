import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/master_data_service.dart';

/// Fresh-invite activation. Mirrors the web /complete-profile page
/// (frontend/src/app/complete-profile/page.tsx) — same fields, same
/// endpoint (POST /auth/activate-account), same validation.
///
/// Reached via AuthGate when `auth.needsActivation` is true (the
/// JWT has first_login_required=true AND is_active=false). The
/// admin set department + join_date at invite time; we display
/// them read-only because employees cannot change them.
class CompleteProfileScreen extends StatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  State<CompleteProfileScreen> createState() => _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends State<CompleteProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _newPasswordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  String? _genderId;
  String? _qualificationId;
  DateTime? _dob;
  bool _submitting = false;
  bool _showNew = false;
  bool _showConfirm = false;
  String? _error;

  /// Master data prefetch. AuthGate skips loadAll on the activation
  /// path (the auth JWT is first-login), so we trigger it here so
  /// the gender + qualification dropdowns can populate.
  bool _masterKicked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_masterKicked && mounted) {
        _masterKicked = true;
        context.read<MasterDataService>().loadAll();
      }
    });
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _dobCtrl.dispose();
    _newPasswordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 25),
      // DOB must be strictly past per the web validateDob() — last
      // selectable day is yesterday.
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

  String? _validateRequired(String? v, String label) =>
      (v == null || v.trim().isEmpty) ? '$label is required' : null;

  String? _validatePhone(String? v) {
    final value = (v ?? '').replaceAll(RegExp(r'\s'), '');
    if (value.isEmpty) return 'Phone is required';
    if (!RegExp(r'^(\+?\d{10,15})$').hasMatch(value)) {
      return 'Enter a valid phone number (10+ digits)';
    }
    return null;
  }

  String? _validateNewPassword(String? v) {
    final value = v ?? '';
    if (value.length < 8) return 'At least 8 characters';
    if (!RegExp(r'[A-Za-z]').hasMatch(value)) return 'Must include a letter';
    if (!RegExp(r'\d').hasMatch(value)) return 'Must include a digit';
    return null;
  }

  String? _validateConfirm(String? v) {
    if ((v ?? '').isEmpty) return 'Re-enter the new password';
    if (v != _newPasswordCtrl.text) return 'Passwords do not match';
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_genderId == null) {
      setState(() => _error = 'Gender is required');
      return;
    }
    if (_qualificationId == null) {
      setState(() => _error = 'Qualification is required');
      return;
    }
    if (_dob == null) {
      setState(() => _error = 'Date of birth is required');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AuthService>().activateAccount(
            phone: _phoneCtrl.text,
            dob: _dobCtrl.text,
            genderId: _genderId!,
            qualificationId: _qualificationId!,
            newPassword: _newPasswordCtrl.text,
            confirmPassword: _confirmCtrl.text,
          );
      // AuthGate transitions to MainShell automatically when
      // needsActivation flips false.
    } on ApiException catch (e) {
      if (mounted) {
        setState(
          () => _error = e.message.isNotEmpty
              ? e.message
              : 'Activation failed. Please try again.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Activation failed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final master = context.watch<MasterDataService>();
    final user = auth.currentUser;

    final masterReady =
        master.genders.isNotEmpty && master.qualifications.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Complete Your Profile',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        user?.name.isNotEmpty == true
                            ? 'Welcome ${user!.name}! Fill in your details and '
                                'set a new password.'
                            : 'Welcome aboard! Fill in your details and set '
                                'a new password.',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (user?.email.isNotEmpty == true) ...[
                        const SizedBox(height: 4),
                        Text(
                          'Signed in as ${user!.email}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      if (!masterReady) ...[
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(
                            child: CircularProgressIndicator(),
                          ),
                        ),
                      ] else ...[
                        TextFormField(
                          controller: _phoneCtrl,
                          keyboardType: TextInputType.phone,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Phone *',
                            hintText: '+91 9999988888',
                            prefixIcon: Icon(Icons.phone_outlined, size: 20),
                          ),
                          validator: _validatePhone,
                          enabled: !_submitting,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _dobCtrl,
                          readOnly: true,
                          onTap: _submitting ? null : _pickDob,
                          decoration: const InputDecoration(
                            labelText: 'Date of birth *',
                            hintText: 'YYYY-MM-DD',
                            prefixIcon: Icon(Icons.cake_outlined, size: 20),
                          ),
                          validator: (v) =>
                              _validateRequired(v, 'Date of birth'),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _genderId,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Gender *',
                            prefixIcon: Icon(Icons.person_outline, size: 20),
                          ),
                          items: master.genders
                              .map((g) => DropdownMenuItem<String>(
                                    value: g['id'] as String,
                                    child: Text(g['label'] as String),
                                  ))
                              .toList(),
                          onChanged: _submitting
                              ? null
                              : (v) => setState(() => _genderId = v),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _qualificationId,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Qualification *',
                            prefixIcon: Icon(Icons.school_outlined, size: 20),
                          ),
                          items: master.qualifications
                              .map((q) => DropdownMenuItem<String>(
                                    value: q['id'] as String,
                                    child: Text(q['label'] as String),
                                  ))
                              .toList(),
                          onChanged: _submitting
                              ? null
                              : (v) => setState(() => _qualificationId = v),
                        ),
                        const SizedBox(height: 16),
                        const Divider(height: 1, color: AppColors.border),
                        const SizedBox(height: 12),
                        const Text(
                          'Set a new password',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _newPasswordCtrl,
                          obscureText: !_showNew,
                          textInputAction: TextInputAction.next,
                          decoration: InputDecoration(
                            labelText: 'New password *',
                            prefixIcon: const Icon(Icons.lock_outline, size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _showNew
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 20,
                              ),
                              onPressed: () =>
                                  setState(() => _showNew = !_showNew),
                            ),
                            helperText:
                                'Minimum 8 chars, at least one letter and one digit.',
                            helperMaxLines: 2,
                          ),
                          validator: _validateNewPassword,
                          enabled: !_submitting,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _confirmCtrl,
                          obscureText: !_showConfirm,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) =>
                              _submitting ? null : _submit(),
                          decoration: InputDecoration(
                            labelText: 'Confirm new password *',
                            prefixIcon: const Icon(Icons.lock_outline, size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _showConfirm
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 20,
                              ),
                              onPressed: () => setState(
                                  () => _showConfirm = !_showConfirm),
                            ),
                          ),
                          validator: _validateConfirm,
                          enabled: !_submitting,
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
                          onPressed: _submitting ? null : _submit,
                          style: FilledButton.styleFrom(
                            padding:
                                const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: _submitting
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Activate & Continue',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                        const SizedBox(height: 12),
                        Center(
                          child: TextButton(
                            onPressed: _submitting
                                ? null
                                : () => context.read<AuthService>().logout(),
                            style: TextButton.styleFrom(
                              foregroundColor: AppColors.textSecondary,
                            ),
                            child: const Text(
                              'Sign out',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
