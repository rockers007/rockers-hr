import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/salary_controller.dart';
import '../repositories/payroll_repository.dart';
import '../widgets/salary_breakdown.dart';

class SalaryScreen extends StatelessWidget {
  const SalaryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => SalaryController(PayrollRepository()),
      child: const _SalaryView(),
    );
  }
}

class _SalaryView extends StatefulWidget {
  const _SalaryView();

  @override
  State<_SalaryView> createState() => _SalaryViewState();
}

class _SalaryViewState extends State<_SalaryView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SalaryController>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<SalaryController>();

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Salary Breakdown'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: switch (controller.status) {
        SalaryStatus.idle ||
        SalaryStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        SalaryStatus.error => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                controller.error!,
                style: const TextStyle(color: AppColors.declinedText),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        SalaryStatus.success => controller.salary == null
            ? const Center(child: Text('Salary not configured'))
            : RefreshIndicator(
                onRefresh: context.read<SalaryController>().load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    SalaryBreakdownView(salary: controller.salary!),
                  ],
                ),
              ),
      },
    );
  }
}
