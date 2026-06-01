import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/apply_leave_controller.dart';
import '../models/leave_models.dart';
import '../repositories/apply_leave_repository.dart';
import '../services/auth_service.dart';
import '../services/master_data_service.dart';
import '../widgets/leave_balance_card.dart' show hexToColor;

class ApplyLeaveScreen extends StatelessWidget {
  const ApplyLeaveScreen({super.key, this.showBackButton = false});

  final bool showBackButton;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (ctx) => ApplyLeaveController(
        repo: ApplyLeaveRepository(),
        masterData: ctx.read<MasterDataService>(),
        auth: ctx.read<AuthService>(),
      ),
      child: _ApplyLeaveView(showBackButton: showBackButton),
    );
  }
}

// ── View ──

class _ApplyLeaveView extends StatefulWidget {
  const _ApplyLeaveView({required this.showBackButton});

  final bool showBackButton;

  @override
  State<_ApplyLeaveView> createState() => _ApplyLeaveViewState();
}

class _ApplyLeaveViewState extends State<_ApplyLeaveView> {
  late final TextEditingController _reasonCtrl;
  ApplyLeaveController? _ctrl;

  @override
  void initState() {
    super.initState();
    _reasonCtrl = TextEditingController();
    _reasonCtrl.addListener(_syncReason);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _ctrl = context.read<ApplyLeaveController>();
      _ctrl!.addListener(_onControllerChange);
      _ctrl!.loadInitialData();
    });
  }

  @override
  void dispose() {
    _ctrl?.removeListener(_onControllerChange);
    _reasonCtrl
      ..removeListener(_syncReason)
      ..dispose();
    super.dispose();
  }

  void _syncReason() => _ctrl?.setReason(_reasonCtrl.text);

  void _onControllerChange() {
    final ctrl = _ctrl;
    if (ctrl == null) return;
    final err = ctrl.actionError;
    if (err != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(err),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      ctrl.clearActionError();
    }
  }

  Future<void> _pickDate(ApplyLeaveController ctrl, {required bool isStart}) async {
    final now = DateTime.now();
    final initial = isStart
        ? (ctrl.startDate ?? now.add(const Duration(days: 1)))
        : (ctrl.endDate ?? ctrl.startDate ?? now.add(const Duration(days: 1)));
    final firstDate = isStart ? now : (ctrl.startDate ?? now);

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: firstDate,
      lastDate: DateTime(now.year + 1, 12, 31),
    );

    if (picked != null && mounted) {
      isStart ? ctrl.setStartDate(picked) : ctrl.setEndDate(picked);
    }
  }

  Future<void> _submit(ApplyLeaveController ctrl) async {
    final success = await ctrl.submit();
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Leave request submitted successfully!'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = context.watch<ApplyLeaveController>();

    if (ctrl.isEmploymentEnded) {
      return _EmploymentEndedView(
        user: ctrl.currentUser,
        showBackButton: widget.showBackButton,
      );
    }

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Apply for Leave'),
        leading: widget.showBackButton
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.of(context).pop(),
              )
            : null,
        automaticallyImplyLeading: widget.showBackButton,
      ),
      body: switch (ctrl.status) {
        ApplyLeaveStatus.loading ||
        ApplyLeaveStatus.initial =>
          const Center(child: CircularProgressIndicator()),
        ApplyLeaveStatus.error => _ErrorView(
            message: ctrl.error ?? 'An error occurred.',
            onRetry: ctrl.loadInitialData,
          ),
        ApplyLeaveStatus.ready => Column(
            children: [
              _StepIndicator(currentStep: ctrl.step),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: _buildStepContent(ctrl),
                ),
              ),
              _NavigationButtons(
                ctrl: ctrl,
                onSubmit: () => _submit(ctrl),
              ),
            ],
          ),
      },
    );
  }

  Widget _buildStepContent(ApplyLeaveController ctrl) {
    return switch (ctrl.step) {
      0 => _buildStep1(ctrl),
      1 => _buildStep2(ctrl),
      2 => _buildStep3(ctrl),
      _ => const SizedBox.shrink(),
    };
  }

  // ── Step 1: Leave Type + Dates ──

  Widget _buildStep1(ApplyLeaveController ctrl) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Leave Type',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: ctrl.leaveTypes.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, index) =>
                _LeaveTypePill(
                  type: ctrl.leaveTypes[index],
                  isSelected: ctrl.selectedType?.id == ctrl.leaveTypes[index].id,
                  balance: ctrl.getBalance(ctrl.leaveTypes[index].id),
                  onTap: () => ctrl.selectType(ctrl.leaveTypes[index]),
                ),
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Duration Type',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        if (ctrl.durations.isNotEmpty)
          _DurationSelector(
            durations: ctrl.durations,
            selected: ctrl.selectedDuration,
            onSelect: ctrl.selectDuration,
          ),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: _DatePickerField(
                label: 'Start Date',
                value: ctrl.startDate,
                onTap: () => _pickDate(ctrl, isStart: true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _DatePickerField(
                label: 'End Date',
                value: ctrl.endDate,
                onTap: () => _pickDate(ctrl, isStart: false),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        if (ctrl.calculating)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(),
            ),
          )
        else if (ctrl.calcResult != null)
          _CalcResultCard(result: ctrl.calcResult!, formatDays: ctrl.formatDays),
      ],
    );
  }

  // ── Step 2: Reason + Sandwich warning ──

  Widget _buildStep2(ApplyLeaveController ctrl) {
    final sandwichDetected = ctrl.calcResult?.sandwichDetected ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Reason for Leave',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _reasonCtrl,
          maxLines: 5,
          decoration: InputDecoration(
            hintText: 'Please provide a reason (min 10 characters)...',
            hintStyle: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
            counterText: '${_reasonCtrl.text.length} / 10 min',
          ),
          onChanged: (_) => setState(() {}),
        ),
        if (_reasonCtrl.text.isNotEmpty &&
            _reasonCtrl.text.trim().length < 10)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              'Reason must be at least 10 characters',
              style: TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ),
        const SizedBox(height: 24),
        if (sandwichDetected) ...[
          _SandwichWarning(
            detail: ctrl.calcResult?.sandwichDetail,
            acknowledged: ctrl.sandwichAcknowledged,
            onAcknowledged: ctrl.setSandwichAcknowledged,
          ),
          const SizedBox(height: 24),
        ],
        if (ctrl.calcResult?.docRequired ?? false) ...[
          const Text(
            'Supporting Document',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          _DocumentUploadPlaceholder(context: context),
        ],
      ],
    );
  }

  // ── Step 3: Review ──

  Widget _buildStep3(ApplyLeaveController ctrl) {
    final user = ctrl.currentUser;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Review Your Request',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.cardBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              _InfoRow(label: 'Leave Type', value: ctrl.selectedType?.label ?? ''),
              const SizedBox(height: 10),
              _InfoRow(label: 'Duration Type', value: ctrl.selectedDuration?.label ?? ''),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'Start Date',
                value: ctrl.startDate != null
                    ? DateFormat('dd MMM yyyy').format(ctrl.startDate!)
                    : '',
              ),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'End Date',
                value: ctrl.endDate != null
                    ? DateFormat('dd MMM yyyy').format(ctrl.endDate!)
                    : '',
              ),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'Working Days',
                value: ctrl.formatDays(ctrl.calcResult?.workingDays ?? 0),
              ),
              const Divider(height: 24, color: AppColors.border),
              _InfoRow(label: 'Reason', value: ctrl.reason),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Approval Path',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        _ApprovalPathCard(managerName: user?.manager?.name),
      ],
    );
  }
}

