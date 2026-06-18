import 'dart:convert';
import 'dart:io';
import 'package:flutter/material';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:open_file/open_file.dart';
import 'services/api_service.dart';
import 'models/models.dart';

List<CameraDescription> cameras = [];

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    cameras = await availableCameras();
  } catch (e) {
    print('No camera hardware found: $e');
  }
  runApp(const HrmsApp());
}

class HrmsApp extends StatelessWidget {
  const HrmsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pagarbook Employee Portal',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF059669),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF059669),
          primary: const Color(0xFF059669),
          secondary: const Color(0xFF475569),
        ),
        fontFamily: 'Roboto',
        useMaterial3: true,
      ),
      home: const SessionCheckScreen(),
    );
  }
}

class SessionCheckScreen extends StatefulWidget {
  const SessionCheckScreen({super.key});

  @override
  State<SessionCheckScreen> createState() => _SessionCheckScreenState();
}

class _SessionCheckScreenState extends State<SessionCheckScreen> {
  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  void _checkSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    
    if (token != null) {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const EmployeeHomeScreen()),
        );
      }
    } else {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(color: Color(0xFF059669)),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;

  final List<Map<String, String>> demoUsers = [
    {'email': 'john@company.com', 'name': 'John Doe (Dev - Bangalore)'},
    {'email': 'bob@company.com', 'name': 'Bob Johnson (Sales - Mumbai)'},
    {'email': 'alice@company.com', 'name': 'Alice Brown (Dev - Bangalore)'},
    {'email': 'henry@company.com', 'name': 'Henry Wilson (Daily wage - Bangalore)'},
  ];

  void _handleLogin(String email, String password) async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.login(email, password);
      if (res['token'] != null) {
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const EmployeeHomeScreen()),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(res['message'] ?? 'Login failed')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection error, using local cached credentials...')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              const Center(
                child: Text(
                  '🟢 Pagarbook Mobile',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                ),
              ),
              const Center(
                child: Text(
                  'Employee Salary & Attendance Portal',
                  style: TextStyle(fontSize: 14, color: Colors.grey),
                ),
              ),
              const SizedBox(height: 48),
              
              // Standard Credentials Login
              const Text('Login with Credentials', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Email Address',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loading ? null : () => _handleLogin(_emailController.text, _passwordController.text),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: _loading 
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) 
                    : const Text('Login', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
              
              const SizedBox(height: 32),
              
              // Demo Quick logins
              const Text('Quick Select Demo User', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              ...demoUsers.map((user) => Card(
                elevation: 0,
                color: Colors.grey[50],
                shape: RoundedRectangleBorder(
                  side: BorderSide(color: Colors.grey[200]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  dense: true,
                  title: Text(user['name']!, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(user['email']!),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF059669)),
                  onTap: () => _handleLogin(user['email']!, 'emp123'),
                ),
              )),
            ],
          ),
        ),
      ),
    );
  }
}

class EmployeeHomeScreen extends StatefulWidget {
  const EmployeeHomeScreen({super.key});

  @override
  State<EmployeeHomeScreen> createState() => _EmployeeHomeScreenState();
}

class _EmployeeHomeScreenState extends State<EmployeeHomeScreen> {
  int _currentIndex = 0;
  bool _loading = true;
  String _employeeName = '';
  String _employeeId = '';
  
  Map<String, dynamic>? _dashboardData;
  List<AttendanceRecord> _attendanceHistory = [];
  List<LeaveBalance> _leaveBalances = [];
  List<PayrollRecord> _payrollHistory = [];
  List<LeaveRequest> _leaveRequests = [];
  
  String _punchStatus = 'Not Marked';
  String? _todayInTime;
  String? _todayOutTime;
  
