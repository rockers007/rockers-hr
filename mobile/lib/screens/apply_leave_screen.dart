import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../config/theme.dart';
import '../models/leave_models.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/leave_service.dart';
import '../services/master_data_service.dart';
import '../widgets/leave_balance_card.dart' show hexToColor;

class ApplyLeaveScreen extends StatefulWidget {
  final bool showBackButton;

  const ApplyLeaveScreen({super.key, this.showBackButton = false});

  @override
  State<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends State<ApplyLeaveScreen> {
  int _currentStep = 0;

  // Step 1 state
  List<LeaveType> _leaveTypes = [];
  List<LeaveBalance> _balances = [];
  List<LeaveDuration> _durations = [];
  bool _isLoadingTypes = true;

  LeaveType? _selectedType;
  LeaveDuration? _selectedDuration;
  DateTime? _startDate;
  DateTime? _endDate;
  CalculateResult? _calcResult;
  bool _isCalculating = false;

  // Step 2 state
  final _reasonController = TextEditingController();
  bool _sandwichAcknowledged = false;

  // Step 3 state
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    try {
      final results = await Future.wait([
        LeaveService.getEligibleLeaveTypes(),
        LeaveService.getBalances(),
      ]);

      final masterData = context.read<MasterDataService>();
      final durationsRaw = masterData.leaveDurations;

      if (mounted) {
        setState(() {
          _leaveTypes = (results[0] as List<dynamic>)
              .map((e) => LeaveType.fromJson(e as Map<String, dynamic>))
              .toList();
          _balances = (results[1] as List<dynamic>)
              .map((e) => LeaveBalance.fromJson(e as Map<String, dynamic>))
              .toList();
          _durations = durationsRaw
              .map((e) => LeaveDuration.fromJson(e))
              .toList();
          if (_durations.isNotEmpty) {
            _selectedDuration = _durations.first;
          }
          _isLoadingTypes = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _isLoadingTypes = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingTypes = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load leave types: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  double _getBalance(String typeId) {
    final match = _balances.where((b) => b.leaveType.id == typeId);
    return match.isNotEmpty ? match.first.availableDays : 0;
  }

  Future<void> _pickDate({required bool isStart}) async {
    final now = DateTime.now();
    final initial = isStart
        ? (_startDate ?? now.add(const Duration(days: 1)))
        : (_endDate ?? _startDate ?? now.add(const Duration(days: 1)));
    final firstDate = isStart ? now : (_startDate ?? now);

    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: firstDate,
      lastDate: DateTime(now.year + 1, 12, 31),
    );

    if (picked != null && mounted) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          // Reset end date if it's before new start
          if (_endDate != null && _endDate!.isBefore(picked)) {
            _endDate = picked;
          }
        } else {
          _endDate = picked;
        }
      });
      _autoCalculate();
    }
  }

