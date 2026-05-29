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
                      _buildHeader(),
                      const SizedBox(height: 24),
                      _buildEmailField(ctrl),
                      const SizedBox(height: 14),
                      _buildPasswordField(ctrl),
                      const SizedBox(height: 6),
                      _buildFirstLoginHint(),
                      if (ctrl.errorMessage != null) ...[
                        const SizedBox(height: 12),
                        _buildErrorBanner(ctrl.errorMessage!),
                      ],
                      const SizedBox(height: 18),
                      _buildSignInButton(ctrl),
                      const SizedBox(height: 16),
                      const Divider(height: 1, color: AppColors.border),
                      const SizedBox(height: 12),
                      _buildGoogleButton(ctrl),
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

  Widget _buildHeader() {
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

  Widget _buildEmailField(LoginController ctrl) {
    return TextFormField(
      controller: _emailCtrl,
      keyboardType: TextInputType.emailAddress,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: TextInputAction.next,
      decoration: const InputDecoration(
        labelText: 'Email',
        hintText: 'you@example.com',
        prefixIcon: Icon(Icons.alternate_email, size: 20),
      ),
      validator: ctrl.validateEmail,
      enabled: !ctrl.busy,
    );
  }

  Widget _buildPasswordField(LoginController ctrl) {
    return TextFormField(
      controller: _passwordCtrl,
      obscureText: !ctrl.showPassword,
      textInputAction: TextInputAction.done,
      onFieldSubmitted: (_) => ctrl.busy ? null : _submit(ctrl),
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
      enabled: !ctrl.busy,
    );
  }

  Widget _buildFirstLoginHint() {
    return const Text(
      "First-time login? Use the password sent to your "
      "email — you'll be prompted to set a new one "
      "after logging in.",
      style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
    );
  }

  Widget _buildErrorBanner(String message) {
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

  Widget _buildSignInButton(LoginController ctrl) {
    return FilledButton(
      onPressed: ctrl.busy ? null : () => _submit(ctrl),
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: ctrl.submitting
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : const Text(
              'Sign In',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
    );
  }

  Widget _buildGoogleButton(LoginController ctrl) {
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