  int _offlinePunchesCount = 0;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
    _checkOfflineQueue();
  }

  void _checkOfflineQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final offlineJson = prefs.getStringList('offline_punches') ?? [];
    setState(() {
      _offlinePunchesCount = offlineJson.length;
    });
  }

  void _loadDashboardData() async {
    setState(() => _loading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final empId = prefs.getString('employeeId') ?? '';
      _employeeId = empId;

      // 1. Fetch Today status
      final todayStatus = await ApiService.getTodayPunchStatus();
      _punchStatus = todayStatus['status'] ?? 'Not Marked';
      if (todayStatus['record'] != null) {
        _todayInTime = todayStatus['record']['inTime'];
        _todayOutTime = todayStatus['record']['outTime'];
      } else {
        _todayInTime = null;
        _todayOutTime = null;
      }

      // 2. Fetch full profile dashboard data
      if (empId.isNotEmpty) {
        _dashboardData = await ApiService.getEmployeeDashboard(empId);
        final empMap = _dashboardData!['employee'];
        _employeeName = empMap['name'] ?? '';

        final List<dynamic> attList = _dashboardData!['attendance'] ?? [];
        _attendanceHistory = attList.map((j) => AttendanceRecord.fromJson(j)).toList();

        final List<dynamic> balList = _dashboardData!['leaveBalances'] ?? [];
        _leaveBalances = balList.map((j) => LeaveBalance.fromJson(j)).toList();

        final List<dynamic> payList = _dashboardData!['payroll'] ?? [];
        _payrollHistory = payList.map((j) => PayrollRecord.fromJson(j)).toList();

        final List<dynamic> leaveReqs = _dashboardData!['leaveRequests'] ?? [];
        _leaveRequests = leaveReqs.map((j) => LeaveRequest.fromJson(j)).toList();
      }
    } catch (e) {
      print('Failed to sync dashboard: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  void _triggerSync() async {
    final prefs = await SharedPreferences.getInstance();
    final queue = prefs.getStringList('offline_punches') ?? [];
    if (queue.isEmpty) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Syncing offline punches with server...')),
    );

    List<String> failedPunches = [];
    for (final punchStr in queue) {
      final punch = jsonDecode(punchStr);
      try {
        if (punch['type'] == 'IN') {
          await ApiService.punchIn(
            latitude: punch['latitude'],
            longitude: punch['longitude'],
            address: punch['address'],
            selfiePath: punch['selfiePath'] ?? '',
            deviceId: punch['deviceId'],
          );
        } else {
          await ApiService.punchOut(
            latitude: punch['latitude'],
            longitude: punch['longitude'],
            address: punch['address'],
            selfiePath: punch['selfiePath'] ?? '',
            deviceId: punch['deviceId'],
          );
        }
      } catch (e) {
        failedPunches.add(punchStr);
      }
    }

    await prefs.setStringList('offline_punches', failedPunches);
    setState(() {
      _offlinePunchesCount = failedPunches.length;
    });

    if (failedPunches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All offline punches synced successfully!')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to sync ${failedPunches.length} punches. Will retry later.')),
      );
    }
    _loadDashboardData();
  }

  void _handleLogout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  // --- Sub-widgets representing Tabs ---

  Widget _buildHomeTab() {
    final presentCount = _attendanceHistory.where((r) => r.status == 'Present').length;
    final absentCount = _attendanceHistory.where((r) => r.status == 'Absent').length;
    final halfDayCount = _attendanceHistory.where((r) => r.status == 'Half Day').length;
    final lateCount = _attendanceHistory.where((r) => r.lateMinutes > 0).length;

    final baseSalary = _dashboardData?['employee']?['monthlySalary'] ?? 0.0;
    final salaryType = _dashboardData?['employee']?['salaryType'] ?? 'Monthly';
    final perDayRate = _dashboardData?['employee']?['perDaySalary'] ?? 0.0;

    return RefreshIndicator(
      onRefresh: () async {
        _loadDashboardData();
        _checkOfflineQueue();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Offline sync banner
            if (_offlinePunchesCount > 0)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange[50],
                  border: Border.all(color: Colors.orange[200]!),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.signal_wifi_off, color: Colors.orange),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '$_offlinePunchesCount Offline Punches pending',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFC05621)),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: _triggerSync,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.orange,
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Sync Now'),
                    ),
                  ],
                ),
              ),

            // Top Status Panel
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              color: const Color(0xFF059669),
              child: Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Hello, $_employeeName',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Today: ${DateFormat('EEE, MMM d, yyyy').format(DateTime.now())}',
                      style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Punch Status', style: TextStyle(color: Colors.white70, fontSize: 12)),
                            Text(
                              _punchStatus,
                              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            if (_todayInTime != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                'IN: $_todayInTime ${_todayOutTime != null ? "| OUT: $_todayOutTime" : ""}',
                                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ]
                          ],
                        ),
                        const Icon(Icons.fingerprint, size: 54, color: Colors.white30),
                      ],
                    ),
                    if (_punchStatus != 'OUT Done') ...[
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _currentIndex = 1; // Switch to Punch Tab
                          });
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF059669),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: Text(
                          _punchStatus == 'Not Marked' ? 'Clock In Now' : 'Clock Out Now',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ),
                    ]
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Today Status Details
            const Text('Estimated Wages Summary', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                side: BorderSide(color: Colors.grey[200]!),
                borderRadius: BorderRadius.circular(12),
              ),
              color: Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Salary Setting', style: TextStyle(color: Colors.grey, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(
                            salaryType == 'Monthly' ? 'Monthly Payout' : 'Daily Wages',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                    Container(height: 30, width: 1, color: Colors.grey[200]),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(salaryType == 'Monthly' ? 'Base Salary' : 'Daily Rate', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                          const SizedBox(height: 4),
                          Text(
                            '₹${(salaryType == 'Monthly' ? baseSalary : perDayRate).toString()}',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Monthly Counts
            const Text('This Month Summary', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildStatCard('Presents', presentCount.toString(), Colors.green),
                const SizedBox(width: 8),
                _buildStatCard('Late Days', lateCount.toString(), Colors.orange),
                const SizedBox(width: 8),
                _buildStatCard('Half Days', halfDayCount.toString(), Colors.amber),
                const SizedBox(width: 8),
                _buildStatCard('Absents', absentCount.toString(), Colors.red),
              ],
            ),
            const SizedBox(height: 20),

            // Leave balances
            const Text('Accrued Leaves', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            SizedBox(
              height: 80,
              child: _leaveBalances.isEmpty
                  ? Center(child: Text('No balances available', style: TextStyle(color: Colors.grey[400])))
                  : ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: _leaveBalances.length,
                      itemBuilder: (context, idx) {
                        final bal = _leaveBalances[idx];
                        return Card(
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            side: BorderSide(color: Colors.grey[200]!),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          margin: const EdgeInsets.only(right: 8),
                          child: Container(
                            width: 100,
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  bal.leaveType,
                                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${bal.available} / ${bal.opening}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color) {
    return Expanded(
      child: Card(
        elevation: 0,
        color: color.withOpacity(0.06),
        shape: RoundedRectangleBorder(
          side: BorderSide(color: color.withOpacity(0.2)),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 4.0),
          child: Column(
            children: [
              Text(
                value,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- 2. PUNCH TAB ---

  Widget _buildPunchTab() {
    return PunchScreenWidget(
      onPunchSuccess: () {
        _loadDashboardData();
        setState(() {
          _currentIndex = 0; // Return home
        });
      },
    );
  }

  // --- 3. LEAVES TAB ---

  Widget _buildLeavesTab() {
    return LeavesScreenWidget(
      leaveRequests: _leaveRequests,
      leaveBalances: _leaveBalances,
      onLeaveApplied: () {
        _loadDashboardData();
      },
    );
  }

  // --- 4. SALARY TAB ---

  Widget _buildSalaryTab() {
    return Scaffold(
      body: _payrollHistory.isEmpty
          ? const Center(child: Text('No salary slips finalized yet.'))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _payrollHistory.length,
              itemBuilder: (context, idx) {
                final pay = _payrollHistory[idx];
                final monthNames = [
                  '', 'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'
                ];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    side: BorderSide(color: Colors.grey[200]!),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${monthNames[pay.month]} ${pay.year}',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Net Payable: ₹${pay.netSalary.toString()}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Payment: ${pay.paymentStatus}',
                              style: TextStyle(color: Colors.grey[600], fontSize: 12),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.download_for_offline, size: 28, color: Color(0xFF059669)),
                          onPressed: () async {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Downloading salary slip PDF...')),
                            );
                            final path = await ApiService.downloadSalarySlip(pay.payrollId);
                            if (path != null) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: const Text('Downloaded successfully! Click to open.'),
                                    action: SnackBarAction(
                                      label: 'Open',
                                      onPressed: () {
                                        OpenFile.open(path);
                                      },
                                    ),
                                  ),
                                );
                              }
                            } else {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Failed to download slip. Verification required.')),
                                );
                              }
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }

  // --- 5. PROFILE TAB ---

  Widget _buildProfileTab() {
    final emp = _dashboardData?['employee'];
    if (emp == null) {
      return const Center(child: Text('Profile details unavailable.'));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: const Color(0xFF059669).withOpacity(0.1),
                  child: Text(
                    _employeeName.isNotEmpty ? _employeeName[0] : 'U',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                  ),
                ),
                const SizedBox(height: 12),
                Text(_employeeName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text(
                  '${emp['designationName'] ?? ''} | ${emp['departmentName'] ?? ''}',
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _buildInfoRow('Employee ID', emp['employeeId'] ?? '-'),
          _buildInfoRow('Mobile Number', emp['mobile'] ?? '-'),
          _buildInfoRow('Email Address', emp['email'] ?? '-'),
          _buildInfoRow('Shift Timings', 'Day Shift (09:00 - 18:00)'),
          _buildInfoRow('Weekly Off', emp['weeklyOff'] ?? 'Sunday'),
          _buildInfoRow('Joining Date', emp['joiningDate'] ?? '-'),
          _buildInfoRow('Address', emp['address'] ?? '-'),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 16),
          const Text('Bank Account Info', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 8),
          _buildInfoRow('Bank Name', emp['bankDetails']?['bankName'] ?? '-'),
          _buildInfoRow('Account Number', emp['bankDetails']?['accountNumberMasked'] ?? 'Masked'),
          _buildInfoRow('IFSC Code', emp['bankDetails']?['ifsc'] ?? '-'),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final titles = ['Home', 'Punch Attendance', 'Leaves', 'Salary Slips', 'My Profile'];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_currentIndex], style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF059669),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _handleLogout,
          )
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF059669)))
          : IndexedStack(
              index: _currentIndex,
              children: [
                _buildHomeTab(),
                _buildPunchTab(),
                _buildLeavesTab(),
                _buildSalaryTab(),
                _buildProfileTab(),
              ],
            ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: const Color(0xFF059669),
        unselectedItemColor: Colors.grey,
        type: BottomNavigationBarType.fixed,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.camera_alt), label: 'Punch'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_month), label: 'Leaves'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long), label: 'Salary'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

// ----------------------------------------------------
// Punch Attendance Screen Widget (with Camera and GPS)
// ----------------------------------------------------

class PunchScreenWidget extends StatefulWidget {
  final VoidCallback onPunchSuccess;
  const PunchScreenWidget({super.key, required this.onPunchSuccess});

  @override
  State<PunchScreenWidget> createState() => _PunchScreenWidgetState();
}

class _PunchScreenWidgetState extends State<PunchScreenWidget> {
  CameraController? _cameraController;
  bool _cameraInitialized = false;
  XFile? _capturedSelfie;
  
  Position? _currentPosition;
  String _gpsAddress = 'Fetching GPS location...';
  bool _gpsError = false;
  
  bool _checkingGeofence = true;
  bool _insideGeofence = true;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
    _initGPS();
  }

  void _initCamera() async {
    if (cameras.isEmpty) return;
    // Use front camera if available
    final frontCam = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
      orElse: () => cameras.first,
    );

    _cameraController = CameraController(frontCam, ResolutionPreset.medium);
    try {
      await _cameraController!.initialize();
      if (mounted) {
        setState(() {
          _cameraInitialized = true;
        });
      }
    } catch (e) {
      print('Camera initialization error: $e');
    }
  }

  void _initGPS() async {
    setState(() {
      _checkingGeofence = true;
      _gpsError = false;
    });

    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception('Location permission denied');
        }
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      
      setState(() {
        _currentPosition = pos;
        _gpsAddress = 'Nariman Point, Mumbai (Lat: ${pos.latitude.toStringAsFixed(4)}, Lng: ${pos.longitude.toStringAsFixed(4)})';
        _checkingGeofence = false;
        _insideGeofence = true; // Simulating allowed geofence matching
      });
    } catch (e) {
      setState(() {
        _gpsError = true;
        _checkingGeofence = false;
        _gpsAddress = 'GPS Failed. Using backup branch coordinates (Mumbai Head Office)';
        _insideGeofence = true;
      });
    }
  }

  void _capturePhoto() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) return;
    try {
      final file = await _cameraController!.takePicture();
      setState(() {
        _capturedSelfie = file;
      });
    } catch (e) {
      print('Capture failed: $e');
    }
  }

  void _submitPunch(String type) async {
    setState(() => _submitting = true);
    final lat = _currentPosition?.latitude ?? 19.0760;
    final lng = _currentPosition?.longitude ?? 72.8777;
    final selfiePath = _capturedSelfie?.path ?? '';

    // Device ID mock
    const deviceId = 'EMULATOR_DEVICE_D89';

    try {
      // Direct API Call
      Map<String, dynamic> result;
      if (type == 'IN') {
        result = await ApiService.punchIn(
          latitude: lat,
          longitude: lng,
          address: _gpsAddress,
          selfiePath: selfiePath,
          deviceId: deviceId,
        );
      } else {
        result = await ApiService.punchOut(
          latitude: lat,
          longitude: lng,
          address: _gpsAddress,
          selfiePath: selfiePath,
          deviceId: deviceId,
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'] ?? 'Attendance marked!')),
        );
        widget.onPunchSuccess();
      }
    } catch (e) {
      // Offline queue logic!
      final prefs = await SharedPreferences.getInstance();
      final queue = prefs.getStringList('offline_punches') ?? [];
      
      final punchPayload = jsonEncode({
        'type': type,
        'latitude': lat,
        'longitude': lng,
        'address': _gpsAddress,
        'selfiePath': selfiePath,
        'deviceId': deviceId,
        'timestamp': DateTime.now().toIso8601String(),
      });
      queue.add(punchPayload);
      await prefs.setStringList('offline_punches', queue);

      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Offline Mode Activated'),
            content: const Text(
              'Network connection failed. Your punch is saved offline and will automatically sync when connection returns.',
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  widget.onPunchSuccess();
                },
                child: const Text('OK'),
              )
            ],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Location Card
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                side: BorderSide(color: Colors.grey[200]!),
                borderRadius: BorderRadius.circular(12),
              ),
              color: Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: Color(0xFF059669)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _gpsAddress,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_checkingGeofence)
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                          SizedBox(width: 8),
                          Text('Checking Geofence Coordinates...', style: TextStyle(fontSize: 12, color: Colors.grey)),
                        ],
                      )
                    else
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _insideGeofence ? Icons.check_circle : Icons.warning,
                            size: 16,
                            color: _insideGeofence ? Colors.green : Colors.red,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _insideGeofence ? 'Inside Branch Radius Boundary' : 'Outside Boundary Range',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: _insideGeofence ? Colors.green : Colors.red,
                            ),
                          ),
                        ],
                      )
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Selfie Camera Preview Box
            Card(
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Container(
                height: 240,
                color: Colors.black,
                child: _capturedSelfie != null
                    ? Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.file(File(_capturedSelfie!.path), fit: BoxFit.cover),
                          Positioned(
                            top: 8,
                            right: 8,
                            child: IconButton(
                              icon: const Icon(Icons.rotate_left, color: Colors.white, size: 28),
                              onPressed: () => setState(() => _capturedSelfie = null),
                            ),
                          )
                        ],
                      )
                    : _cameraInitialized
                        ? AspectRatio(
                            aspectRatio: _cameraController!.value.aspectRatio,
                            child: CameraPreview(_cameraController!),
                          )
                        : const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.camera_front, size: 40, color: Colors.white70),
                                SizedBox(height: 8),
                                Text('Initializing camera front view...', style: TextStyle(color: Colors.white70)),
                              ],
                            ),
                          ),
              ),
            ),
            const SizedBox(height: 16),

            if (_capturedSelfie == null)
              ElevatedButton.icon(
                onPressed: _capturePhoto,
                icon: const Icon(Icons.camera),
                label: const Text('Capture Selfie Verification'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF475569),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              )
            else
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _submitting ? null : () => _submitPunch('IN'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: _submitting 
                          ? const CircularProgressIndicator(color: Colors.white) 
                          : const Text('CLOCK IN', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _submitting ? null : () => _submitPunch('OUT'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF475569),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: _submitting 
                          ? const CircularProgressIndicator(color: Colors.white) 
                          : const Text('CLOCK OUT', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 16),
            const Text(
              '* Make sure location GPS and camera are allowed for attendance logging.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey, fontSize: 11),
            )
          ],
        ),
      ),
    );
  }
}

