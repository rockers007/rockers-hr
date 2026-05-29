import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/reset_password_controller.dart';
import '../services/auth_service.dart';

class ResetPasswordScreen extends StatelessWidget {
  const ResetPasswordScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (ctx) => ResetPasswordController(ctx.read<AuthService>()),
      child: const _ResetPasswordView(),
    );
  }
}

class _ResetPasswordView extends StatefulWidget {
  const _ResetPasswordView();

  @override
  State<_ResetPasswordView> createState() => _ResetPasswordViewState();
}

class _ResetPasswordViewState extends State<_ResetPasswordView> {
  final _formKey = GlobalKey<FormState>();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _showNew = false;
  bool _showConfirm = false;

  @override
  void dispose() {
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    await context.read<ResetPasswordController>().submit(
          newPassword: _newCtrl.text,
          confirmPassword: _confirmCtrl.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.select((AuthService a) => a.currentUser);
    final controller = context.watch<ResetPasswordController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: const EdgeInsets.all(24),
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
                        'Set a new password',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        user?.name.isNotEmpty == true
                            ? 'Hi ${user!.name}, your HR admin has set a '
                                'temporary password. Choose a new one to '
                                'finish — you\'ll stay signed in.'
                            : 'Your HR admin has set a temporary password. '
                                'Choose a new one to finish — you\'ll stay '
                                'signed in.',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (user?.email.isNotEmpty == true) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Signed in as ${user!.email}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      TextFormField(
                        controller: _newCtrl,
                        obscureText: !_showNew,
                        textInputAction: TextInputAction.next,
                        enabled: !controller.isSubmitting,
                        decoration: InputDecoration(
                          labelText: 'New password',
                          prefixIcon: const Icon(Icons.lock_outline, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showNew
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                            ),
                            onPressed: () => setState(() => _showNew = !_showNew),
                          ),
                          helperText:
                              'Minimum 8 chars, at least one letter and one digit.',
                          helperMaxLines: 2,
                        ),
                        validator:
                            context.read<ResetPasswordController>().validateNewPassword,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _confirmCtrl,
                        obscureText: !_showConfirm,
                        textInputAction: TextInputAction.done,
                        enabled: !controller.isSubmitting,
                        onFieldSubmitted: (_) =>
                            controller.isSubmitting ? null : _submit(),
                        decoration: InputDecoration(
                          labelText: 'Confirm new password',
                          prefixIcon: const Icon(Icons.lock_outline, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showConfirm
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                            ),
                            onPressed: () =>
                                setState(() => _showConfirm = !_showConfirm),
                          ),
                        ),
                        validator: (v) => context
                            .read<ResetPasswordController>()
                            .validateConfirm(v, _newCtrl.text),
                      ),
                      if (controller.error != null) ...[
                        const SizedBox(height: 12),
                        _ErrorBanner(message: controller.error!),
                      ],
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: controller.isSubmitting ? null : _submit,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: controller.isSubmitting
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Save and continue',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: TextButton(
                          onPressed: controller.isSubmitting
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
