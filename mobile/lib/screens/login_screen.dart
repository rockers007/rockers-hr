import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/login_controller.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (ctx) => LoginController(ctx.read<AuthService>()),
      child: const _LoginView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _LoginView extends StatefulWidget {
  const _LoginView();

  @override
  State<_LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<_LoginView> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit(LoginController ctrl) async {
    if (!_formKey.currentState!.validate()) return;
    await ctrl.submit(_emailCtrl.text, _passwordCtrl.text);
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = context.watch<LoginController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
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
                      const _LoginHeader(),
                      const SizedBox(height: 24),
                      _EmailField(ctrl: ctrl, controller: _emailCtrl),
                      const SizedBox(height: 14),
                      _PasswordField(
                        ctrl: ctrl,
                        controller: _passwordCtrl,
                        onSubmit: () => _submit(ctrl),
                      ),
                      const SizedBox(height: 6),
                      const _FirstLoginHint(),
                      if (ctrl.errorMessage != null) ...[
                        const SizedBox(height: 12),
                        _ErrorBanner(message: ctrl.errorMessage!),
                      ],
                      const SizedBox(height: 18),
                      _SignInButton(
                        ctrl: ctrl,
                        onSubmit: () => _submit(ctrl),
                      ),
                      const SizedBox(height: 16),
                      const Divider(height: 1, color: AppColors.border),
                      const SizedBox(height: 12),
                      _GoogleButton(ctrl: ctrl),
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

class _LoginHeader extends StatelessWidget {
  const _LoginHeader();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        Text(
          'Rockers HR',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        SizedBox(height: 4),
        Text(
          'Sign in with your email and password',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}

class _EmailField extends StatelessWidget {
  const _EmailField({required this.ctrl, required this.controller});

  final LoginController ctrl;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.emailAddress,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: TextInputAction.next,
      enabled: !ctrl.busy,
      decoration: const InputDecoration(
        labelText: 'Email',
        hintText: 'you@example.com',
        prefixIcon: Icon(Icons.alternate_email, size: 20),
      ),
      validator: ctrl.validateEmail,
    );
  }
}

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.ctrl,
    required this.controller,
    required this.onSubmit,
  });

  final LoginController ctrl;
  final TextEditingController controller;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: !ctrl.showPassword,
      textInputAction: TextInputAction.done,
      onFieldSubmitted: (_) => ctrl.busy ? null : onSubmit(),
      enabled: !ctrl.busy,
      decoration: InputDecoration(
        labelText: 'Password',
        prefixIcon: const Icon(Icons.lock_outline, size: 20),
        suffixIcon: IconButton(
          icon: Icon(
            ctrl.showPassword
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            size: 20,
          ),
          onPressed: ctrl.togglePasswordVisibility,
        ),
      ),
      validator: ctrl.validatePassword,
    );
  }
}

class _FirstLoginHint extends StatelessWidget {
  const _FirstLoginHint();

  @override
  Widget build(BuildContext context) {
    return const Text(
      "First-time login? Use the password sent to your "
      "email — you'll be prompted to set a new one "
      "after logging in.",
      style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
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

class _SignInButton extends StatelessWidget {
  const _SignInButton({required this.ctrl, required this.onSubmit});

  final LoginController ctrl;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: ctrl.busy ? null : onSubmit,
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: ctrl.submitting
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Colors.white),
            )
          : const Text(
              'Sign In',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
    );
  }
}

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.ctrl});

  final LoginController ctrl;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextButton.icon(
        onPressed: ctrl.busy ? null : ctrl.signInWithGoogle,
        icon: ctrl.googleBusy
            ? const SizedBox(
                height: 16,
                width: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.account_circle_outlined, size: 18),
        label: const Text(
          'Legacy: Sign in with Google',
          style: TextStyle(fontSize: 12),
        ),
        style: TextButton.styleFrom(
          foregroundColor: AppColors.textSecondary,
        ),
      ),
    );
  }
}
