import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/complete_profile_controller.dart';
import '../services/auth_service.dart';
import '../services/master_data_service.dart';

class CompleteProfileScreen extends StatelessWidget {
  const CompleteProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (ctx) => CompleteProfileController(ctx.read<AuthService>()),
      child: const _CompleteProfileView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _CompleteProfileView extends StatefulWidget {
  const _CompleteProfileView();

  @override
  State<_CompleteProfileView> createState() => _CompleteProfileViewState();
}

class _CompleteProfileViewState extends State<_CompleteProfileView> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _newPasswordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _showNew = false;
  bool _showConfirm = false;
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

  Future<void> _pickDob(CompleteProfileController controller) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: controller.dob ?? DateTime(now.year - 25),
      firstDate: DateTime(1900),
      // DOB must be strictly past — last selectable day is yesterday.
      lastDate: now.subtract(const Duration(days: 1)),
    );
    if (picked == null) return;
    controller.setDob(picked);
    _dobCtrl.text =
        '${picked.year.toString().padLeft(4, '0')}-'
        '${picked.month.toString().padLeft(2, '0')}-'
        '${picked.day.toString().padLeft(2, '0')}';
  }

  Future<void> _submit(CompleteProfileController controller) async {
    if (!_formKey.currentState!.validate()) return;
    await controller.submit(
      phone: _phoneCtrl.text,
      dobText: _dobCtrl.text,
      newPassword: _newPasswordCtrl.text,
      confirmPassword: _confirmCtrl.text,
    );
    // On success AuthGate transitions automatically; no navigation needed here.
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<CompleteProfileController>();
    final master = context.watch<MasterDataService>();
    final user = context.select((AuthService a) => a.currentUser);
    final masterReady =
        master.genders.isNotEmpty && master.qualifications.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
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
                            ? 'Welcome ${user!.name}! Fill in your details '
                                'and set a new password.'
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
                      if (!masterReady)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else
                        _FormFields(
                          phoneCtrl: _phoneCtrl,
                          dobCtrl: _dobCtrl,
                          newPasswordCtrl: _newPasswordCtrl,
                          confirmCtrl: _confirmCtrl,
                          controller: controller,
                          master: master,
                          showNew: _showNew,
                          showConfirm: _showConfirm,
                          onToggleNew: () =>
                              setState(() => _showNew = !_showNew),
                          onToggleConfirm: () =>
                              setState(() => _showConfirm = !_showConfirm),
                          onPickDob: () => _pickDob(controller),
                          onSubmit: () => _submit(controller),
                        ),
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

// ── Private widgets ────────────────────────────────────────────────────────

class _FormFields extends StatelessWidget {
  const _FormFields({
    required this.phoneCtrl,
    required this.dobCtrl,
    required this.newPasswordCtrl,
    required this.confirmCtrl,
    required this.controller,
    required this.master,
    required this.showNew,
    required this.showConfirm,
    required this.onToggleNew,
    required this.onToggleConfirm,
    required this.onPickDob,
    required this.onSubmit,
  });

  final TextEditingController phoneCtrl;
  final TextEditingController dobCtrl;
  final TextEditingController newPasswordCtrl;
  final TextEditingController confirmCtrl;
  final CompleteProfileController controller;
  final MasterDataService master;
  final bool showNew;
  final bool showConfirm;
  final VoidCallback onToggleNew;
  final VoidCallback onToggleConfirm;
  final VoidCallback onPickDob;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final disabled = controller.submitting;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          controller: phoneCtrl,
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.next,
          enabled: !disabled,
          decoration: const InputDecoration(
            labelText: 'Phone *',
            hintText: '+91 9999988888',
            prefixIcon: Icon(Icons.phone_outlined, size: 20),
          ),
          validator: controller.validatePhone,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: dobCtrl,
          readOnly: true,
          onTap: disabled ? null : onPickDob,
          decoration: const InputDecoration(
            labelText: 'Date of birth *',
            hintText: 'YYYY-MM-DD',
            prefixIcon: Icon(Icons.cake_outlined, size: 20),
          ),
          validator: (v) => controller.validateRequired(v, 'Date of birth'),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: controller.genderId,
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
          onChanged: disabled ? null : controller.setGender,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: controller.qualificationId,
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
          onChanged: disabled ? null : controller.setQualification,
        ),
        const SizedBox(height: 16),
        const Divider(height: 1, color: AppColors.border),
        const SizedBox(height: 12),
        const Text(
          'Set a new password',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: newPasswordCtrl,
          obscureText: !showNew,
          textInputAction: TextInputAction.next,
          enabled: !disabled,
          decoration: InputDecoration(
            labelText: 'New password *',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            suffixIcon: IconButton(
              icon: Icon(
                showNew
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                size: 20,
              ),
              onPressed: onToggleNew,
            ),
            helperText:
                'Minimum 8 chars, at least one letter and one digit.',
            helperMaxLines: 2,
          ),
          validator: controller.validateNewPassword,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: confirmCtrl,
          obscureText: !showConfirm,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => disabled ? null : onSubmit(),
          enabled: !disabled,
          decoration: InputDecoration(
            labelText: 'Confirm new password *',
            prefixIcon: const Icon(Icons.lock_outline, size: 20),
            suffixIcon: IconButton(
              icon: Icon(
                showConfirm
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                size: 20,
              ),
              onPressed: onToggleConfirm,
            ),
          ),
          validator: (v) => controller.validateConfirm(
            v,
            newPassword: newPasswordCtrl.text,
          ),
        ),
        if (controller.error != null) ...[
          const SizedBox(height: 12),
          _ErrorBanner(message: controller.error!),
        ],
        const SizedBox(height: 16),
        FilledButton(
          onPressed: disabled ? null : onSubmit,
          style: FilledButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: disabled
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
                  style:
                      TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: disabled
                ? null
                : () => context.read<AuthService>().logout(),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.textSecondary,
            ),
            child: const Text('Sign out', style: TextStyle(fontSize: 12)),
          ),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.declinedBg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: const TextStyle(color: AppColors.declinedText, fontSize: 13),
      ),
    );
  }
}