// ── Extracted private widgets ──

class _EmploymentEndedView extends StatelessWidget {
  const _EmploymentEndedView({required this.user, required this.showBackButton});

  final dynamic user;
  final bool showBackButton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Apply for Leave'),
        leading: showBackButton
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.of(context).pop(),
              )
            : null,
        automaticallyImplyLeading: showBackButton,
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.block, size: 64, color: AppColors.danger),
              const SizedBox(height: 16),
              const Text(
                'Leave Application Disabled',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                user?.lastWorkingDay != null
                    ? 'Your last working day was ${DateFormat('dd MMM yyyy').format(DateTime.parse(user!.lastWorkingDay!))}. You can no longer apply for leave.'
                    : 'Your employment status is "${user?.employmentStatus ?? 'inactive'}". You cannot apply for leave.',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.currentStep});

  final int currentStep;
  static const _labels = ['Leave Type', 'Details', 'Review'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: List.generate(_labels.length, (index) {
          final isActive = index == currentStep;
          final isCompleted = index < currentStep;
          return Expanded(
            child: Row(
              children: [
                if (index > 0)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: isCompleted || isActive
                          ? AppColors.accent
                          : AppColors.border,
                    ),
                  ),
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: isCompleted
                        ? AppColors.success
                        : isActive
                            ? AppColors.accent
                            : AppColors.border,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: isCompleted
                        ? const Icon(Icons.check, size: 16, color: Colors.white)
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: isActive
                                  ? Colors.white
                                  : AppColors.textSecondary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                if (index < _labels.length - 1)
                  Expanded(
                    child: Container(
                      height: 2,
                      color: isCompleted ? AppColors.accent : AppColors.border,
                    ),
                  ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _LeaveTypePill extends StatelessWidget {
  const _LeaveTypePill({
    required this.type,
    required this.isSelected,
    required this.balance,
    required this.onTap,
  });

  final LeaveType type;
  final bool isSelected;
  final double balance;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = hexToColor(type.color);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color : color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isSelected ? color : color.withValues(alpha: 0.3),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              type.label,
              style: TextStyle(
                color: isSelected ? Colors.white : color,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.25)
                    : color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${balance.toInt()}',
                style: TextStyle(
                  color: isSelected ? Colors.white : color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DurationSelector extends StatelessWidget {
  const _DurationSelector({
    required this.durations,
    required this.selected,
    required this.onSelect,
  });

  final List<LeaveDuration> durations;
  final LeaveDuration? selected;
  final ValueChanged<LeaveDuration> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: durations.map((dur) {
          final isSelected = selected?.id == dur.id;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelect(dur),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Center(
                  child: Text(
                    dur.label,
                    style: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _CalcResultCard extends StatelessWidget {
  const _CalcResultCard({required this.result, required this.formatDays});

  final CalculateResult result;
  final String Function(double) formatDays;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _InfoRow(label: 'Working Days', value: formatDays(result.workingDays)),
          const SizedBox(height: 8),
          _InfoRow(label: 'Balance Before', value: formatDays(result.balanceBefore)),
          const SizedBox(height: 8),
          _InfoRow(
            label: 'Balance After',
            value: formatDays(result.balanceAfter),
            valueColor:
                result.balanceAfter < 0 ? AppColors.danger : AppColors.success,
          ),
        ],
      ),
    );
  }
}

class _SandwichWarning extends StatelessWidget {
  const _SandwichWarning({
    required this.detail,
    required this.acknowledged,
    required this.onAcknowledged,
  });

  final String? detail;
  final bool acknowledged;
  final ValueChanged<bool> onAcknowledged;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.pendingL1Bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 20, color: AppColors.warning),
              SizedBox(width: 8),
              Text(
                'Sandwich Leave Detected',
                style: TextStyle(
                  color: AppColors.pendingL1Text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (detail != null) ...[
            const SizedBox(height: 6),
            Text(
              detail!,
              style: const TextStyle(
                color: AppColors.pendingL1Text,
                fontSize: 13,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: Checkbox(
                  value: acknowledged,
                  onChanged: (val) => onAcknowledged(val ?? false),
                  activeColor: AppColors.warning,
                ),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'I acknowledge the sandwich leave policy',
                  style: TextStyle(color: AppColors.pendingL1Text, fontSize: 13),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DocumentUploadPlaceholder extends StatelessWidget {
  const _DocumentUploadPlaceholder({required this.context});

  // ignore: prefer_typing_uninitialized_variables
  final context;

  @override
  Widget build(BuildContext _) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          const Icon(Icons.cloud_upload_outlined,
              size: 40, color: AppColors.textSecondary),
          const SizedBox(height: 8),
          const Text(
            'Upload document',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Document upload coming soon'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            child: const Text('Choose File'),
          ),
        ],
      ),
    );
  }
}

class _ApprovalPathCard extends StatelessWidget {
  const _ApprovalPathCard({required this.managerName});

  final String? managerName;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  color: AppColors.pendingL1Bg,
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text(
                    '1',
                    style: TextStyle(
                      color: AppColors.pendingL1Text,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Manager Approval',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      managerName ?? 'Direct to HR',
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.only(left: 15),
            child: SizedBox(
              height: 24,
              child: VerticalDivider(thickness: 2, color: AppColors.border),
            ),
          ),
          const Row(
            children: [
              SizedBox(
                width: 32,
                height: 32,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.pendingL2Bg,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '2',
                      style: TextStyle(
                        color: AppColors.pendingL2Text,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'HR Final Approval',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'HR Admin',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NavigationButtons extends StatelessWidget {
  const _NavigationButtons({required this.ctrl, required this.onSubmit});

  final ApplyLeaveController ctrl;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (ctrl.step > 0) ...[
              Expanded(
                child: OutlinedButton(
                  onPressed: ctrl.previousStep,
                  child: const Text('Back'),
                ),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: ctrl.step < 2
                  ? ElevatedButton(
                      onPressed: ctrl.canGoNext() ? ctrl.nextStep : null,
                      child: const Text('Next'),
                    )
                  : ElevatedButton(
                      onPressed: ctrl.submitting ? null : onSubmit,
                      child: ctrl.submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Submit Request'),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DatePickerField extends StatelessWidget {
  const _DatePickerField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final DateTime? value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.calendar_today_outlined,
                    size: 18, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(
                  value != null
                      ? DateFormat('dd MMM yyyy').format(value!)
                      : 'Select',
                  style: TextStyle(
                    color: value != null
                        ? AppColors.textPrimary
                        : AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            value,
            style: TextStyle(
              color: valueColor ?? AppColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
