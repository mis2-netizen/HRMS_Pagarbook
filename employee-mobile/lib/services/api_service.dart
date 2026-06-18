import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import '../models/models.dart';
import '../config/env.dart';

class ApiService {
  static const String baseUrl = Env.apiUrl;


  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  // Login
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      await prefs.setString('userId', data['user']['userId']);
      await prefs.setString('employeeId', data['user']['employeeId'] ?? '');
    }
    return data;
  }

  // Get Today Punch Status
  static Future<Map<String, dynamic>> getTodayPunchStatus() async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/attendance/today'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return jsonDecode(response.body);
  }

  // Punch In with Selfie
  static Future<Map<String, dynamic>> punchIn({
    required double latitude,
    required double longitude,
    required String address,
    required String selfiePath,
    required String deviceId,
  }) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/attendance/punch-in');
    
    final request = http.MultipartRequest('POST', uri);
    request.headers['Authorization'] = 'Bearer $token';
    
    request.fields['latitude'] = latitude.toString();
    request.fields['longitude'] = longitude.toString();
    request.fields['address'] = address;
    request.fields['deviceId'] = deviceId;
    
    if (selfiePath.isNotEmpty) {
      request.files.add(await http.MultipartFile.fromPath('photo', selfiePath));
    }

    final response = await request.send();
    final responseData = await response.stream.bytesToString();
    return jsonDecode(responseData);
  }

  // Punch Out
  static Future<Map<String, dynamic>> punchOut({
    required double latitude,
    required double longitude,
    required String address,
    required String selfiePath,
    required String deviceId,
  }) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/attendance/punch-out');
    
    final request = http.MultipartRequest('POST', uri);
    request.headers['Authorization'] = 'Bearer $token';
    
    request.fields['latitude'] = latitude.toString();
    request.fields['longitude'] = longitude.toString();
    request.fields['address'] = address;
    request.fields['deviceId'] = deviceId;
    
    if (selfiePath.isNotEmpty) {
      request.files.add(await http.MultipartFile.fromPath('photo', selfiePath));
    }

    final response = await request.send();
    final responseData = await response.stream.bytesToString();
    return jsonDecode(responseData);
  }

  // Fetch Leave Balances
  static Future<List<LeaveBalance>> getLeaveBalances() async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/leaves/balances'),
      headers: {'Authorization': 'Bearer $token'},
    );

    if (response.statusCode == 200) {
      final List<dynamic> list = jsonDecode(response.body);
      return list.map((json) => LeaveBalance.fromJson(json)).toList();
    }
    return [];
  }

  // Apply Leave
  static Future<Map<String, dynamic>> applyLeave({
    required String leaveType,
    required String fromDate,
    required String toDate,
    required double totalDays,
    required String reason,
  }) async {
    final token = await _getToken();
    final response = await http.post(
      Uri.parse('$baseUrl/leaves/apply'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'leaveType': leaveType,
        'fromDate': fromDate,
        'toDate': toDate,
        'totalDays': totalDays,
        'reason': reason,
      }),
    );
    return jsonDecode(response.body);
  }

  // Download Salary Slip PDF
  static Future<String?> downloadSalarySlip(String payrollId) async {
    final token = await _getToken();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/payroll/$payrollId/slip'),
        headers: {'Authorization': 'Bearer $token'},
      );

      if (response.statusCode == 200) {
        final dir = await getApplicationDocumentsDirectory();
        final filePath = '${dir.path}/Payslip_$payrollId.pdf';
        final file = File(filePath);
        await file.writeAsBytes(response.bodyBytes);
        return filePath;
      }
    } catch (e) {
      print('Download slip error: $e');
    }
    return null;
  }

  // Fetch Full Employee Dashboard Details (History, Slips, Leaves, Attendance)
  static Future<Map<String, dynamic>> getEmployeeDashboard(String employeeId) async {
    final token = await _getToken();
    final response = await http.get(
      Uri.parse('$baseUrl/employees/$employeeId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception(jsonDecode(response.body)['message'] ?? 'Failed to load dashboard data');
  }
}

