import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class ApiException implements Exception {
  final String code;
  final String message;
  final int statusCode;

  ApiException(this.code, this.message, this.statusCode);

  @override
  String toString() => 'ApiException($statusCode): [$code] $message';
}

class ApiService {
  ApiService._();
  static final ApiService instance = ApiService._();

  final String _baseUrl = AppConfig.apiBaseUrl;
  String? _token;

  /// Public ValueNotifier exposing the number of in-flight HTTP
  /// requests currently going through this service. Mirrors the
  /// `api:inflight` CustomEvent the web app dispatches from
  /// `frontend/src/lib/api.ts` so a single thin progress bar
  /// (widgets/global_progress_bar.dart) can give the user visible
  /// feedback whenever any button click triggers an API call —
  /// no per-screen `_submitting` plumbing required.
  ///
  /// Increments before every fetch in `get/post/patch/delete`, and
  /// decrements in a `finally` so errors and 4xx/5xx responses don't
  /// strand the indicator.
  final ValueNotifier<int> inflightCount = ValueNotifier<int>(0);

  void setToken(String token) {
    _token = token;
  }

  void clearToken() {
    _token = null;
  }

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Uri _buildUri(String path) {
    return Uri.parse('$_baseUrl$path');
  }

  void _startInflight() {
    inflightCount.value = inflightCount.value + 1;
  }

  void _endInflight() {
    final next = inflightCount.value - 1;
    inflightCount.value = next < 0 ? 0 : next;
  }

  dynamic _handleResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (body.containsKey('error') && body['error'] != null) {
        final error = body['error'];
        throw ApiException(
          error['code']?.toString() ?? 'UNKNOWN_ERROR',
          error['message']?.toString() ?? 'An unknown error occurred',
          response.statusCode,
        );
      }
      return body['data'];
    }

    final error = body['error'];
    if (error != null && error is Map<String, dynamic>) {
      throw ApiException(
        error['code']?.toString() ?? 'ERROR',
        error['message']?.toString() ?? 'Request failed',
        response.statusCode,
      );
    }

    throw ApiException(
      'HTTP_${response.statusCode}',
      body['message']?.toString() ?? 'Request failed with status ${response.statusCode}',
      response.statusCode,
    );
  }

  Future<dynamic> get(String path) async {
    _startInflight();
    try {
      final response = await http.get(
        _buildUri(path),
        headers: _headers,
      );
      return _handleResponse(response);
    } finally {
      _endInflight();
    }
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    _startInflight();
    try {
      final response = await http.post(
        _buildUri(path),
        headers: _headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _handleResponse(response);
    } finally {
      _endInflight();
    }
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    _startInflight();
    try {
      final response = await http.patch(
        _buildUri(path),
        headers: _headers,
        body: body != null ? jsonEncode(body) : null,
      );
      return _handleResponse(response);
    } finally {
      _endInflight();
    }
  }

  Future<dynamic> delete(String path) async {
    _startInflight();
    try {
      final response = await http.delete(
        _buildUri(path),
        headers: _headers,
      );
      return _handleResponse(response);
    } finally {
      _endInflight();
    }
  }
}
