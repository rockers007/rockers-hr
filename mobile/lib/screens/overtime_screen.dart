import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../controllers/overtime_controller.dart';
import '../repositories/overtime_repository.dart';
import '../services/logging_service.dart';
import '../services/overtime_service.dart';

class OvertimeScreen extends StatelessWidget {
  const OvertimeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => OvertimeController(OvertimeRepository()),
      child: const _OvertimeView(),
    );
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

String _formatTime(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

String _formatDate(String dateStr) {
  try {
    return DateFormat('EEE, MMM d, yyyy').format(DateTime.parse(dateStr));
  } catch (e) {
    showLog('OvertimeScreen._formatDate("$dateStr"): $e', type: LogType.error);
    return dateStr;
  }
}

// ── View ───────────────────────────────────────────────────────────────────

class _OvertimeView extends StatefulWidget {
  const _OvertimeView();

  @override
  State<_OvertimeView> createState() => _OvertimeViewState();
}

class _OvertimeViewState extends State<_OvertimeView> {
  final _dateCtrl = TextEditingController();
  final _startCtrl = TextEditingController();
  final _endCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<OvertimeController>().load(),
    );
  }

  @override
  void dispose() {
    _dateCtrl.dispose();
    _startCtrl.dispose();
    _endCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(OvertimeController controller) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 7)),
    );
    if (date == null) return;
    controller.setDate(date);
    _dateCtrl.text = DateFormat('yyyy-MM-dd').format(date);
  }

  Future<void> _pickStartTime(OvertimeController controller) async {
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 18, minute: 0),
    );
    if (time == null) return;
    controller.setStartTime(time);
    _startCtrl.text = _formatTime(time);
  }

  Future<void> _pickEndTime(OvertimeController controller) async {
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 21, minute: 0),
    );
    if (time == null) return;
    controller.setEndTime(time);
    _endCtrl.text = _formatTime(time);
  }

  void _clearFormControllers() {
    _dateCtrl.clear();
    _startCtrl.clear();
    _endCtrl.clear();
    _reasonCtrl.clear();
  }

  Future<void> _submit(OvertimeController controller) async {
    if (controller.selectedDate == null ||
        controller.startTime == null ||
        controller.endTime == null ||
        _reasonCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }
    final ok = await controller.submit(
      date: _dateCtrl.text,
      startTime: _startCtrl.text,
      endTime: _endCtrl.text,
      reason: _reasonCtrl.text.trim(),
    );
    if (!mounted) return;
    if (ok) {
      _clearFormControllers();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Overtime request submitted')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to submit overtime request')),
      );
    }
  }

  Future<void> _confirmCancel(
      OvertimeController controller, String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Overtime'),
        content:
            const Text('Are you sure you want to cancel this request?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    final ok = await controller.cancelRequest(id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok
            ? 'Overtime request cancelled'
            : 'Failed to cancel request'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<OvertimeController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Overtime'),
        actions: [
          IconButton(
            icon: Icon(controller.showForm ? Icons.close : Icons.add),
            onPressed: controller.toggleForm,
          ),
        ],
      ),
      body: switch (controller.status) {
        OvertimeStatus.idle ||
        OvertimeStatus.loading =>
          const Center(child: CircularProgressIndicator()),
        OvertimeStatus.error => Center(
            child: Text(
              controller.error ?? 'Something went wrong',
              style: const TextStyle(color: AppColors.danger),
            ),
          ),
        OvertimeStatus.success => RefreshIndicator(
            onRefresh: controller.load,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (controller.summary != null)
                  _SummaryCards(summary: controller.summary!),
                const SizedBox(height: 16),
                if (controller.showForm) ...[
                  _OvertimeForm(
                    controller: controller,
                    dateCtrl: _dateCtrl,
                    startCtrl: _startCtrl,
                    endCtrl: _endCtrl,
                    reasonCtrl: _reasonCtrl,
                    onPickDate: () => _pickDate(controller),
                    onPickStart: () => _pickStartTime(controller),
                    onPickEnd: () => _pickEndTime(controller),
                    onSubmit: () => _submit(controller),
                  ),
                  const SizedBox(height: 16),
                ],
                if (controller.requests.isEmpty)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text(
                        'No overtime requests yet',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ),
                  )
                else
                  ...controller.requests.map(
                    (ot) => _OvertimeRequestCard(
                      request: ot,
                      onCancel: () => _confirmCancel(controller, ot.id),
                    ),
                  ),
              ],
            ),
          ),
      },
    );
  }
}

// ── Private widgets ────────────────────────────────────────────────────────

