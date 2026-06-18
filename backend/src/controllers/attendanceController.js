const { runQuery, getQuery, allQuery } = require('../config/db');
const { calculateDistance } = require('../utils/geo');

// Helper to get time difference in minutes
const getTimeDifferenceInMinutes = (time1, time2) => {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
};

// GET /api/attendance/today - Get current employee's punch status for today
const getTodayStatus = async (req, res) => {
  const { employeeId, companyId } = req.user;
  const today = new Date().toISOString().split('T')[0];

  try {
    const log = await getQuery('SELECT * FROM attendance WHERE employeeId = ? AND date = ? AND companyId = ?', [employeeId, today, companyId]);
    if (!log) {
      return res.status(200).json({ status: 'Not Marked', record: null });
    }
    if (log.inTime && !log.outTime) {
      return res.status(200).json({ status: 'IN Done', record: log });
    }
    return res.status(200).json({ status: 'OUT Done', record: log });
  } catch (err) {
    console.error('Fetch today status error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/attendance/punch-in - Employee mobile punch in
const punchIn = async (req, res) => {
  const { employeeId, companyId, branchId } = req.user;
  const { latitude, longitude, address, photoUrl, deviceId, mockTime } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  // Use server time or mockTime for simulation/testing
  const now = mockTime ? new Date(mockTime) : new Date();
  const inTimeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

  try {
    // 1. Prevent duplicate punch
    const existingLog = await getQuery('SELECT * FROM attendance WHERE employeeId = ? AND date = ?', [employeeId, today]);
    if (existingLog) {
      return res.status(400).json({ message: 'Attendance already marked for today' });
    }

    // 2. Fetch employee & company configuration
    const employee = await getQuery('SELECT * FROM employees WHERE employeeId = ?', [employeeId]);
    if (!employee || employee.status !== 'Active') {
      return res.status(400).json({ message: 'Employee account is inactive or not found' });
    }

    const company = await getQuery('SELECT * FROM companies WHERE companyId = ?', [companyId]);
    const attendanceSettings = JSON.parse(company.attendanceSettings);

    // 3. Geofence Verification
    if (attendanceSettings.geofenceEnabled && latitude && longitude) {
      const branch = await getQuery('SELECT * FROM branches WHERE branchId = ?', [employee.branchId]);
      if (branch) {
        const distance = calculateDistance(latitude, longitude, branch.latitude, branch.longitude);
        if (distance > branch.radiusMeters) {
          return res.status(400).json({
            message: `Punch blocked. You are outside the allowed geofence boundary. (Distance: ${Math.round(distance)}m, Allowed: ${branch.radiusMeters}m)`
          });
        }
      }
    }

    // 4. Fetch shift details to calculate lateMinutes
    const shift = await getQuery('SELECT * FROM shifts WHERE shiftId = ?', [employee.shiftId]);
    let lateMinutes = 0;
    if (shift) {
      // Calculate delay in minutes
      const diff = getTimeDifferenceInMinutes(shift.startTime, inTimeStr);
      if (diff > shift.lateGraceMinutes) {
        lateMinutes = diff; // Late from the exact start time
      }
    }

    // 5. Insert Attendance record
    const attendanceId = `ATT_${employeeId}_${today}`;
    await runQuery(`
      INSERT INTO attendance (
        attendanceId, companyId, employeeId, date, inTime, status, lateMinutes, inPhotoUrl,
        inLatitude, inLongitude, inAddress, deviceId, source, correctionStatus
      ) VALUES (?, ?, ?, ?, ?, 'Present', ?, ?, ?, ?, ?, ?, 'mobile', 'None')
    `, [
      attendanceId, companyId, employeeId, today, inTimeStr, lateMinutes, photoUrl || null,
      latitude || null, longitude || null, address || null, deviceId || null
    ]);

    // Create notifications for attendance marked
    await runQuery(`
      INSERT INTO notifications (notificationId, companyId, userId, title, message, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`NOT_${Date.now()}`, companyId, req.user.userId, 'Attendance Marked', `You have successfully punched in at ${inTimeStr}`, 'attendance']);

    return res.status(200).json({
      message: 'Punched IN successfully',
      time: inTimeStr,
      lateMinutes
    });
  } catch (err) {
    console.error('Punch IN error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// POST /api/attendance/punch-out - Employee mobile punch out
const punchOut = async (req, res) => {
  const { employeeId, companyId } = req.user;
  const { latitude, longitude, address, photoUrl, deviceId, mockTime } = req.body;
  const today = new Date().toISOString().split('T')[0];

  const now = mockTime ? new Date(mockTime) : new Date();
  const outTimeStr = now.toTimeString().split(' ')[0];

  try {
    // 1. Check if punch-in exists
    const attendance = await getQuery('SELECT * FROM attendance WHERE employeeId = ? AND date = ?', [employeeId, today]);
    if (!attendance) {
      return res.status(400).json({ message: 'Punch IN required before punching OUT' });
    }
    if (attendance.outTime) {
      return res.status(400).json({ message: 'Already punched OUT for today' });
    }

    // 2. Fetch employee & shift configurations
    const employee = await getQuery('SELECT * FROM employees WHERE employeeId = ?', [employeeId]);
    const shift = await getQuery('SELECT * FROM shifts WHERE shiftId = ?', [employee.shiftId]);

    // 3. Geofence Verification for Punch-Out
    const company = await getQuery('SELECT * FROM companies WHERE companyId = ?', [companyId]);
    const attendanceSettings = JSON.parse(company.attendanceSettings);
    if (attendanceSettings.geofenceEnabled && latitude && longitude) {
      const branch = await getQuery('SELECT * FROM branches WHERE branchId = ?', [employee.branchId]);
      if (branch) {
        const distance = calculateDistance(latitude, longitude, branch.latitude, branch.longitude);
        if (distance > branch.radiusMeters) {
          return res.status(400).json({
            message: `Punch blocked. You are outside the allowed geofence boundary. (Distance: ${Math.round(distance)}m, Allowed: ${branch.radiusMeters}m)`
          });
        }
      }
    }

    // 4. Calculate working hours
    const totalMin = getTimeDifferenceInMinutes(attendance.inTime, outTimeStr);
    const workingHours = Number((totalMin / 60).toFixed(2));

    // 5. Determine early leaving minutes
    let earlyOutMinutes = 0;
    if (shift) {
      const diff = getTimeDifferenceInMinutes(outTimeStr, shift.endTime);
      if (diff > 0) {
        earlyOutMinutes = diff;
      }
    }

    // 6. Determine status & overtime
    let status = 'Present';
    let overtimeHours = 0.0;
    if (shift) {
      if (workingHours < shift.halfDayHours) {
        status = 'Absent';
      } else if (workingHours < shift.fullDayHours) {
        status = 'Half Day';
      } else {
        status = 'Present';
        // Overtime check (hours worked beyond full day shift hours)
        const shiftDuration = getTimeDifferenceInMinutes(shift.startTime, shift.endTime) / 60; // usually 9 hours (including 1hr break)
        if (workingHours > shiftDuration) {
          overtimeHours = Number((workingHours - shiftDuration).toFixed(2));
        }
      }
    }

    // 7. Update attendance record
    await runQuery(`
      UPDATE attendance
      SET outTime = ?, workingHours = ?, status = ?, earlyOutMinutes = ?, overtimeHours = ?,
          outPhotoUrl = ?, outLatitude = ?, outLongitude = ?, outAddress = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE attendanceId = ?
    `, [
      outTimeStr, workingHours, status, earlyOutMinutes, overtimeHours,
      photoUrl || null, latitude || null, longitude || null, address || null, attendance.attendanceId
    ]);

    // Notification
    await runQuery(`
      INSERT INTO notifications (notificationId, companyId, userId, title, message, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`NOT_${Date.now()}`, companyId, req.user.userId, 'Attendance Punch OUT', `You punched out successfully at ${outTimeStr}. Working hours: ${workingHours} hrs`, 'attendance']);

    return res.status(200).json({
      message: 'Punched OUT successfully',
      time: outTimeStr,
      workingHours,
      status,
      overtimeHours
    });
  } catch (err) {
    console.error('Punch OUT error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// POST /api/attendance/correction - Employee requests an attendance correction
const requestCorrection = async (req, res) => {
  const { employeeId, companyId } = req.user;
  const { date, inTime, outTime, reason } = req.body;

  if (!date || !reason) {
    return res.status(400).json({ message: 'Date and reason are required' });
  }

  try {
    const existingLog = await getQuery('SELECT * FROM attendance WHERE employeeId = ? AND date = ?', [employeeId, date]);
    const attendanceId = existingLog ? existingLog.attendanceId : `ATT_${employeeId}_${date}`;

    if (existingLog) {
      await runQuery(`
        UPDATE attendance
        SET correctionStatus = 'Pending', hrRemarks = ?
        WHERE attendanceId = ?
      `, [JSON.stringify({ inTime, outTime, reason }), attendanceId]);
    } else {
      // Create a pending correction log (employee missed checking in at all)
      await runQuery(`
        INSERT INTO attendance (
          attendanceId, companyId, employeeId, date, status, correctionStatus, hrRemarks
        ) VALUES (?, ?, ?, ?, 'Absent', 'Pending', ?)
      `, [attendanceId, companyId, employeeId, date, JSON.stringify({ inTime, outTime, reason })]);
    }

    return res.status(200).json({ message: 'Correction request submitted to HR' });
  } catch (err) {
    console.error('Correction request error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/attendance/corrections - HR: Get list of pending correction requests
const getPendingCorrections = async (req, res) => {
  const { companyId } = req.user;

  try {
    const list = await allQuery(`
      SELECT a.*, e.name as employeeName, b.name as branchName
      FROM attendance a
      JOIN employees e ON a.employeeId = e.employeeId
      LEFT JOIN branches b ON e.branchId = b.branchId
      WHERE a.companyId = ? AND a.correctionStatus = 'Pending'
      ORDER BY a.date DESC
    `, [companyId]);

    // Parse the correction requests details stored in hrRemarks
    const result = list.map(item => {
      try {
        const details = JSON.parse(item.hrRemarks);
        return { ...item, correctionDetails: details };
      } catch (e) {
        return { ...item, correctionDetails: null };
      }
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Get corrections error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/attendance/corrections/:id/approve - HR: Approve correction request
const approveCorrection = async (req, res) => {
  const { companyId, userId } = req.user;
  const { id } = req.params; // attendanceId
  const { status: approvalStatus, remarks } = req.body; // 'Approved' or 'Rejected'

  try {
    const log = await getQuery('SELECT * FROM attendance WHERE attendanceId = ? AND companyId = ?', [id, companyId]);
    if (!log) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    if (approvalStatus === 'Rejected') {
      await runQuery(`
        UPDATE attendance
        SET correctionStatus = 'Rejected', hrRemarks = ?
        WHERE attendanceId = ?
      `, [remarks || 'Rejected by HR', id]);
      
      // Notify employee
      await runQuery(`
        INSERT INTO notifications (notificationId, companyId, userId, title, message, type)
        VALUES (?, ?, ?, ?, ?, 'attendance')
      `, [`NOT_${Date.now()}`, companyId, `USR_${log.employeeId}`, 'Correction Request Rejected', `Your attendance correction request for ${log.date} was rejected.`, 'attendance']);

      return res.status(200).json({ message: 'Correction request rejected' });
    }

    // Parse requested corrections
    const details = JSON.parse(log.hrRemarks);
    const newIn = details.inTime || log.inTime || '09:00:00';
    const newOut = details.outTime || log.outTime || '18:00:00';

    // Calculate working hours & status
    const employee = await getQuery('SELECT * FROM employees WHERE employeeId = ?', [log.employeeId]);
    const shift = await getQuery('SELECT * FROM shifts WHERE shiftId = ?', [employee.shiftId]);

    const totalMin = getTimeDifferenceInMinutes(newIn, newOut);
    const workingHours = Number((totalMin / 60).toFixed(2));

    let status = 'Present';
    let overtimeHours = 0.0;
    let lateMinutes = 0;
    let earlyOutMinutes = 0;

    if (shift) {
      if (workingHours < shift.halfDayHours) {
        status = 'Absent';
      } else if (workingHours < shift.fullDayHours) {
        status = 'Half Day';
      } else {
        status = 'Present';
        const shiftDuration = getTimeDifferenceInMinutes(shift.startTime, shift.endTime) / 60;
        if (workingHours > shiftDuration) {
          overtimeHours = Number((workingHours - shiftDuration).toFixed(2));
        }
      }

      // Late mark
      const lateDiff = getTimeDifferenceInMinutes(shift.startTime, newIn);
      if (lateDiff > shift.lateGraceMinutes) {
        lateMinutes = lateDiff;
      }

      // Early out
      const earlyDiff = getTimeDifferenceInMinutes(newOut, shift.endTime);
      if (earlyDiff > 0) {
        earlyOutMinutes = earlyDiff;
      }
    }

    // Update Attendance
    await runQuery(`
      UPDATE attendance
      SET inTime = ?, outTime = ?, workingHours = ?, status = ?, lateMinutes = ?, earlyOutMinutes = ?, overtimeHours = ?,
          correctionStatus = 'Approved', hrRemarks = ?, source = 'manual', updatedAt = CURRENT_TIMESTAMP
      WHERE attendanceId = ?
    `, [newIn, newOut, workingHours, status, lateMinutes, earlyOutMinutes, overtimeHours, remarks || 'Approved by HR', id]);

    // Insert audit log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue, newValue)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `LOG_${Date.now()}`, companyId, userId, 'APPROVE_ATTENDANCE_CORRECTION', 'Attendance',
      JSON.stringify(log),
      JSON.stringify({ inTime: newIn, outTime: newOut, status, workingHours })
    ]);

    // Notify employee
    await runQuery(`
      INSERT INTO notifications (notificationId, companyId, userId, title, message, type)
      VALUES (?, ?, ?, ?, ?, 'attendance')
    `, [`NOT_${Date.now()}`, companyId, `USR_${log.employeeId}`, 'Correction Request Approved', `Your attendance correction request for ${log.date} was approved.`, 'attendance']);

    return res.status(200).json({ message: 'Correction request approved' });
  } catch (err) {
    console.error('Approve correction error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// GET /api/attendance/daily - HR: Get list of daily attendance for all employees
const getDailyAttendanceGrid = async (req, res) => {
  const { companyId } = req.user;
  const { date, branchId, departmentId } = req.query;

  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const list = await allQuery(`
      SELECT e.employeeId, e.name as employeeName, e.mobile, e.status as empStatus,
             b.name as branchName, d.name as departmentName, s.name as shiftName,
             a.attendanceId, a.inTime, a.outTime, a.workingHours, a.status as attendanceStatus,
             a.lateMinutes, a.earlyOutMinutes, a.overtimeHours, a.inLatitude, a.inLongitude,
             a.inPhotoUrl, a.outPhotoUrl, a.source, a.correctionStatus, a.hrRemarks
      FROM employees e
      LEFT JOIN branches b ON e.branchId = b.branchId
      LEFT JOIN departments d ON e.departmentId = d.departmentId
      LEFT JOIN shifts s ON e.shiftId = s.shiftId
      LEFT JOIN attendance a ON e.employeeId = a.employeeId AND a.date = ? AND a.companyId = ?
      WHERE e.companyId = ? AND e.status = 'Active'
    `, [targetDate, companyId, companyId]);

    // Filter list
    let filtered = list;
    if (branchId) {
      filtered = filtered.filter(item => item.branchId === branchId || list.some(x => x.employeeId === item.employeeId && x.branchName.toLowerCase().includes(branchId.toLowerCase()))); // approx match or ID match
    }
    // Since we queried employee columns, we can filter in JS or add SQL conditions. Let's do it in SQL in future if tables grow, but JS is fine for 10-100 items.
    
    return res.status(200).json(filtered);
  } catch (err) {
    console.error('Daily grid error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/attendance/monthly - HR: Get matrix of monthly attendance for dashboard
const getMonthlyAttendanceGrid = async (req, res) => {
  const { companyId } = req.user;
  const { month, year, branchId, departmentId } = req.query;

  const targetMonth = parseInt(month || new Date().getMonth() + 1, 10);
  const targetYear = parseInt(year || new Date().getFullYear(), 10);

  const monthStr = targetMonth.toString().padStart(2, '0');
  const dateLike = `${targetYear}-${monthStr}-%`;

  try {
    const employees = await allQuery(`
      SELECT e.employeeId, e.name as employeeName, b.name as branchName, d.name as departmentName
      FROM employees e
      LEFT JOIN branches b ON e.branchId = b.branchId
      LEFT JOIN departments d ON e.departmentId = d.departmentId
      WHERE e.companyId = ? AND e.status = 'Active'
    `, [companyId]);

    const attendanceLogs = await allQuery(`
      SELECT employeeId, date, status, workingHours
      FROM attendance
      WHERE companyId = ? AND date LIKE ?
    `, [companyId, dateLike]);

    // Group logs by employee
    const logsMap = {};
    attendanceLogs.forEach(log => {
      if (!logsMap[log.employeeId]) {
        logsMap[log.employeeId] = {};
      }
      logsMap[log.employeeId][log.date] = {
        status: log.status,
        hours: log.workingHours
      };
    });

    const result = employees.map(emp => {
      return {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        branchName: emp.branchName,
        departmentName: emp.departmentName,
        attendance: logsMap[emp.employeeId] || {}
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Monthly grid error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/attendance/manual - HR: Manually mark or edit attendance record
const manualMarkAttendance = async (req, res) => {
  const { companyId, userId } = req.user;
  const { employeeId, date, inTime, outTime, status, remarks } = req.body;

  if (!employeeId || !date || !status) {
    return res.status(400).json({ message: 'EmployeeId, date and status are required' });
  }

  try {
    const employee = await getQuery('SELECT * FROM employees WHERE employeeId = ? AND companyId = ?', [employeeId, companyId]);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const shift = await getQuery('SELECT * FROM shifts WHERE shiftId = ?', [employee.shiftId]);
    const attendanceId = `ATT_${employeeId}_${date}`;
    
    // Calculate working hours
    let workingHours = 0.0;
    let overtimeHours = 0.0;
    let lateMinutes = 0;
    let earlyOutMinutes = 0;

    if (inTime && outTime) {
      const totalMin = getTimeDifferenceInMinutes(inTime, outTime);
      workingHours = Number((totalMin / 60).toFixed(2));

      if (shift) {
        const shiftDuration = getTimeDifferenceInMinutes(shift.startTime, shift.endTime) / 60;
        if (workingHours > shiftDuration) {
          overtimeHours = Number((workingHours - shiftDuration).toFixed(2));
        }

        const lateDiff = getTimeDifferenceInMinutes(shift.startTime, inTime);
        if (lateDiff > shift.lateGraceMinutes) {
          lateMinutes = lateDiff;
        }

        const earlyDiff = getTimeDifferenceInMinutes(outTime, shift.endTime);
        if (earlyDiff > 0) {
          earlyOutMinutes = earlyDiff;
        }
      }
    }

    // Check if payroll is generated and locked for this month
    const [year, month] = date.split('-').map(Number);
    const lockedPayroll = await getQuery('SELECT payrollId FROM payroll WHERE employeeId = ? AND month = ? AND year = ? AND locked = 1', [employeeId, month, year]);
    if (lockedPayroll) {
      return res.status(400).json({ message: 'Payroll for this month is locked. Attendance cannot be edited unless Super Admin unlocks payroll.' });
    }

    const existingLog = await getQuery('SELECT * FROM attendance WHERE attendanceId = ?', [attendanceId]);

    if (existingLog) {
      await runQuery(`
        UPDATE attendance
        SET inTime = ?, outTime = ?, workingHours = ?, status = ?, lateMinutes = ?, earlyOutMinutes = ?, overtimeHours = ?,
            source = 'manual', hrRemarks = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE attendanceId = ?
      `, [inTime || null, outTime || null, workingHours, status, lateMinutes, earlyOutMinutes, overtimeHours, remarks || 'Manual mark by HR', attendanceId]);
    } else {
      await runQuery(`
        INSERT INTO attendance (
          attendanceId, companyId, employeeId, date, inTime, outTime, workingHours, status,
          lateMinutes, earlyOutMinutes, overtimeHours, source, hrRemarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)
      `, [
        attendanceId, companyId, employeeId, date, inTime || null, outTime || null, workingHours, status,
        lateMinutes, earlyOutMinutes, overtimeHours, remarks || 'Manual mark by HR'
      ]);
    }

    // Insert audit log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue, newValue)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `LOG_${Date.now()}`, companyId, userId, 'MANUAL_ATTENDANCE_EDIT', 'Attendance',
      existingLog ? JSON.stringify(existingLog) : 'None',
      JSON.stringify({ employeeId, date, inTime, outTime, status, remarks })
    ]);

    return res.status(200).json({ message: 'Attendance updated successfully' });
  } catch (err) {
    console.error('Manual mark error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getTodayStatus,
  punchIn,
  punchOut,
  requestCorrection,
  getPendingCorrections,
  approveCorrection,
  getDailyAttendanceGrid,
  getMonthlyAttendanceGrid,
  manualMarkAttendance
};
