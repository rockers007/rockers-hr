import 'dart:io';

class AppConfig {
  // iOS simulator can reach the host via localhost; Android emulator needs
  // 10.0.2.2; a physical device needs the host's LAN IP set via --dart-define
  // API_BASE_URL=http://192.168.x.x:4000/api/v1 at build time.
  static const String _envUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: '');

  static String get apiBaseUrl {
    if (_envUrl.isNotEmpty) return _envUrl;
    if (Platform.isAndroid) return 'http://10.0.2.2:4000/api/v1';
    return 'http://localhost:4000/api/v1';
  }
  static const String appName = 'Rockers HR';

  // Google OAuth
  static const String googleClientId = '';

  // Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);

  // Pagination
  static const int defaultPageSize = 20;
}