  Future<void> _autoCalculate() async {
    if (_selectedType == null ||
        _selectedDuration == null ||
        _startDate == null ||
        _endDate == null) {
      return;
    }

    setState(() {
      _isCalculating = true;
      _calcResult = null;
    });

    try {
      final result = await LeaveService.calculateLeave({
        'leave_type_id': _selectedType!.id,
        'duration_type_id': _selectedDuration!.id,
        'start_date': DateFormat('yyyy-MM-dd').format(_startDate!),
        'end_date': DateFormat('yyyy-MM-dd').format(_endDate!),
      });

      if (mounted) {
        setState(() {
          _calcResult = CalculateResult.fromJson(result);
          _isCalculating = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _isCalculating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isCalculating = false);
      }
    }
  }

  bool _canGoNext() {
    switch (_currentStep) {
      case 0:
        return _selectedType != null &&
            _selectedDuration != null &&
            _startDate != null &&
            _endDate != null &&
            _calcResult != null;
      case 1:
        final reasonValid = _reasonController.text.trim().length >= 10;
        final sandwichOk = !(_calcResult?.sandwichDetected ?? false) ||
            _sandwichAcknowledged;
        return reasonValid && sandwichOk;
      default:
        return true;
    }
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);

    try {
      await LeaveService.submitRequest({
        'leave_type_id': _selectedType!.id,
        'duration_type_id': _selectedDuration!.id,
        'start_date': DateFormat('yyyy-MM-dd').format(_startDate!),
        'end_date': DateFormat('yyyy-MM-dd').format(_endDate!),
        'reason': _reasonController.text.trim(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave request submitted successfully!'),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Submission failed: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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
      body: _isLoadingTypes
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Step indicator
                _buildStepIndicator(),

                // Step content
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: _buildStepContent(),
                  ),
                ),

                // Navigation buttons
                _buildNavigationButtons(),
              ],
            ),
    );
  }

  Widget _buildStepIndicator() {
    final labels = ['Leave Type', 'Details', 'Review'];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: List.generate(labels.length, (index) {
          final isActive = index == _currentStep;
          final isCompleted = index < _currentStep;
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
                              color:
                                  isActive ? Colors.white : AppColors.textSecondary,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                if (index < labels.length - 1)
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

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 0:
        return _buildStep1();
      case 1:
        return _buildStep2();
      case 2:
        return _buildStep3();
      default:
        return const SizedBox.shrink();
    }
  }

  // ── Step 1: Leave Type + Dates ──

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Leave type pill selector
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
            itemCount: _leaveTypes.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final type = _leaveTypes[index];
              final isSelected = _selectedType?.id == type.id;
              final color = hexToColor(type.color);
              final balance = _getBalance(type.id);

              return GestureDetector(
                onTap: () {
                  setState(() => _selectedType = type);
                  _autoCalculate();
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? color : color.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(
                      color: isSelected ? color : color.withOpacity(0.3),
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
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? Colors.white.withOpacity(0.25)
                              : color.withOpacity(0.15),
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
            },
          ),
        ),
        const SizedBox(height: 24),

        // Duration type segmented control
        const Text(
          'Duration Type',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        if (_durations.isNotEmpty)
          Container(
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: _durations.map((dur) {
                final isSelected = _selectedDuration?.id == dur.id;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _selectedDuration = dur);
                      _autoCalculate();
                    },
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
                            color: isSelected
                                ? Colors.white
                                : AppColors.textSecondary,
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
          ),
        const SizedBox(height: 24),

        // Date pickers
        Row(
          children: [
            Expanded(
              child: _DatePickerField(
                label: 'Start Date',
                value: _startDate,
                onTap: () => _pickDate(isStart: true),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _DatePickerField(
                label: 'End Date',
                value: _endDate,
                onTap: () => _pickDate(isStart: false),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Calculation result
        if (_isCalculating)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_calcResult != null)
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
                _InfoRow(
                  label: 'Working Days',
                  value: _formatDays(_calcResult!.workingDays),
                ),
                const SizedBox(height: 8),
                _InfoRow(
                  label: 'Balance Before',
                  value: _formatDays(_calcResult!.balanceBefore),
                ),
                const SizedBox(height: 8),
                _InfoRow(
                  label: 'Balance After',
                  value: _formatDays(_calcResult!.balanceAfter),
                  valueColor: _calcResult!.balanceAfter < 0
                      ? AppColors.danger
                      : AppColors.success,
                ),
              ],
            ),
          ),
      ],
    );
  }

  // ── Step 2: Reason + Sandwich ──

  Widget _buildStep2() {
    final sandwichDetected = _calcResult?.sandwichDetected ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Reason
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
          controller: _reasonController,
          maxLines: 5,
          decoration: InputDecoration(
            hintText: 'Please provide a reason (min 10 characters)...',
            hintStyle: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
            ),
            counterText:
                '${_reasonController.text.length} / 10 min',
          ),
          onChanged: (_) => setState(() {}),
        ),
        if (_reasonController.text.isNotEmpty &&
            _reasonController.text.trim().length < 10)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              'Reason must be at least 10 characters',
              style: TextStyle(
                color: AppColors.danger,
                fontSize: 12,
              ),
            ),
          ),
        const SizedBox(height: 24),

        // Sandwich warning
        if (sandwichDetected) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.pendingL1Bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.warning.withOpacity(0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.warning_amber_rounded,
                        size: 20, color: AppColors.warning),
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
                if (_calcResult?.sandwichDetail != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    _calcResult!.sandwichDetail!,
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
                        value: _sandwichAcknowledged,
                        onChanged: (val) =>
                            setState(() => _sandwichAcknowledged = val ?? false),
                        activeColor: AppColors.warning,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'I acknowledge the sandwich leave policy',
                        style: TextStyle(
                          color: AppColors.pendingL1Text,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],

        // Document upload placeholder
        if (_calcResult?.docRequired ?? false) ...[
          const Text(
            'Supporting Document',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.cardBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.border,
                style: BorderStyle.solid,
              ),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.cloud_upload_outlined,
                  size: 40,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Upload document',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
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
          ),
        ],
      ],
    );
  }

  // ── Step 3: Review ──

  Widget _buildStep3() {
    final auth = context.read<AuthService>();
    final user = auth.currentUser;

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

        // Summary card
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
              _InfoRow(
                label: 'Leave Type',
                value: _selectedType?.label ?? '',
              ),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'Duration Type',
                value: _selectedDuration?.label ?? '',
              ),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'Start Date',
                value: _startDate != null
                    ? DateFormat('dd MMM yyyy').format(_startDate!)
                    : '',
              ),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'End Date',
                value: _endDate != null
                    ? DateFormat('dd MMM yyyy').format(_endDate!)
                    : '',
              ),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'Working Days',
                value: _formatDays(_calcResult?.workingDays ?? 0),
              ),
              const Divider(height: 24, color: AppColors.border),
              _InfoRow(
                label: 'Reason',
                value: _reasonController.text.trim(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Approval path
        const Text(
          'Approval Path',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
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
                          user?.manager?.name ?? 'Direct to HR',
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
                  child: VerticalDivider(
                    thickness: 2,
                    color: AppColors.border,
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: AppColors.pendingL2Bg,
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Text(
                        '2',
                        style: TextStyle(
                          color: AppColors.pendingL2Text,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
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
        ),
      ],
    );
  }

  Widget _buildNavigationButtons() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: const BoxDecoration(
        color: AppColors.cardBg,
        border: Border(
          top: BorderSide(color: AppColors.border),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            if (_currentStep > 0)
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() => _currentStep--),
                  child: const Text('Back'),
                ),
              ),
            if (_currentStep > 0) const SizedBox(width: 12),
            Expanded(
              flex: _currentStep == 0 ? 1 : 1,
              child: _currentStep < 2
                  ? ElevatedButton(
                      onPressed: _canGoNext()
                          ? () => setState(() => _currentStep++)
                          : null,
                      child: const Text('Next'),
                    )
                  : ElevatedButton(
                      onPressed: _isSubmitting ? null : _submit,
                      child: _isSubmitting
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

  String _formatDays(double days) {
    return days == days.roundToDouble()
        ? '${days.toInt()}'
        : days.toStringAsFixed(1);
  }
}

// ── Helper widgets ──

class _DatePickerField extends StatelessWidget {
  final String label;
  final DateTime? value;
  final VoidCallback onTap;

  const _DatePickerField({
    required this.label,
    required this.value,
    required this.onTap,
  });

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
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: Text(
            label,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
            ),
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
