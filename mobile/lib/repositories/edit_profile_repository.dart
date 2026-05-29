import '../models/user_model.dart';
import '../services/api_service.dart';

class EditProfileRepository {
  Future<ProfileDetail> loadProfile() async {
    final data =
        await ApiService.instance.get('/users/me') as Map<String, dynamic>;
    return ProfileDetail.fromJson(data);
  }

  Future<List<Map<String, dynamic>>> loadMaritalStatuses() async {
    final data = await ApiService.instance.get('/master/marital_statuses');
    if (data is List) return data.cast<Map<String, dynamic>>();
    return const [];
  }
}