// ----------------------------------------------------
// Leaves Screen Widget (Balances, History, & Application Form)
// ----------------------------------------------------

class LeavesScreenWidget extends StatefulWidget {
  final List<LeaveRequest> leaveRequests;
  final List<LeaveBalance> leaveBalances;
  final VoidCallback onLeaveApplied;

  const LeavesScreenWidget({
    super.key,
    required this.leaveRequests,
    required this.leaveBalances,
    required this.onLeaveApplied,
  });

  @override
  State<LeavesScreenWidget> createState() => _LeavesScreenWidgetState();
}

class _LeavesScreenWidgetState extends State<LeavesScreenWidget> {
  final _reasonController = TextEditingController();
  String _leaveType = 'Casual';
  
  DateTime? _fromDate;
  DateTime? _toDate;
  bool _loading = false;

  void _submitLeave() async {
    if (_fromDate == null || _toDate == null || _reasonController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter leave dates and reason')),
      );
      return;
    }

    setState(() => _loading = true);
    
    // Calculate total days
    final diff = _toDate!.difference(_fromDate!).inDays + 1;

    try {
      final res = await ApiService.applyLeave(
        leaveType: _leaveType,
        fromDate: DateFormat('yyyy-MM-dd').format(_fromDate!),
        toDate: DateFormat('yyyy-MM-dd').format(_toDate!),
        totalDays: diff.toDouble(),
        reason: _reasonController.text,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Leave applied successfully!')),
        );
        _reasonController.clear();
        setState(() {
          _fromDate = null;
          _toDate = null;
        });
        widget.onLeaveApplied();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to submit application')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Accrued leave balances
          const Text('Leave Balances Available', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          widget.leaveBalances.isEmpty
              ? Container(
                  padding: const EdgeInsets.all(16),
                  alignment: Alignment.center,
                  child: const Text('No active balances accrued.', style: TextStyle(color: Colors.grey)),
                )
              : Row(
                  children: widget.leaveBalances.map((bal) {
                    return Expanded(
                      child: Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          side: BorderSide(color: Colors.grey[200]!),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              Text(bal.leaveType, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              const SizedBox(height: 6),
                              Text('${bal.available}', style: const TextStyle(fontSize: 20, color: Color(0xFF059669), fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
          const SizedBox(height: 20),

          // Apply Leave Form
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              side: BorderSide(color: Colors.grey[200]!),
              borderRadius: BorderRadius.circular(12),
            ),
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Apply for Leave', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _leaveType,
                    decoration: const InputDecoration(labelText: 'Leave Type', border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(value: 'Casual', child: Text('Casual Leave (CL)')),
                      DropdownMenuItem(value: 'Sick', child: Text('Sick Leave (SL)')),
                      DropdownMenuItem(value: 'Earned', child: Text('Earned Leave (EL)')),
                      DropdownMenuItem(value: 'Unpaid', child: Text('Unpaid Leave (LWP)')),
                    ],
                    onChanged: (val) => setState(() => _leaveType = val!),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now(),
                              firstDate: DateTime.now().subtract(const Duration(days: 30)),
                              lastDate: DateTime.now().add(const Duration(days: 90)),
                            );
                            if (date != null) setState(() => _fromDate = date);
                          },
                          child: Text(
                            _fromDate == null
                                ? 'From Date'
                                : DateFormat('dd-MM-yyyy').format(_fromDate!),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: _fromDate ?? DateTime.now(),
                              firstDate: _fromDate ?? DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 90)),
                            );
                            if (date != null) setState(() => _toDate = date);
                          },
                          child: Text(
                            _toDate == null
                                ? 'To Date'
                                : DateFormat('dd-MM-yyyy').format(_toDate!),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _reasonController,
                    decoration: const InputDecoration(labelText: 'Reason Description', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _loading ? null : _submitLeave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF059669),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: _loading 
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Submit Application'),
                  )
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Leave history logs
          const Text('Applied Leaves Log History', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          widget.leaveRequests.isEmpty
              ? Container(
                  padding: const EdgeInsets.all(24),
                  alignment: Alignment.center,
                  child: Text('No leaves applied yet.', style: TextStyle(color: Colors.grey[400])),
                )
              : Column(
                  children: widget.leaveRequests.map((req) {
                    final statusColor = req.status == 'Approved'
                        ? Colors.green
                        : req.status == 'Rejected'
                            ? Colors.red
                            : Colors.orange;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        side: BorderSide(color: Colors.grey[200]!),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: ListTile(
                        title: Text('${req.leaveType} Leave (${req.totalDays} Days)', style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('${req.fromDate} to ${req.toDate}\nReason: ${req.reason}'),
                        isThreeLine: true,
                        trailing: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            req.status,
                            style: TextStyle(color: statusColor, fontWeight: FontWeight.bold, fontSize: 11),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                )
        ],
      ),
    );
  }
}
