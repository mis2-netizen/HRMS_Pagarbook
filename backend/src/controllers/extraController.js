const { runQuery, getQuery, allQuery } = require('../config/db');

// ==========================================
// 1. Settings Controller
// ==========================================

const getSettings = async (req, res) => {
  const { companyId } = req.user;
  try {
    const company = await getQuery('SELECT * FROM companies WHERE companyId = ?', [companyId]);
    if (!company) {
      return res.status(404).json({ message: 'Company settings not found' });
    }
    return res.status(200).json({
      companyId: company.companyId,
      name: company.name,
      logoUrl: company.logoUrl,
      address: company.address,
      phone: company.phone,
      email: company.email,
      payrollSettings: JSON.parse(company.payrollSettings),
      attendanceSettings: JSON.parse(company.attendanceSettings)
    });
  } catch (err) {
    console.error('Get settings error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const updateSettings = async (req, res) => {
  const { companyId, userId } = req.user;
  const { name, address, phone, email, payrollSettings, attendanceSettings } = req.body;

  try {
    const existing = await getQuery('SELECT * FROM companies WHERE companyId = ?', [companyId]);
    if (!existing) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const payrollStr = payrollSettings ? JSON.stringify(payrollSettings) : existing.payrollSettings;
    const attendanceStr = attendanceSettings ? JSON.stringify(attendanceSettings) : existing.attendanceSettings;

    await runQuery(`
      UPDATE companies
      SET name = ?, address = ?, phone = ?, email = ?, payrollSettings = ?, attendanceSettings = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE companyId = ?
    `, [
      name || existing.name,
      address || existing.address,
      phone || existing.phone,
      email || existing.email,
      payrollStr,
      attendanceStr,
      companyId
    ]);

    // Audit log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue, newValue)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `LOG_${Date.now()}`, companyId, userId, 'UPDATE_SETTINGS', 'Settings',
      JSON.stringify(existing),
      JSON.stringify({ name, address, payrollSettings, attendanceSettings })
    ]);

    return res.status(200).json({ message: 'Company settings updated successfully' });
  } catch (err) {
    console.error('Update settings error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ==========================================
// 2. Audit Logs Controller
// ==========================================

const getAuditLogs = async (req, res) => {
  const { companyId } = req.user;
  try {
    const list = await allQuery(`
      SELECT al.*, u.name as userName, u.email as userEmail, u.role
      FROM auditLogs al
      JOIN users u ON al.userId = u.userId
      WHERE al.companyId = ?
      ORDER BY al.timestamp DESC
      LIMIT 100
    `, [companyId]);
    return res.status(200).json(list);
  } catch (err) {
    console.error('Get audit logs error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ==========================================
// 3. Notifications Controller
// ==========================================

const getNotifications = async (req, res) => {
  const { userId, companyId } = req.user;
  try {
    const list = await allQuery(`
      SELECT * FROM notifications
      WHERE userId = ? AND companyId = ?
      ORDER BY createdAt DESC
      LIMIT 50
    `, [userId, companyId]);
    return res.status(200).json(list);
  } catch (err) {
    console.error('Get notifications error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const markNotificationRead = async (req, res) => {
  const { companyId } = req.user;
  const { id } = req.params;
  try {
    await runQuery('UPDATE notifications SET read = 1 WHERE notificationId = ? AND companyId = ?', [id, companyId]);
    return res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Read notification error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ==========================================
// 4. Reports / Analytics Controller
// ==========================================

const getReportsData = async (req, res) => {
  const { companyId } = req.user;
  const { reportType, month, year, date } = req.query;

  const targetMonth = parseInt(month || new Date().getMonth() + 1, 10);
  const targetYear = parseInt(year || new Date().getFullYear(), 10);
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    // A. BRANCH-WISE SALARY COST
    if (reportType === 'branch-cost') {
      const data = await allQuery(`
        SELECT b.name as branchName, SUM(p.netSalary) as totalCost, COUNT(p.payrollId) as employeeCount
        FROM payroll p
        JOIN employees e ON p.employeeId = e.employeeId
        JOIN branches b ON e.branchId = b.branchId
        WHERE p.companyId = ? AND p.month = ? AND p.year = ?
        GROUP BY b.branchId
      `, [companyId, targetMonth, targetYear]);
      return res.status(200).json(data);
    }

    // B. DEPARTMENT-WISE ATTENDANCE RATE
    if (reportType === 'department-attendance') {
      const data = await allQuery(`
        SELECT d.name as departmentName,
               COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as presentCount,
               COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as absentCount,
               COUNT(CASE WHEN a.status = 'Half Day' THEN 1 END) as halfDayCount,
               COUNT(a.attendanceId) as totalLogs
        FROM attendance a
        JOIN employees e ON a.employeeId = e.employeeId
        JOIN departments d ON e.departmentId = d.departmentId
        WHERE a.companyId = ? AND a.date = ?
        GROUP BY d.departmentId
      `, [companyId, targetDate]);
      return res.status(200).json(data);
    }

    // C. OVERTIME HOURS & AMOUNT
    if (reportType === 'overtime') {
      const data = await allQuery(`
        SELECT e.employeeId, e.name as employeeName, SUM(a.overtimeHours) as totalOvertimeHours
        FROM attendance a
        JOIN employees e ON a.employeeId = e.employeeId
        WHERE a.companyId = ? AND a.date LIKE ? AND a.overtimeHours > 0
        GROUP BY e.employeeId
      `, [companyId, `${targetYear}-${targetMonth.toString().padStart(2, '0')}-%`]);
      return res.status(200).json(data);
    }

    // D. LATE COMERS REPORT
    if (reportType === 'late-coming') {
      const data = await allQuery(`
        SELECT e.employeeId, e.name as employeeName, COUNT(a.attendanceId) as lateDays, SUM(a.lateMinutes) as totalLateMinutes
        FROM attendance a
        JOIN employees e ON a.employeeId = e.employeeId
        WHERE a.companyId = ? AND a.date LIKE ? AND a.lateMinutes > 0
        GROUP BY e.employeeId
      `, [companyId, `${targetYear}-${targetMonth.toString().padStart(2, '0')}-%`]);
      return res.status(200).json(data);
    }

    // E. ADVANCE / DEDUCTIONS SUMMARY
    if (reportType === 'advances') {
      const data = await allQuery(`
        SELECT e.employeeId, e.name as employeeName, adj.type, SUM(adj.amount) as totalAmount
        FROM adjustments adj
        JOIN employees e ON adj.employeeId = e.employeeId
        WHERE adj.companyId = ? AND adj.applicableMonth = ? AND adj.applicableYear = ?
        GROUP BY e.employeeId, adj.type
      `, [companyId, targetMonth, targetYear]);
      return res.status(200).json(data);
    }

    // F. LEAVES SUMMARY
    if (reportType === 'leaves') {
      const data = await allQuery(`
        SELECT e.name as employeeName, lr.leaveType, lr.fromDate, lr.toDate, lr.totalDays, lr.status, lr.reason
        FROM leaveRequests lr
        JOIN employees e ON lr.employeeId = e.employeeId
        WHERE lr.companyId = ? AND lr.fromDate LIKE ?
      `, [companyId, `${targetYear}-${targetMonth.toString().padStart(2, '0')}-%`]);
      return res.status(200).json(data);
    }

    // G. GENERAL ANALYTICS FOR MAIN DASHBOARD COUNTS
    if (reportType === 'dashboard-metrics') {
      const present = await getQuery("SELECT COUNT(attendanceId) as count FROM attendance WHERE companyId = ? AND date = ? AND status = 'Present'", [companyId, targetDate]);
      const absent = await getQuery("SELECT COUNT(attendanceId) as count FROM attendance WHERE companyId = ? AND date = ? AND status = 'Absent'", [companyId, targetDate]);
      const late = await getQuery('SELECT COUNT(attendanceId) as count FROM attendance WHERE companyId = ? AND date = ? AND lateMinutes > 0', [companyId, targetDate]);
      const leaves = await getQuery("SELECT COUNT(attendanceId) as count FROM attendance WHERE companyId = ? AND date = ? AND status = 'Paid Leave'", [companyId, targetDate]);
      
      const pendingLeaves = await getQuery("SELECT COUNT(leaveId) as count FROM leaveRequests WHERE companyId = ? AND status = 'Pending'", [companyId]);
      const pendingCorrections = await getQuery("SELECT COUNT(attendanceId) as count FROM attendance WHERE companyId = ? AND correctionStatus = 'Pending'", [companyId]);
      const totalEmployees = await getQuery("SELECT COUNT(employeeId) as count FROM employees WHERE companyId = ? AND status = 'Active'", [companyId]);
      
      // Calculate current month's estimated payroll
      const monthlyPayroll = await getQuery('SELECT SUM(netSalary) as sum, COUNT(payrollId) as count FROM payroll WHERE companyId = ? AND month = ? AND year = ?', [companyId, targetMonth, targetYear]);

      return res.status(200).json({
        totalEmployees: totalEmployees.count || 0,
        presentToday: present.count || 0,
        absentToday: absent.count || 0,
        lateToday: late.count || 0,
        onLeaveToday: leaves.count || 0,
        pendingLeaveApprovals: pendingLeaves.count || 0,
        pendingCorrections: pendingCorrections.count || 0,
        monthlySalaryCost: monthlyPayroll.sum || 0,
        payrollCalculatedCount: monthlyPayroll.count || 0
      });
    }

    return res.status(400).json({ message: 'Invalid or missing reportType' });
  } catch (err) {
    console.error('Fetch reports error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getAuditLogs,
  getNotifications,
  markNotificationRead,
  getReportsData
};
