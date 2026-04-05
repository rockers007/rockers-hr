import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../config/theme.dart';
import '../services/overtime_service.dart';

class OvertimeScreen extends StatefulWidget {
  const OvertimeScreen({super.key});

  @override
  State<OvertimeScreen> createState() => _OvertimeScreenState();
}

class _OvertimeScreenState extends State<OvertimeScreen> {
  final _otService = OvertimeService();
  List<OvertimeRequest> _requests = [];
  OvertimeSummary? _summary;
  bool _loading = true;
  bool _showForm = false;

  // Form controllers
  final _dateController = TextEditingController();
  final _startController = TextEditingController();
  final _endController = TextEditingController();
  final _reasonController = TextEditingController();
  DateTime? _selectedDate;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _dateController.dispose();
    _startController.dispose();
    _endController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _otService.getMyOvertime(),
        _otService.getMySummary(),
      ]);
      setState(() {
        _requests = results[0] as List<OvertimeRequest>;
        _summary = results[1] as OvertimeSummary;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load overtime data: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 7)),
    );
    if (date != null) {
      setState(() {
        _selectedDate = date;
        _dateController.text = DateFormat('yyyy-MM-dd').format(date);
      });
    }
  }

  Future<void> _pickStartTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 18, minute: 0),
    );
    if (time != null) {
      setState(() {
        _startTime = time;
        _startController.text = _formatTime(time);
      });
    }
  }

  Future<void> _pickEndTime() async {
    final time = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 21, minute: 0),
    );
    if (time != null) {
      setState(() {
        _endTime = time;
        _endController.text = _formatTime(time);
      });
    }
  }

  String _formatTime(TimeOfDay time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  String _calcHours() {
    if (_startTime == null || _endTime == null) return '';
    final startMin = _startTime!.hour * 60 + _startTime!.minute;
    final endMin = _endTime!.hour * 60 + _endTime!.minute;
    final diff = endMin - startMin;
    if (diff <= 0) return '0h';
    return '${(diff / 60).toStringAsFixed(1)}h';
  }

  Future<void> _submitOvertime() async {
    if (_selectedDate == null || _startTime == null || _endTime == null || _reasonController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await _otService.apply(
        date: _dateController.text,
        startTime: _startController.text,
        endTime: _endController.text,
        reason: _reasonController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Overtime request submitted')),
        );
        setState(() {
          _showForm = false;
          _dateController.clear();
          _startController.clear();
          _endController.clear();
          _reasonController.clear();
          _selectedDate = null;
          _startTime = null;
          _endTime = null;
        });
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _cancelRequest(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Overtime'),
        content: const Text('Are you sure you want to cancel this request?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes')),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      await _otService.cancel(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Overtime request cancelled')),
        );
        _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Overtime'),
        actions: [
          IconButton(
            icon: Icon(_showForm ? Icons.close : Icons.add),
            onPressed: () => setState(() => _showForm = !_showForm),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Summary cards
                  if (_summary != null) _buildSummary(),
                  const SizedBox(height: 16),

                  // Apply form
                  if (_showForm) ...[
                    _buildForm(),
                    const SizedBox(height: 16),
                  ],

                  // Request list
                  if (_requests.isEmpty)
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
                    ..._requests.map(_buildRequestCard),
                ],
              ),
            ),
    );
  }

  Widget _buildSummary() {
    final s = _summary!;
    final unpaid = s.totalApprovedHours - s.totalPaidHours;
    return Row(
      children: [
        _summaryTile('Approved', '${s.totalApprovedHours}h', AppColors.accent),
        const SizedBox(width: 8),
        _summaryTile('Paid', '${s.totalPaidHours}h', Colors.green.shade700),
        const SizedBox(width: 8),
        _summaryTile('Unpaid', '${unpaid.toStringAsFixed(1)}h', Colors.orange.shade700),
      ],
    );
  }

  Widget _summaryTile(String label, String value, Color color) {
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
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
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
          const Text('New Overtime Request', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          // Date
          TextField(
            controller: _dateController,
            readOnly: true,
            onTap: _pickDate,
            decoration: const InputDecoration(
              labelText: 'Date',
              suffixIcon: Icon(Icons.calendar_today),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          // Time row
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _startController,
                  readOnly: true,
                  onTap: _pickStartTime,
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
                  controller: _endController,
                  readOnly: true,
                  onTap: _pickEndTime,
                  decoration: const InputDecoration(
                    labelText: 'End Time',
                    suffixIcon: Icon(Icons.access_time),
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              if (_calcHours().isNotEmpty) ...[
                const SizedBox(width: 8),
                Text(_calcHours(), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.accent)),
              ],
            ],
          ),
          const SizedBox(height: 12),
          // Reason
          TextField(
            controller: _reasonController,
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
              onPressed: _submitting ? null : _submitOvertime,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: _submitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit Request'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequestCard(OvertimeRequest ot) {
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
                _formatDate(ot.date),
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              ),
              Row(
                children: [
                  _statusChip(ot.status),
                  const SizedBox(width: 6),
                  _paymentChip(ot.paymentStatus),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${ot.startTime.substring(0, 5)} – ${ot.endTime.substring(0, 5)}  ·  ${ot.hours}h',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 4),
          Text(ot.reason, style: const TextStyle(fontSize: 13)),
          if (ot.adminRemarks != null) ...[
            const SizedBox(height: 4),
            Text(
              'Admin: ${ot.adminRemarks}',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
            ),
          ],
          if (ot.status == 'pending')
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => _cancelRequest(ot.id),
                style: TextButton.styleFrom(foregroundColor: Colors.red),
                child: const Text('Cancel'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    final colors = {
      'pending': (Colors.amber.shade100, Colors.amber.shade800),
      'approved': (Colors.green.shade100, Colors.green.shade800),
      'declined': (Colors.red.shade100, Colors.red.shade800),
    };
    final c = colors[status] ?? (Colors.grey.shade100, Colors.grey.shade800);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.$1,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c.$2)),
    );
  }

  Widget _paymentChip(String ps) {
    final label = ps == 'comp_off' ? 'Comp Off' : ps;
    final colors = {
      'paid': (Colors.green.shade100, Colors.green.shade800),
      'comp_off': (Colors.blue.shade100, Colors.blue.shade800),
      'unpaid': (Colors.grey.shade100, Colors.grey.shade700),
    };
    final c = colors[ps] ?? (Colors.grey.shade100, Colors.grey.shade700);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.$1,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c.$2)),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return DateFormat('EEE, MMM d, yyyy').format(d);
    } catch (_) {
      return dateStr;
    }
  }
}
