class AppConfig {
  static const String apiBaseUrl = 'http://localhost:4000/api/v1';
  static const String appName = 'Rockers HR';

  // Google OAuth
  static const String googleClientId = '';

  // Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);

  // Pagination
  static const int defaultPageSize = 20;
}
