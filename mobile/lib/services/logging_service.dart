import 'dart:developer';

import 'package:flutter/foundation.dart';

enum LogType { info, success, error }

void showLog(String message, {LogType type = LogType.info}) {
  if (kDebugMode) {
    switch (type) {
      case LogType.info:
        log(message);
        break;
      case LogType.success:
        log('\x1B[32m$message\x1B[0m');
        break;
      case LogType.error:
        log('\x1B[31m$message\x1B[0m');
        break;
    }
  }
}