class _SummaryCards extends StatelessWidget {
  const _SummaryCards({required this.summary});

  final OvertimeSummary summary;

  @override
  Widget build(BuildContext context) {
    final unpaid = summary.totalApprovedHours - summary.totalPaidHours;
    return Row(
      children: [
        _SummaryTile(
            label: 'Approved',
            value: '${summary.totalApprovedHours}h',
            color: AppColors.accent),
        const SizedBox(width: 8),
        _SummaryTile(
            label: 'Paid',
            value: '${summary.totalPaidHours}h',
            color: Colors.green.shade700),
        const SizedBox(width: 8),
        _SummaryTile(
            label: 'Unpaid',
            value: '${unpaid.toStringAsFixed(1)}h',
            color: Colors.orange.shade700),
      ],
    );
  }
}

class _SummaryTile extends StatelessWidget {
  const _SummaryTile({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: const TextStyle(
                    fontSize: 11, color: AppColors.textSecondary)),
            const SizedBox(height: 4),
            Text(value,
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: color)),
          ],
        ),
      ),
    );
  }
}

class _OvertimeForm extends StatelessWidget {
  const _OvertimeForm({
    required this.controller,
    required this.dateCtrl,
    required this.startCtrl,
    required this.endCtrl,
    required this.reasonCtrl,
    required this.onPickDate,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onSubmit,
  });

  final OvertimeController controller;
  final TextEditingController dateCtrl;
  final TextEditingController startCtrl;
  final TextEditingController endCtrl;
  final TextEditingController reasonCtrl;
  final VoidCallback onPickDate;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New Overtime Request',
              style:
                  TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(
            controller: dateCtrl,
            readOnly: true,
            onTap: onPickDate,
            decoration: const InputDecoration(
              labelText: 'Date',
              suffixIcon: Icon(Icons.calendar_today),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: startCtrl,
                  readOnly: true,
                  onTap: onPickStart,
                  decoration: const InputDecoration(
                    labelText: 'Start Time',
                    suffixIcon: Icon(Icons.access_time),
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: endCtrl,
                  readOnly: true,
                  onTap: onPickEnd,
                  decoration: const InputDecoration(
                    labelText: 'End Time',
                    suffixIcon: Icon(Icons.access_time),
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              if (controller.calcHours.isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(
                  controller.calcHours,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: AppColors.accent),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: reasonCtrl,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Reason',
              hintText: 'Reason for overtime work...',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: controller.submitting ? null : onSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: controller.submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit Request'),
            ),
          ),
        ],
      ),
    );
  }
}

class _OvertimeRequestCard extends StatelessWidget {
  const _OvertimeRequestCard({
    required this.request,
    required this.onCancel,
  });

  final OvertimeRequest request;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatDate(request.date),
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14),
              ),
              Row(
                children: [
                  _StatusChip(status: request.status),
                  const SizedBox(width: 6),
                  _PaymentChip(paymentStatus: request.paymentStatus),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${request.startTime.substring(0, 5)} – ${request.endTime.substring(0, 5)}  ·  ${request.hours}h',
            style: const TextStyle(
                fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 4),
          Text(request.reason, style: const TextStyle(fontSize: 13)),
          if (request.adminRemarks != null) ...[
            const SizedBox(height: 4),
            Text(
              'Admin: ${request.adminRemarks}',
              style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  fontStyle: FontStyle.italic),
            ),
          ],
          if (request.status == 'pending')
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onCancel,
                style:
                    TextButton.styleFrom(foregroundColor: Colors.red),
                child: const Text('Cancel'),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (status) {
      'pending' => (Colors.amber.shade100, Colors.amber.shade800),
      'approved' => (Colors.green.shade100, Colors.green.shade800),
      'declined' => (Colors.red.shade100, Colors.red.shade800),
      _ => (Colors.grey.shade100, Colors.grey.shade800),
    };
    return _Chip(label: status, bg: bg, fg: fg);
  }
}

class _PaymentChip extends StatelessWidget {
  const _PaymentChip({required this.paymentStatus});

  final String paymentStatus;

  @override
  Widget build(BuildContext context) {
    final label = paymentStatus == 'comp_off' ? 'Comp Off' : paymentStatus;
    final (bg, fg) = switch (paymentStatus) {
      'paid' => (Colors.green.shade100, Colors.green.shade800),
      'comp_off' => (Colors.blue.shade100, Colors.blue.shade800),
      _ => (Colors.grey.shade100, Colors.grey.shade700),
    };
    return _Chip(label: label, bg: bg, fg: fg);
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.bg, required this.fg});

  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }
}
