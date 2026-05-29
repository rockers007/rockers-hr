import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/edit_profile_controller.dart';
import '../repositories/edit_profile_repository.dart';
import '../services/auth_service.dart';
import '../services/master_data_service.dart';

class EditProfileScreen extends StatelessWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (ctx) => EditProfileController(
        EditProfileRepository(),
        ctx.read<AuthService>(),
      ),
      child: const _EditProfileView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _EditProfileView extends StatefulWidget {
  const _EditProfileView();

  @override
  State<_EditProfileView> createState() => _EditProfileViewState();
}

class _EditProfileViewState extends State<_EditProfileView> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _emergencyCtrl = TextEditingController();
  final _currentAddressCtrl = TextEditingController();
  final _permanentAddressCtrl = TextEditingController();
  final _pfUanCtrl = TextEditingController();
  final _esicCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = context.read<EditProfileController>();
      await controller.load();
      if (mounted) _populateControllers(controller);
    });
  }

  void _populateControllers(EditProfileController controller) {
    final p = controller.profile;
    if (p == null) return;
    _phoneCtrl.text = p.phone ?? '';
    _dobCtrl.text = p.dob ?? '';
    _emergencyCtrl.text = p.emergencyPhone ?? '';
    _currentAddressCtrl.text = p.currentAddress ?? '';
    _permanentAddressCtrl.text = p.permanentAddress ?? '';
    _pfUanCtrl.text = p.pfUanNo ?? '';
    _esicCtrl.text = p.esicNo ?? '';
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

  Future<void> _pickDob(EditProfileController controller) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: controller.dob ?? DateTime(now.year - 25),
      firstDate: DateTime(1900),
      lastDate: now.subtract(const Duration(days: 1)),
    );
    if (picked == null) return;
    controller.setDob(picked);
    _dobCtrl.text =
        '${picked.year.toString().padLeft(4, '0')}-'
        '${picked.month.toString().padLeft(2, '0')}-'
        '${picked.day.toString().padLeft(2, '0')}';
  }

  Future<void> _save(EditProfileController controller) async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await controller.save(
      phone: _phoneCtrl.text,
      dob: _dobCtrl.text,
      emergencyPhone: _emergencyCtrl.text,
      currentAddress: _currentAddressCtrl.text,
      permanentAddress: _permanentAddressCtrl.text,
      pfUanNo: _pfUanCtrl.text,
      esicNo: _esicCtrl.text,
    );
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated.')),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<EditProfileController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Edit Profile'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: switch (controller.status) {
        EditProfileStatus.idle ||
        EditProfileStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        EditProfileStatus.error => Center(
            child: Text(
              controller.error ?? 'Failed to load profile',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        EditProfileStatus.success => SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildContactSection(controller),
                    const SizedBox(height: 12),
                    _buildPersonalSection(controller),
                    const SizedBox(height: 12),
                    _buildAddressSection(controller),
                    const SizedBox(height: 12),
                    _buildStatutorySection(controller),
                    if (controller.error != null) ...[
                      const SizedBox(height: 12),
                      _ErrorBanner(message: controller.error!),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed:
                          controller.saving ? null : () => _save(controller),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: controller.saving
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
                                  fontSize: 15, fontWeight: FontWeight.w600),
                            ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
      },
    );
  }

  Widget _buildContactSection(EditProfileController controller) {
    return _SectionCard(
      title: 'Contact',
      children: [
        TextFormField(
          controller: _phoneCtrl,
          keyboardType: TextInputType.phone,
          enabled: !controller.saving,
          decoration: const InputDecoration(
            labelText: 'Phone',
            prefixIcon: Icon(Icons.phone_outlined),
          ),
          validator: controller.validatePhone,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _emergencyCtrl,
          keyboardType: TextInputType.phone,
          enabled: !controller.saving,
          decoration: const InputDecoration(
            labelText: 'Emergency phone',
            prefixIcon: Icon(Icons.contact_phone_outlined),
          ),
          validator: controller.validatePhone,
        ),
      ],
    );
  }

  Widget _buildPersonalSection(EditProfileController controller) {
    final master = context.read<MasterDataService>();

    return _SectionCard(
      title: 'Personal',
      children: [
        TextFormField(
          controller: _dobCtrl,
          readOnly: true,
          onTap: controller.saving ? null : () => _pickDob(controller),
          decoration: const InputDecoration(
            labelText: 'Date of birth',
            prefixIcon: Icon(Icons.cake_outlined),
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: controller.genderId,
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
          onChanged: controller.saving ? null : controller.setGender,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: controller.qualificationId,
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
          onChanged: controller.saving ? null : controller.setQualification,
        ),
        if (controller.maritalStatuses.isNotEmpty) ...[
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: controller.maritalStatusId,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Marital status',
              prefixIcon: Icon(Icons.family_restroom_outlined),
            ),
            items: controller.maritalStatuses
                .map((m) => DropdownMenuItem<String>(
                      value: m['id'] as String,
                      child: Text(m['label'] as String),
                    ))
                .toList(),
            onChanged:
                controller.saving ? null : controller.setMaritalStatus,
          ),
        ],
      ],
    );
  }

  Widget _buildAddressSection(EditProfileController controller) {
    return _SectionCard(
      title: 'Address',
      children: [
        TextFormField(
          controller: _currentAddressCtrl,
          minLines: 2,
          maxLines: 4,
          enabled: !controller.saving,
          decoration: const InputDecoration(
            labelText: 'Current address',
            prefixIcon: Icon(Icons.home_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _permanentAddressCtrl,
          minLines: 2,
          maxLines: 4,
          enabled: !controller.saving,
          decoration: const InputDecoration(
            labelText: 'Permanent address',
            prefixIcon: Icon(Icons.location_on_outlined),
          ),
        ),
      ],
    );
  }

  Widget _buildStatutorySection(EditProfileController controller) {
    return _SectionCard(
      title: 'Statutory IDs',
      children: [
        TextFormField(
          controller: _pfUanCtrl,
          enabled: !controller.saving,
          decoration: const InputDecoration(
            labelText: 'PF / UAN number',
            prefixIcon: Icon(Icons.badge_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _esicCtrl,
          enabled: !controller.saving,
          decoration: const InputDecoration(
            labelText: 'ESIC number',
            prefixIcon: Icon(Icons.medical_information_outlined),
          ),
        ),
      ],
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
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
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
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
