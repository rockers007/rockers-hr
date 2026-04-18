import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/theme.dart';
import '../models/payroll_models.dart';
import '../services/payroll_service.dart';

/// Investment proofs — list + delete. Uploading files requires a file picker
/// which is out of scope for the Flutter parity pass (the web portal remains
/// the primary upload surface). Past proofs uploaded via web are visible and
/// deletable from mobile.
class InvestmentProofsScreen extends StatefulWidget {
  const InvestmentProofsScreen({super.key});

  @override
  State<InvestmentProofsScreen> createState() =>
      _InvestmentProofsScreenState();
}

class _InvestmentProofsScreenState extends State<InvestmentProofsScreen> {
  final _svc = PayrollService.instance;
  bool _loading = true;
  String? _error;
  late String _fy;
  late TextEditingController _fyCtrl;
  List<InvestmentProof> _rows = [];

  @override
  void initState() {
    super.initState();
    _fy = _currentFy();
    _fyCtrl = TextEditingController(text: _fy);
    _load();
  }

  @override
  void dispose() {
    _fyCtrl.dispose();
    super.dispose();
  }

  String _currentFy() {
    final now = DateTime.now();
    final y = now.month >= 4 ? now.year : now.year - 1;
    return '$y-${y + 1}';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _rows = await _svc.getInvestmentProofs(_fy);
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _delete(InvestmentProof p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove proof?'),
        content: Text('Remove "${p.category}" (${p.financialYear})?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _svc.deleteInvestmentProof(p.id);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Investment Proofs'),
        backgroundColor: AppColors.cardBg,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _fyCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Financial Year',
                      hintText: 'e.g. 2025-2026',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (v) {
                      setState(() => _fy = v.trim());
                      _load();
                    },
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () {
                    setState(() => _fy = _fyCtrl.text.trim());
                    _load();
                  },
                  child: const Text('Load'),
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Uploads are done from the web portal. Past proofs can be viewed and removed here.',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              _error!,
                              textAlign: TextAlign.center,
                              style:
                                  const TextStyle(color: AppColors.declinedText),
                            ),
                          ),
                        )
                      : _rows.isEmpty
                          ? ListView(
                              children: [
                                const SizedBox(height: 80),
                                Center(
                                  child: Text(
                                    'No proofs uploaded for $_fy.',
                                    style: const TextStyle(
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _rows.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (ctx, i) => _row(_rows[i]),
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(InvestmentProof p) {
    String uploaded = '—';
    try {
      uploaded =
          DateFormat('dd MMM yyyy').format(DateTime.parse(p.uploadedAt));
    } catch (_) {}
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      p.category,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    if (p.amount != null && p.amount!.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Text(
                        formatInr(p.amount),
                        style: const TextStyle(fontSize: 13),
                      ),
                    ],
                  ],
                ),
                if (p.description != null && p.description!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      p.description!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Uploaded $uploaded',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: AppColors.danger),
            onPressed: () => _delete(p),
          ),
        ],
      ),
    );
  }
}
