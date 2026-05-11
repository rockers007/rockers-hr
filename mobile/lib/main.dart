import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'services/auth_service.dart';
import 'services/master_data_service.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
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
        ChangeNotifierProvider(create: (_) => AuthService()),
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
  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final auth = context.read<AuthService>();
    await auth.tryRestoreSession();
    if (auth.isAuthenticated && mounted) {
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
      return const LoginScreen();
    }

    return const MainShell();
  }
}
