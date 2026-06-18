const { runQuery, getQuery, allQuery } = require('../config/db');

// Helper to get dates between start and end
const getDatesInRange = (startDate, endDate) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

// GET /api/leaves/balances - Get current employee's leave balances
const getEmployeeLeaveBalances = async (req, res) => {
  const { employeeId } = req.user;
  try {
    const balances = await allQuery('SELECT * FROM leaveBalances WHERE employeeId = ? AND year = 2026', [employeeId]);
    return res.status(200).json(balances);
  } catch (err) {
    console.error('Fetch balances error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/leaves/my - Get current employee's applied leaves history
const getMyLeaves = async (req, res) => {
  const { employeeId } = req.user;
  try {
    const list = await allQuery('SELECT * FROM leaveRequests WHERE employeeId = ? ORDER BY fromDate DESC', [employeeId]);
    return res.status(200).json(list);
  } catch (err) {
    console.error('Fetch my leaves error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/leaves/apply - Employee applies for leave
const applyLeave = async (req, res) => {
  const { employeeId, companyId } = req.user;
  const { leaveType, fromDate, toDate, totalDays, halfDay, reason, attachmentUrl } = req.body;

  if (!leaveType || !fromDate || !toDate || !totalDays || !reason) {
    return res.status(400).json({ message: 'All fields are required to apply leave' });
  }

  try {
    // 1. Check leave balance (except for Unpaid Leave)
    if (leaveType !== 'Unpaid') {
      const balance = await getQuery('SELECT * FROM leaveBalances WHERE employeeId = ? AND leaveType = ? AND year = 2026', [employeeId, leaveType]);
      if (!balance || balance.available < totalDays) {
        return res.status(400).json({ message: `Insufficient balance for ${leaveType} Leave (Available: ${balance ? balance.available : 0} days)` });
      }
    }

    // 2. Check overlapping leave requests
    const overlapping = await getQuery(`
      SELECT leaveId FROM leaveRequests
      WHERE employeeId = ? AND status != 'Rejected' AND status != 'Cancelled'
      AND ((fromDate <= ? AND toDate >= ?) OR (fromDate <= ? AND toDate >= ?))
    `, [employeeId, fromDate, fromDate, toDate, toDate]);

    if (overlapping) {
      return res.status(400).json({ message: 'You have already applied or approved leaves overlapping with these dates.' });
    }

    // 3. Create Leave Request
    const leaveId = `LV_${employeeId}_${Date.now()}`;
    await runQuery(`
      INSERT INTO leaveRequests (
        leaveId, companyId, employeeId, leaveType, fromDate, toDate, totalDays, halfDay, reason, attachmentUrl, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `, [leaveId, companyId, employeeId, leaveType, fromDate, toDate, totalDays, halfDay ? 1 : 0, reason, attachmentUrl || null]);

    // 4. Increment pending in leave balances (if not Unpaid)
    if (leaveType !== 'Unpaid') {
      await runQuery(`
        UPDATE leaveBalances
        SET pending = pending + ?
        WHERE employeeId = ? AND leaveType = ? AND year = 2026
      `, [totalDays, employeeId, leaveType]);
    }

    // Notify employee
    await runQuery(`
      INSERT INTO notifications (notificationId, companyId, userId, title, message, type)
      VALUES (?, ?, ?, ?, ?, 'leave')
    `, [`NOT_${Date.now()}`, companyId, req.user.userId, 'Leave Application Submitted', `Your leave request for ${totalDays} days (${fromDate} to ${toDate}) has been submitted.`, 'leave']);

    return res.status(201).json({ message: 'Leave application submitted successfully', leaveId });
  } catch (err) {
    console.error('Apply leave error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// GET /api/leaves/requests - HR: View all leave requests with filters
const getLeaveRequests = async (req, res) => {
  const { companyId } = req.user;
  const { status, employeeId } = req.query;

  try {
    let sql = `
      SELECT lr.*, e.name as employeeName, b.name as branchName, d.name as departmentName
      FROM leaveRequests lr
      JOIN employees e ON lr.employeeId = e.employeeId
      LEFT JOIN branches b ON e.branchId = b.branchId
      LEFT JOIN departments d ON e.departmentId = d.departmentId
      WHERE lr.companyId = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ' AND lr.status = ?';
      params.push(status);
    }
    if (employeeId) {
      sql += ' AND lr.employeeId = ?';
      params.push(employeeId);
    }

    sql += ' ORDER BY lr.createdAt DESC';

    const list = await allQuery(sql, params);
    return res.status(200).json(list);
  } catch (err) {
    console.error('Fetch requests error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/leaves/requests/:id/approve - HR: Approve or Reject leave request
const approveRejectLeave = async (req, res) => {
  const { companyId, userId } = req.user;
  const { id } = req.params;
  const { status, rejectionReason } = req.body; // 'Approved' or 'Rejected'

  if (!status || !['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Approved or Rejected' });
  }

  try {
    const request = await getQuery('SELECT * FROM leaveRequests WHERE leaveId = ? AND companyId = ?', [id, companyId]);
    if (!request) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ message: `Leave request is already processed (Current Status: ${request.status})` });
    }

    const { employeeId, leaveType, totalDays, fromDate, toDate, halfDay } = request;


    // Check if payroll for this month is locked
    const [year, month] = fromDate.split('-').map(Number);
    const lockedPayroll = await getQuery('SELECT payrollId FROM payroll WHERE employeeId = ? AND month = ? AND year = ? AND locked = 1', [employeeId, month, year]);
    if (lockedPayroll) {
      return res.status(400).json({ message: 'Payroll for this month is finalized and locked. You cannot approve leaves for this period.' });
    }


    if (status === 'Approved') {
      // 1. Update balances (if not Unpaid)
      if (leaveType !== 'Unpaid') {
        const balance = await getQuery('SELECT * FROM leaveBalances WHERE employeeId = ? AND leaveType = ? AND year = 2026', [employeeId, leaveType]);
        if (!balance || balance.available < totalDays) {
          return res.status(400).json({ message: `Cannot approve. Employee balance insufficient now (Available: ${balance ? balance.available : 0} days)` });
        }

        await runQuery(`
          UPDATE leaveBalances
          SET pending = pending - ?, used = used + ?, available = available - ?
          WHERE employeeId = ? AND leaveType = ? AND year = 2026
        `, [totalDays, totalDays, totalDays, employeeId, leaveType]);
      }

      // 2. Update Leave Request status
      await runQuery(`
        UPDATE leaveRequests
        SET status = 'Approved', approvedBy = ?, approvedAt = CURRENT_TIMESTAMP
        WHERE leaveId = ?
      `, [userId, id]);

      // 3. AUTO-INTEGRATION: Insert 'Paid Leave' or 'Unpaid Leave' into the attendance table
      const dates = getDatesInRange(fromDate, toDate);
      const employee = await getQuery('SELECT weeklyOff FROM employees WHERE employeeId = ?', [employeeId]);
      const weeklyOffDay = employee ? employee.weeklyOff : 'Sunday';
      const statusToMark = leaveType === 'Unpaid' ? 'Unpaid Leave' : 'Paid Leave';

      for (const date of dates) {
        // Check if date is a Sunday or weekly off
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
        const isWeeklyOff = weeklyOffDay.toLowerCase().includes(dayName.toLowerCase());

        const attendanceId = `ATT_${employeeId}_${date}`;
        const existingAttendance = await getQuery('SELECT * FROM attendance WHERE attendanceId = ?', [attendanceId]);

        if (isWeeklyOff) {
          // If it is Sunday/Weekly Off, we mark as 'Weekly Off' instead of paid leave
          if (!existingAttendance) {
            await runQuery(`
              INSERT INTO attendance (attendanceId, companyId, employeeId, date, status, source)
              VALUES (?, ?, ?, ?, 'Weekly Off', 'manual')
            `, [attendanceId, companyId, employeeId, date]);
          }
        } else {
          // Mark as leave
          if (existingAttendance) {
            // Update existing record (e.g. if marked absent or present, overwrite since leave is approved)
            await runQuery(`
              UPDATE attendance
              SET status = ?, workingHours = 0, inTime = NULL, outTime = NULL, source = 'manual', updatedAt = CURRENT_TIMESTAMP
              WHERE attendanceId = ?
            `, [statusToMark, attendanceId]);
          } else {
            await runQuery(`
              INSERT INTO attendance (attendanceId, companyId, employeeId, date, status, source)
              VALUES (?, ?, ?, ?, ?, 'manual')
            `, [attendanceId, companyId, employeeId, date, statusToMark]);
          }
        }
      }

    } else {
      // Status is Rejected
      // 1. Deduct pending in leave balances
      if (leaveType !== 'Unpaid') {
        await runQuery(`
          UPDATE leaveBalances
          SET pending = pending - ?
          WHERE employeeId = ? AND leaveType = ? AND year = 2026
        `, [totalDays, employeeId, leaveType]);
      }

      // 2. Update Leave Request
      await runQuery(`
        UPDATE leaveRequests
        SET status = 'Rejected', rejectionReason = ?, approvedBy = ?, approvedAt = CURRENT_TIMESTAMP
        WHERE leaveId = ?
      `, [rejectionReason || 'Rejected by HR', userId, id]);
    }

    // Insert Audit Log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue, newValue)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `LOG_${Date.now()}`, companyId, userId, `LEAVE_${status.toUpperCase()}`, 'Leave Management',
      JSON.stringify(request),
      JSON.stringify({ status, rejectionReason })
    ]);

    // Notify employee
    await runQuery(`
      INSERT INTO notifications (notificationId, companyId, userId, title, message, type)
      VALUES (?, ?, ?, ?, ?, 'leave')
    `, [`NOT_${Date.now()}`, companyId, `USR_${employeeId}`, `Leave Request ${status}`, `Your leave request for ${fromDate} to ${toDate} has been ${status.toLowerCase()}.`, 'leave']);

    return res.status(200).json({ message: `Leave request has been ${status.toLowerCase()} successfully` });
  } catch (err) {
    console.error('Approve reject leave error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getEmployeeLeaveBalances,
  getMyLeaves,
  applyLeave,
  getLeaveRequests,
  approveRejectLeave
};
