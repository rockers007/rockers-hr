import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'repositories/auth_repository.dart';
import 'services/auth_service.dart';
import 'services/master_data_service.dart';
import 'screens/complete_profile_screen.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/reset_password_screen.dart';
import 'widgets/global_progress_bar.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const RockersHrApp());
}

class RockersHrApp extends StatelessWidget {
  const RockersHrApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService(AuthRepository())),
        ChangeNotifierProvider(create: (_) => MasterDataService()),
      ],
      child: MaterialApp(
        title: 'Rockers HR',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const AuthGate(),
        // Wrap every route with the global API progress bar overlay
        // so users see a thin animated bar at the top whenever any
        // ApiService call is in flight — login, save, submit, fetch,
        // anywhere. Mirrors the web TopProgressBar mounted in
        // frontend/src/app/layout.tsx. Stack puts the bar above the
        // route content in the z-order without intercepting touches
        // (IgnorePointer inside GlobalProgressBar).
        builder: (context, child) {
          return Stack(
            children: [
              if (child != null) child,
              const Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  bottom: false,
                  child: GlobalProgressBar(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  /// Tracks whether MasterDataService.loadAll has been kicked off
  /// for this signed-in session. The gate runs through three states
  /// (loading → reset → main) and we want exactly one master-data
  /// prefetch when the user reaches the post-reset main app.
  bool _masterDataKicked = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final auth = context.read<AuthService>();
    await auth.tryRestoreSession();
    // Skip master-data prefetch on the first-login path. The reset
    // screen doesn't use master lists, and some /master endpoints
    // may behave differently on a first-login JWT depending on RBAC.
    // build() picks up the prefetch the moment AuthGate transitions
    // into the MainShell branch.
    if (auth.isAuthenticated && !auth.firstLoginRequired && mounted) {
      _masterDataKicked = true;
      await context.read<MasterDataService>().loadAll();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (auth.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (!auth.isAuthenticated) {
      // Reset the guard so the next sign-in re-prefetches master
      // data instead of relying on whatever the previous session
      // happened to load.
      _masterDataKicked = false;
      return const LoginScreen();
    }

    // Three-way first-login routing — same shape as the web
    // /login → /complete-profile vs /reset-password fork:
    //   - needsActivation  (first_login_required && !is_active)
    //       → CompleteProfileScreen (fresh invite, fill phone/dob/
    //         gender/qualification + set password).
    //   - firstLoginRequired && active
    //       → ResetPasswordScreen (admin reset, just choose a new
    //         password).
    //   - otherwise
    //       → MainShell (normal sign-in).
    if (auth.needsActivation) {
      return const CompleteProfileScreen();
    }
    if (auth.firstLoginRequired) {
      return const ResetPasswordScreen();
    }

    // Reached MainShell — make sure MasterDataService has been
    // populated for the dropdowns and lists the inner screens need.
    // Guarded by _masterDataKicked so the multiple rebuilds that
    // happen during sign-in only trigger one network burst. Post-
    // frame callback because we can't read another provider during
    // build().
    if (!_masterDataKicked) {
      _masterDataKicked = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<MasterDataService>().loadAll();
      });
    }

    return const MainShell();
  }
}
