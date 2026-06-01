import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/history_controller.dart';
import '../repositories/leave_history_repository.dart';
import '../widgets/empty_state.dart';
import '../widgets/leave_request_card.dart';
import 'leave_detail_screen.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => HistoryController(LeaveHistoryRepository()),
      child: const _HistoryView(),
    );
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _HistoryView extends StatefulWidget {
  const _HistoryView();

  @override
  State<_HistoryView> createState() => _HistoryViewState();
}

class _HistoryViewState extends State<_HistoryView> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<HistoryController>().load(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(title: const Text('Leave History')),
      body: Column(
        children: [
          const _YearSelector(),
          const _FilterChips(),
          Expanded(child: _RequestList()),
        ],
      ),
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _YearSelector extends StatelessWidget {
  const _YearSelector();

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<HistoryController>();
    final currentYear = DateTime.now().year;
    final years = List.generate(5, (i) => currentYear - i);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          const Icon(Icons.calendar_month_outlined,
              size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<int>(
                value: controller.selectedYear,
                isDense: true,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
                items: years
                    .map((y) =>
                        DropdownMenuItem(value: y, child: Text('$y')))
                    .toList(),
                onChanged: (val) {
                  if (val != null) controller.setYear(val);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips();

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<HistoryController>();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: SizedBox(
        height: 36,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: HistoryController.filters.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, index) {
            final (value, label) = HistoryController.filters[index];
            final isSelected = controller.selectedFilter == value;

            return GestureDetector(
              onTap: () => controller.setFilter(value),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.accent : AppColors.cardBg,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: isSelected ? AppColors.accent : AppColors.border,
                  ),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    color:
                        isSelected ? Colors.white : AppColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RequestList extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final controller = context.watch<HistoryController>();

    if (controller.status == HistoryStatus.loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (controller.status == HistoryStatus.error) {
      return Center(
        child: Text(
          controller.error ?? 'Something went wrong',
          style: const TextStyle(color: AppColors.danger),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: controller.load,
      child: controller.requests.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 80),
                EmptyStateWidget(
                  icon: Icons.history,
                  title: 'No leave requests found',
                  description: 'Your leave history will appear here.',
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: controller.requests.length,
              itemBuilder: (context, index) {
                final req = controller.requests[index];
                return LeaveRequestCard(
                  leaveTypeLabel: req.leaveType.label,
                  leaveTypeColor: req.leaveType.color,
                  startDate: req.startDate,
                  endDate: req.endDate,
                  workingDays: req.workingDays,
                  status: req.status,
                  onTap: () => Navigator.of(context)
                      .push(MaterialPageRoute(
                        builder: (_) =>
                            LeaveDetailScreen(requestId: req.id),
                      ))
                      .then((_) => controller.load()),
                );
              },
            ),
    );
  }
}
