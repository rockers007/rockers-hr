import 'package:flutter/material.dart';

import '../config/theme.dart';
import '../models/leave_models.dart';
import '../services/api_service.dart';
import '../services/leave_service.dart';
import '../widgets/leave_request_card.dart';
import '../widgets/empty_state.dart';
import 'leave_detail_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  bool _isLoading = true;
  List<LeaveRequest> _requests = [];

  String _selectedFilter = 'ALL';
  int _selectedYear = DateTime.now().year;

  static const _filters = [
    ('ALL', 'All'),
    ('PENDING_L1,PENDING_L2', 'Pending'),
    ('APPROVED', 'Approved'),
    ('DECLINED', 'Declined'),
    ('CANCELLED', 'Cancelled'),
  ];

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() => _isLoading = true);

    try {
      final data = await LeaveService.getRequests(
        status: _selectedFilter == 'ALL' ? null : _selectedFilter,
        year: _selectedYear,
      );

      if (mounted) {
        setState(() {
          _requests = data
              .map((e) =>
                  LeaveRequest.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
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
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load history: ${e.toString()}'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currentYear = DateTime.now().year;
    final years = List.generate(5, (i) => currentYear - i);

    return Scaffold(
      backgroundColor: AppColors.neutralBg,
      appBar: AppBar(
        title: const Text('Leave History'),
      ),
      body: Column(
        children: [
          // Year selector
          Padding(
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
                      value: _selectedYear,
                      isDense: true,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      items: years
                          .map((y) => DropdownMenuItem(
                                value: y,
                                child: Text('$y'),
                              ))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedYear = val);
                          _loadRequests();
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Filter chips
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _filters.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final (value, label) = _filters[index];
                  final isSelected = _selectedFilter == value;

                  return GestureDetector(
                    onTap: () {
                      setState(() => _selectedFilter = value);
                      _loadRequests();
                    },
                    child: Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color:
                            isSelected ? AppColors.accent : AppColors.cardBg,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color:
                              isSelected ? AppColors.accent : AppColors.border,
                        ),
                      ),
                      child: Text(
                        label,
                        style: TextStyle(
                          color: isSelected
                              ? Colors.white
                              : AppColors.textSecondary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),

          // List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _loadRequests,
                    child: _requests.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 80),
                              EmptyStateWidget(
                                icon: Icons.history,
                                title: 'No leave requests found',
                                description:
                                    'Your leave history will appear here.',
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            itemCount: _requests.length,
                            itemBuilder: (context, index) {
                              final req = _requests[index];
                              return LeaveRequestCard(
                                leaveTypeLabel: req.leaveType.label,
                                leaveTypeColor: req.leaveType.color,
                                startDate: req.startDate,
                                endDate: req.endDate,
                                workingDays: req.workingDays,
                                status: req.status,
                                onTap: () {
                                  Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => LeaveDetailScreen(
                                        requestId: req.id,
                                      ),
                                    ),
                                  ).then((_) => _loadRequests());
                                },
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
