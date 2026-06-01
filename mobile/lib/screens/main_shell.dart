import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../services/auth_service.dart';
import 'apply_leave_screen.dart';
import 'approvals_screen.dart';
import 'history_screen.dart';
import 'home_screen.dart';
import 'overtime_screen.dart';
import 'payroll_screen.dart';
import 'profile_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  static List<Widget> _screens(bool isManager) => [
        const HomeScreen(),
        const ApplyLeaveScreen(),
        if (isManager) const ApprovalsScreen(),
        const HistoryScreen(),
        const OvertimeScreen(),
        const PayrollScreen(),
        const ProfileScreen(),
      ];

  @override
  Widget build(BuildContext context) {
    final isManager =
        context.select((AuthService a) => a.currentUser?.isManager ?? false);

    final screens = _screens(isManager);
    // Clamp in case the role changes and the current index is out of bounds.
    final safeIndex = _currentIndex.clamp(0, screens.length - 1);

    return Scaffold(
      body: IndexedStack(index: safeIndex, children: screens),
      bottomNavigationBar: _AppBottomNav(
        currentIndex: safeIndex,
        isManager: isManager,
        onTap: (i) => setState(() => _currentIndex = i),
      ),
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _AppBottomNav extends StatelessWidget {
  const _AppBottomNav({
    required this.currentIndex,
    required this.isManager,
    required this.onTap,
  });

  final int currentIndex;
  final bool isManager;
  final ValueChanged<int> onTap;

  static const _baseItems = <BottomNavigationBarItem>[
    BottomNavigationBarItem(
      icon: Icon(Icons.home_outlined),
      activeIcon: Icon(Icons.home),
      label: 'Home',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.add_circle_outline),
      activeIcon: Icon(Icons.add_circle),
      label: 'Apply',
    ),
  ];

  static const _approvalsItem = BottomNavigationBarItem(
    icon: Icon(Icons.check_circle_outline),
    activeIcon: Icon(Icons.check_circle),
    label: 'Approvals',
  );

  static const _tailItems = <BottomNavigationBarItem>[
    BottomNavigationBarItem(
      icon: Icon(Icons.history),
      activeIcon: Icon(Icons.history),
      label: 'History',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.access_time),
      activeIcon: Icon(Icons.access_time_filled),
      label: 'Overtime',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.payments_outlined),
      activeIcon: Icon(Icons.payments),
      label: 'Payroll',
    ),
    BottomNavigationBarItem(
      icon: Icon(Icons.person_outline),
      activeIcon: Icon(Icons.person),
      label: 'Profile',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final items = [
      ..._baseItems,
      if (isManager) _approvalsItem,
      ..._tailItems,
    ];

    return BottomNavigationBar(
      currentIndex: currentIndex,
      onTap: onTap,
      items: items,
      type: BottomNavigationBarType.fixed,
      backgroundColor: AppColors.cardBg,
      selectedItemColor: AppColors.accent,
      unselectedItemColor: AppColors.textSecondary,
      elevation: 8,
      selectedFontSize: 12,
      unselectedFontSize: 12,
    );
  }
}
