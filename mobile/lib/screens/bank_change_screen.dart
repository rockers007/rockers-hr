import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/theme.dart';
import '../models/payroll_models.dart';
import '../services/payroll_service.dart';

class BankChangeScreen extends StatefulWidget {
  const BankChangeScreen({super.key});

  @override
  State<BankChangeScreen> createState() => _BankChangeScreenState();
}

class _BankChangeScreenState extends State<BankChangeScreen> {
  final _svc = PayrollService.instance;
  final _formKey = GlobalKey<FormState>();
  final _bankCtrl = TextEditingController();
  final _accCtrl = TextEditingController();
  final _accConfirmCtrl = TextEditingController();
  final _ifscCtrl = TextEditingController();

  bool _loading = true;
  bool _submitting = false;
  bool _showForm = false;
  String? _error;
  PayrollSalary? _salary;
  List<BankChangeRequest> _history = [];

  static final _ifscRegex = RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$');
  static final _digitsRegex = RegExp(r'^\d{9,18}$');

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _bankCtrl.dispose();
    _accCtrl.dispose();
    _accConfirmCtrl.dispose();
    _ifscCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _svc.getSalary(),
        _svc.getMyBankChangeRequests(),
      ]);
      _salary = results[0] as PayrollSalary;
      _history = results[1] as List<BankChangeRequest>;
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_accCtrl.text.trim() != _accConfirmCtrl.text.trim()) {
      setState(() => _error = 'Account number confirmation does not match.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await _svc.submitBankChange(
        newBankName: _bankCtrl.text.trim(),
        newAccountNo: _accCtrl.text.trim(),
        newIfsc: _ifscCtrl.text.trim().toUpperCase(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request submitted — HR will review.')),
      );
      _bankCtrl.clear();
      _accCtrl.clear();
      _accConfirmCtrl.clear();
      _ifscCtrl.clear();
      setState(() => _showForm = false);
      await _load();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPending = _history.any((h) => h.status == 'PENDING');

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Bank Details'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.declinedBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: AppColors.declinedText),
                      ),
                    ),
                  _currentCard(),
                  const SizedBox(height: 12),
                  if (!_showForm && !hasPending)
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => setState(() => _showForm = true),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Request Change'),
                      ),
                    ),
                  if (hasPending)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.pendingL1Bg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'You already have a pending change request. HR must approve or reject it before you can submit another.',
                        style: TextStyle(
                          color: AppColors.pendingL1Text,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  if (_showForm) _formCard(),
                  const SizedBox(height: 24),
                  _historyCard(),
                ],
              ),
            ),
    );
  }

  Widget _currentCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Current Details',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const SizedBox(height: 12),
            _kv('Bank', _salary?.bankName ?? '—'),
            _kv('Account No.', _salary?.bankAccountNo ?? '—'),
            _kv('IFSC', _salary?.bankIfsc ?? '—'),
          ],
        ),
      );

  Widget _formCard() => Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'New Bank Details',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _bankCtrl,
                decoration: const InputDecoration(labelText: 'Bank Name'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _accCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Account Number',
                  hintText: '9–18 digits',
                ),
                validator: (v) => (v == null ||
                        !_digitsRegex.hasMatch(v.trim()))
                    ? 'Must be 9–18 digits'
                    : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _accConfirmCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Re-enter Account Number',
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _ifscCtrl,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'IFSC Code',
                  hintText: 'e.g. HDFC0001234',
                ),
                validator: (v) => (v == null ||
                        !_ifscRegex.hasMatch(v.trim().toUpperCase()))
                    ? 'Format: ABCD0123456'
                    : null,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _submitting
                          ? null
                          : () => setState(() => _showForm = false),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: Text(_submitting ? 'Submitting…' : 'Submit'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _historyCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Request History',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const SizedBox(height: 12),
            if (_history.isEmpty)
              const Text(
                'No past requests.',
                style: TextStyle(color: AppColors.textSecondary),
              )
            else
              ..._history.map(_historyRow),
          ],
        ),
      );

  Widget _historyRow(BankChangeRequest h) {
    Color bg = AppColors.pendingL1Bg;
    Color fg = AppColors.pendingL1Text;
    if (h.status == 'APPROVED') {
      bg = AppColors.approvedBg;
      fg = AppColors.approvedText;
    } else if (h.status == 'REJECTED') {
      bg = AppColors.declinedBg;
      fg = AppColors.declinedText;
    }
    String dateLabel = '—';
    try {
      dateLabel = DateFormat('dd MMM yyyy').format(DateTime.parse(h.submittedAt));
    } catch (_) {}

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  '${h.newBankName} · ${h.newIfsc}',
                  style: const TextStyle(fontWeight: FontWeight.w500),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  h.status,
                  style: TextStyle(
                    color: fg,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            'Submitted $dateLabel',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
          if (h.rejectionReason != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                h.rejectionReason!,
                style: const TextStyle(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              k,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
              ),
            ),
            Text(v, style: const TextStyle(fontSize: 13)),
          ],
        ),
      );
}
