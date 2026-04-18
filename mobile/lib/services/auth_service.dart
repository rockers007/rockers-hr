import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/user_model.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final ApiService _api = ApiService.instance;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  static const String _tokenKey = 'auth_token';

  User? _currentUser;
  bool _isLoading = false;
  String? _token;

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null && _token != null;
  bool get isLoading => _isLoading;
  String? get token => _token;

  Future<void> signInWithGoogle() async {
    _isLoading = true;
    notifyListeners();

    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw ApiException('SIGN_IN_CANCELLED', 'Google sign-in was cancelled', 0);
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null) {
        throw ApiException('NO_ID_TOKEN', 'Failed to obtain Google ID token', 0);
      }

      final data = await _api.post('/auth/google/callback', body: {
        'idToken': idToken,
      });

      final jwt = data['token'] as String;
      _token = jwt;
      _api.setToken(jwt);
      await _storage.write(key: _tokenKey, value: jwt);

      await fetchUser();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> tryRestoreSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      final storedToken = await _storage.read(key: _tokenKey);
      if (storedToken == null) return;

      _token = storedToken;
      _api.setToken(storedToken);

      await fetchUser();
    } catch (_) {
      // Token is invalid or expired — clear everything
      await _clearState();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchUser() async {
    final data = await _api.get('/users/me');
    _currentUser = User.fromJson(data as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // Best-effort — proceed with local cleanup regardless
    }

    await _clearState();
    await _googleSignIn.signOut();

    _isLoading = false;
    notifyListeners();
  }

  Future<void> registerFcmToken(String fcmToken) async {
    await _api.patch('/users/me/fcm-token', body: {
      'fcmToken': fcmToken,
    });
  }

  Future<void> _clearState() async {
    _token = null;
    _currentUser = null;
    _api.clearToken();
    await _storage.delete(key: _tokenKey);
  }
}
