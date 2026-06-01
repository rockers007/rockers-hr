import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/change_password_controller.dart';
import '../services/auth_service.dart';

class ChangePasswordScreen extends StatelessWidget {
  const ChangePasswordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (ctx) =>
          ChangePasswordController(ctx.read<AuthService>()),
      child: const _ChangePasswordView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _ChangePasswordView extends StatefulWidget {
  const _ChangePasswordView();

  @override
  State<_ChangePasswordView> createState() => _ChangePasswordViewState();
}

class _ChangePasswordViewState extends State<_ChangePasswordView> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit(ChangePasswordController controller) async {
    if (!_formKey.currentState!.validate()) return;

    final ok = await controller.submit(
      currentPassword: _currentCtrl.text,
      newPassword: _newCtrl.text,
      confirmPassword: _confirmCtrl.text,
    );

    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated.')),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<ChangePasswordController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Change Password'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Use a new password you haven\'t used here before. '
                    'Minimum 8 characters with at least one letter and '
                    'one digit.',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  _PasswordField(
                    controller: _currentCtrl,
                    label: 'Current password',
                    visible: _showCurrent,
                    onToggleVisible: () =>
                        setState(() => _showCurrent = !_showCurrent),
                    enabled: !controller.submitting,
                    validator: (v) => (v == null || v.isEmpty)
                        ? 'Current password is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  _PasswordField(
                    controller: _newCtrl,
                    label: 'New password',
                    visible: _showNew,
                    onToggleVisible: () =>
                        setState(() => _showNew = !_showNew),
                    enabled: !controller.submitting,
                    validator: (v) => controller.validateNew(
                      v,
                      currentPassword: _currentCtrl.text,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _PasswordField(
                    controller: _confirmCtrl,
                    label: 'Confirm new password',
                    visible: _showConfirm,
                    onToggleVisible: () =>
                        setState(() => _showConfirm = !_showConfirm),
                    enabled: !controller.submitting,
                    textInputAction: TextInputAction.done,
                    onSubmit: () => _submit(controller),
                    validator: (v) => controller.validateConfirm(
                      v,
                      newPassword: _newCtrl.text,
                    ),
                  ),
                  if (controller.error != null) ...[
                    const SizedBox(height: 12),
                    _ErrorBanner(message: controller.error!),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed:
                        controller.submitting ? null : () => _submit(controller),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: controller.submitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Update password',
                            style: TextStyle(
                                fontSize: 15, fontWeight: FontWeight.w600),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.label,
    required this.visible,
    required this.onToggleVisible,
    required this.enabled,
    this.validator,
    this.textInputAction = TextInputAction.next,
    this.onSubmit,
  });

  final TextEditingController controller;
  final String label;
  final bool visible;
  final VoidCallback onToggleVisible;
  final bool enabled;
  final String? Function(String?)? validator;
  final TextInputAction textInputAction;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: !visible,
      textInputAction: textInputAction,
      onFieldSubmitted: onSubmit == null ? null : (_) => onSubmit!(),
      enabled: enabled,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.lock_outline, size: 20),
        suffixIcon: IconButton(
          icon: Icon(
            visible
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            size: 20,
          ),
          onPressed: onToggleVisible,
        ),
      ),
      validator: validator,
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
        style: const TextStyle(
          color: AppColors.declinedText,
          fontSize: 13,
        ),
      ),
    );
  }
}
