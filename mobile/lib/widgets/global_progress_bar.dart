import 'dart:async';
import 'package:flutter/material.dart';

import '../config/theme.dart';
import '../services/api_service.dart';

/// Thin animated bar pinned to the top of the screen that activates
/// whenever any HTTP request is in flight through ApiService. Mounted
/// once via the `MaterialApp.builder` so every route picks it up
/// without per-screen wiring — same pattern as the web TopProgressBar
/// in `frontend/src/components/ui/top-progress-bar.tsx`.
///
/// Behavior matches the web app:
///   - 80ms start delay so instant fetches don't flash a bar.
///   - Asymptotic creep toward 90% while requests are open.
///   - Jumps to 100% on completion, holds 220ms, fades out.
///
/// Listens to `ApiService.instance.inflightCount` and rebuilds via
/// AnimatedBuilder. RAF-equivalent ticking is done with a periodic
/// Timer because Flutter's Ticker requires a TickerProvider — for a
/// 60Hz visual the periodic timer is simpler and accurate enough.
class GlobalProgressBar extends StatefulWidget {
  const GlobalProgressBar({super.key});

  @override
  State<GlobalProgressBar> createState() => _GlobalProgressBarState();
}

class _GlobalProgressBarState extends State<GlobalProgressBar> {
  static const Duration _startDelay = Duration(milliseconds: 80);
  static const Duration _finishHold = Duration(milliseconds: 220);
  static const Duration _fadeOut = Duration(milliseconds: 200);

  double _progress = 0; // 0–100
  bool _visible = false;
  Timer? _startTimer;
  Timer? _finishTimer;
  Timer? _trickleTimer;

  @override
  void initState() {
    super.initState();
    ApiService.instance.inflightCount.addListener(_onInflightChange);
  }

  @override
  void dispose() {
    ApiService.instance.inflightCount.removeListener(_onInflightChange);
    _startTimer?.cancel();
    _finishTimer?.cancel();
    _trickleTimer?.cancel();
    super.dispose();
  }

  void _onInflightChange() {
    final count = ApiService.instance.inflightCount.value;
    if (count > 0) {
      // Defer the actual show by _startDelay — most fetches resolve
      // in <80ms and would otherwise flash a bar for nothing.
      if (!_visible && _startTimer == null) {
        _startTimer = Timer(_startDelay, () {
          _startTimer = null;
          if (!mounted) return;
          _start();
        });
      }
    } else {
      // Count back to zero before the start-delay fired — cancel
      // the pending show entirely (the "instant fetch" case).
      if (_startTimer != null) {
        _startTimer!.cancel();
        _startTimer = null;
        return;
      }
      if (_visible) _finish();
    }
  }

  void _start() {
    _finishTimer?.cancel();
    _finishTimer = null;
    _trickleTimer?.cancel();
    setState(() {
      _progress = 30;
      _visible = true;
    });
    // ~60 FPS asymptotic creep toward 90 — same shape as nprogress.
    _trickleTimer = Timer.periodic(const Duration(milliseconds: 16), (_) {
      if (!mounted) return;
      final remaining = 90 - _progress;
      if (remaining > 0.5) {
        setState(() => _progress = _progress + remaining * 0.05);
      }
    });
  }

  void _finish() {
    _trickleTimer?.cancel();
    _trickleTimer = null;
    setState(() => _progress = 100);
    _finishTimer = Timer(_finishHold, () {
      if (!mounted) return;
      setState(() => _visible = false);
      // Reset width after fade-out so the next request starts fresh.
      Timer(_fadeOut, () {
        if (!mounted) return;
        setState(() => _progress = 0);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Align(
        alignment: Alignment.topCenter,
        child: AnimatedOpacity(
          opacity: _visible ? 1 : 0,
          duration: _fadeOut,
          curve: Curves.easeOut,
          child: SizedBox(
            height: 2,
            width: double.infinity,
            child: LayoutBuilder(
              builder: (ctx, constraints) {
                return Stack(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOut,
                      width: constraints.maxWidth * (_progress / 100),
                      height: 2,
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.accent.withOpacity(0.6),
                            blurRadius: 8,
                            spreadRadius: 0,
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
