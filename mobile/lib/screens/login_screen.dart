import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

/// Email + password login. Mirrors the web flow in
/// frontend/src/app/login/page.tsx — same endpoint, same error
/// codes, same routing decision after success (handled by AuthGate
/// in main.dart based on AuthService.firstLoginRequired).
///
/// Legacy Google Sign-In was demoted from the primary path when the
/// v2.0 admin-invite flow shipped on the web; kept available behind
/// a small link at the bottom for the same users the web's
/// commented-out Google block is preserved for.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();

  bool _submitting = false;
  bool _googleBusy = false;
  bool _showPassword = false;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await context.read<AuthService>().signInWithEmail(
            email: _emailCtrl.text,
            password: _passwordCtrl.text,
          );
      // AuthGate (main.dart) takes over: it watches AuthService and
      // routes to either ResetPasswordScreen (firstLoginRequired) or
      // MainShell (normal user). No explicit Navigator.push needed.
    } on ApiException catch (e) {
      // Map backend error codes to friendly copy — same strings the
      // web shows so the experience is consistent across platforms.
      String msg;
      switch (e.code) {
        case 'ACCOUNT_INACTIVE':
          msg = 'Your account is inactive. Please contact HR.';
          break;
        case 'ACCOUNT_LOCKED':
          // Backend already includes the minutes-remaining hint.
          msg = e.message;
          break;
        case 'INVALID_CREDENTIALS':
          // Backend message includes the attempts-remaining hint.
          msg = e.message.isNotEmpty
              ? e.message
              : 'Invalid email or password.';
          break;
        default:
          msg = 'Invalid email or password.';
      }
      if (mounted) setState(() => _error = msg);
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Sign-in failed. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _googleBusy = true;
      _error = null;
    });
    try {
      await context.read<AuthService>().signInWithGoogle();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Sign-in failed: ${e.toString()}');
    } finally {
      if (mounted) setState(() => _googleBusy = false);
    }
  }

  String? _validateEmail(String? v) {
    final value = v?.trim() ?? '';
    if (value.isEmpty) return 'Email is required';
    // Loose validation — backend re-validates with the same regex
    // shape so anything malformed gets rejected with EMAIL_INVALID.
    final ok = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value);
    return ok ? null : 'Enter a valid email address';
  }

  String? _validatePassword(String? v) {
    if (v == null || v.isEmpty) return 'Password is required';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final busy = _submitting || _googleBusy;

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
                        'Rockers HR',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Sign in with your email and password',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
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
                        validator: _validateEmail,
                        enabled: !busy,
                      ),
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: _passwordCtrl,
                        obscureText: !_showPassword,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => busy ? null : _submit(),
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline, size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showPassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 20,
                            ),
                            onPressed: () => setState(
                              () => _showPassword = !_showPassword,
                            ),
                          ),
                        ),
                        validator: _validatePassword,
                        enabled: !busy,
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        // Matches the helper text on the web login form.
                        "First-time login? Use the password sent to your "
                        "email — you'll be prompted to set a new one "
                        "after logging in.",
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.textSecondary,
                        ),
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
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: busy ? null : _submit,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
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
                                'Sign In',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),

                      // Legacy Google login. Hidden behind a small
                      // link, matching the spirit of the commented-out
                      // Google block on the web login page. Useful for
                      // employees who pre-date the v2.0 admin-invite
                      // flow and registered with Google previously.
                      const SizedBox(height: 16),
                      const Divider(height: 1, color: AppColors.border),
                      const SizedBox(height: 12),
                      Center(
                        child: TextButton.icon(
                          onPressed: busy ? null : _handleGoogleSignIn,
                          icon: _googleBusy
                              ? const SizedBox(
                                  height: 16,
                                  width: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.account_circle_outlined,
                                  size: 18),
                          label: const Text(
                            'Legacy: Sign in with Google',
                            style: TextStyle(fontSize: 12),
                          ),
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.textSecondary,
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
