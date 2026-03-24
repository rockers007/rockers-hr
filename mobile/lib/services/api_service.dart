import 'dart:convert';
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
    final response = await http.get(
      _buildUri(path),
      headers: _headers,
    );
    return _handleResponse(response);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final response = await http.post(
      _buildUri(path),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    final response = await http.patch(
      _buildUri(path),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<dynamic> delete(String path) async {
    final response = await http.delete(
      _buildUri(path),
      headers: _headers,
    );
    return _handleResponse(response);
  }
}
