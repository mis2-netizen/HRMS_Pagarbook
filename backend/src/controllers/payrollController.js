const { runQuery, getQuery, allQuery } = require('../config/db');
const { generateSalarySlipPDF } = require('../utils/pdfGenerator');
const path = require('path');
const fs = require('fs');

// Helper to get number of days in a month
const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

// Helper to count specific weekly off day in a month
const countWeeklyOffsInMonth = (month, year, weeklyOffName) => {
  let count = 0;
  const days = getDaysInMonth(month, year);
  const dayMap = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  const targetDayNum = dayMap[String(weeklyOffName).toLowerCase()] !== undefined 
    ? dayMap[String(weeklyOffName).toLowerCase()] 
    : 0; // default Sunday
  for (let i = 1; i <= days; i++) {
    const day = new Date(year, month - 1, i).getDay();
    if (day === targetDayNum) count++;
  }
  return count;
};

// Core calculation engine for a single employee
const calculateEmployeeSalary = async (employee, month, year, companySettings) => {
  const employeeId = employee.employeeId;
  const companyId = employee.companyId;

  // 1. Fetch Month Attendances
  const monthStr = month.toString().padStart(2, '0');
  const dateLike = `${year}-${monthStr}-%`;
  const logs = await allQuery('SELECT * FROM attendance WHERE employeeId = ? AND date LIKE ?', [employeeId, dateLike]);

  // 2. Counts
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let weeklyOffs = 0;
  let holidays = 0;
  let totalLateDays = 0;
  let overtimeHours = 0.0;

  const penaltyGrace = companySettings.payrollSettings?.latePenaltyConfig?.graceMinutes ?? 15;

  logs.forEach(log => {
    if (log.status === 'Present') presentDays++;
    else if (log.status === 'Absent') absentDays++;
    else if (log.status === 'Half Day') halfDays++;
    else if (log.status === 'Paid Leave') paidLeaveDays++;
    else if (log.status === 'Unpaid Leave') unpaidLeaveDays++;
    else if (log.status === 'Weekly Off') weeklyOffs++;
    else if (log.status === 'Holiday') holidays++;

    if (log.lateMinutes > penaltyGrace) totalLateDays++;
    if (log.overtimeHours > 0) overtimeHours += log.overtimeHours;
  });

  // 3. Resolve Salary Days Divisor
  const calendarDays = getDaysInMonth(month, year);
  let divisor = 26; // Default
  if (companySettings.salaryDaysSetting === 'Calendar Days') {
    divisor = calendarDays;
  } else if (companySettings.salaryDaysSetting === 'Fixed 30') {
    divisor = 30;
  } else if (companySettings.salaryDaysSetting === 'Fixed 26') {
    divisor = 26;
  } else if (companySettings.salaryDaysSetting === 'Working Days') {
    divisor = calendarDays - countWeeklyOffsInMonth(month, year, employee.weeklyOff || 'Sunday');
  }

  // 4. Calculate base earned salary
  let earnedSalary = 0;
  const weeklyOffPayable = (companySettings.payrollSettings?.weeklyOffPaid !== false) ? weeklyOffs : 0;
  const holidayPayable = (companySettings.payrollSettings?.holidayPaid !== false) ? holidays : 0;

  const payableDays = presentDays + paidLeaveDays + weeklyOffPayable + holidayPayable + (0.5 * halfDays);

  if (employee.salaryType === 'Monthly') {
    earnedSalary = Math.round(employee.monthlySalary * (payableDays / divisor));
  } else if (employee.salaryType === 'Daily wage') {
    const activePayDays = presentDays + paidLeaveDays + (0.5 * halfDays) + weeklyOffPayable + holidayPayable;
    earnedSalary = Math.round(employee.perDaySalary * activePayDays);
  } else {
    // Hourly wagers
    const totalHoursWorked = logs.reduce((sum, log) => sum + (log.workingHours || 0), 0);
    const hourlyRate = employee.perDaySalary / 8;
    earnedSalary = Math.round(hourlyRate * totalHoursWorked);
  }

  // 5. Overtime Calculation
  let overtimeAmount = 0;
  if (overtimeHours > 0) {
    const otRate = companySettings.attendanceSettings?.overtimeRate || 1.5;
    const otRateType = companySettings.payrollSettings?.overtimeRateType || 'Multiplier';
    
    if (otRateType === 'Flat') {
      overtimeAmount = Math.round(overtimeHours * otRate);
    } else {
      const baseVal = employee.salaryType === 'Monthly' ? employee.monthlySalary : (employee.perDaySalary * divisor);
      const hourlyRate = baseVal / (divisor * 8); // 26 working days, 8 hours a day
      overtimeAmount = Math.round(overtimeHours * hourlyRate * otRate);
    }
  }

  // 6. Fetch pending Adjustments (Loans, Advances, Bonuses) for this month/year
  const adjustments = await allQuery(`
    SELECT * FROM adjustments
    WHERE employeeId = ? AND applicableMonth = ? AND applicableYear = ? AND status = 'Pending'
  `, [employeeId, month, year]);

  let bonus = 0;
  let incentive = 0;
  let reimbursement = 0;
  let advanceDeduction = 0;
  let loanDeduction = 0;
  let penalty = 0;
  let otherDeductions = 0;

  adjustments.forEach(adj => {
    if (adj.type === 'Bonus') bonus += adj.amount;
    else if (adj.type === 'Incentive') incentive += adj.amount;
    else if (adj.type === 'Reimbursement') reimbursement += adj.amount;
    else if (adj.type === 'Advance') advanceDeduction += adj.amount;
    else if (adj.type === 'Loan') loanDeduction += adj.amount;
    else if (adj.type === 'Penalty') penalty += adj.amount;
    else if (adj.type === 'Other Deduction') otherDeductions += adj.amount;
  });

  // 7. Late Penalty Calculation
  let latePenalty = 0;
  const lateConfig = companySettings.payrollSettings?.latePenaltyConfig;
  if (lateConfig?.enabled !== false && totalLateDays > 0) {
    const allowed = lateConfig?.allowedLateDays || 0;
    const rate = lateConfig?.deductionPerLate || 0;
    const penalizableDays = Math.max(0, totalLateDays - allowed);
    latePenalty = penalizableDays * rate;
  }


  // 8. PF / ESI / Professional Tax Deductions (based on structure toggles)
  let pf = 0;
  let esi = 0;
  let pt = 0;

  const structure = JSON.parse(employee.salaryStructure);

  if (employee.salaryType === 'Monthly') {
    if (structure.pfEnabled) {
      // 12% of Basic Salary (Basic is 50% of monthly base)
      const basicEarned = earnedSalary * 0.5;
      pf = Math.round(basicEarned * 0.12);
    }
    if (structure.esiEnabled) {
      // 0.75% of Gross Earned Salary
      esi = Math.round(earnedSalary * 0.0075);
    }
    if (structure.ptEnabled) {
      pt = 200; // Flat 200 Professional Tax
    }
  }

  // 9. Summarize Earnings and Deductions
  const earningsJson = {
    basic: Math.round(earnedSalary * 0.5),
    hra: Math.round(earnedSalary * 0.25),
    conveyance: Math.round(earnedSalary * 0.1),
    allowance: Math.round(earnedSalary * 0.15),
    overtimeAmount,
    bonus,
    incentive,
    reimbursement
  };

  const deductionsJson = {
    advanceDeduction,
    loanDeduction,
    pf,
    esi,
    professionalTax: pt,
    latePenalty,
    earlyOutPenalty: 0,
    otherDeductions: penalty + otherDeductions
  };

  const totalEarnings = earnedSalary + overtimeAmount + bonus + incentive + reimbursement;
  const totalDeductions = advanceDeduction + loanDeduction + pf + esi + pt + latePenalty + penalty + otherDeductions;
  
  const grossSalary = totalEarnings;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  const attendanceSummaryJson = {
    presentDays,
    absentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    weeklyOffs,
    holidays,
    latePenalties: totalLateDays,
    overtimeHours
  };

  return {
    employeeId,
    employeeName: employee.name,
    branchId: employee.branchId,
    departmentId: employee.departmentId,
    monthlySalary: employee.monthlySalary,
    perDaySalary: employee.perDaySalary,
    attendanceSummary: attendanceSummaryJson,
    earnings: earningsJson,
    deductions: deductionsJson,
    grossSalary,
    netSalary,
    payableDays,
    totalDeductions
  };
};

// GET /api/payroll/preview - Preview payroll sheet before run
const previewPayroll = async (req, res) => {
  const { companyId } = req.user;
  const { month, year, branchId, departmentId } = req.query;

  if (!month || !year) {
    return res.status(400).json({ message: 'Month and year are required' });
  }

  try {
    const company = await getQuery('SELECT * FROM companies WHERE companyId = ?', [companyId]);
    const companySettings = {
      salaryDaysSetting: JSON.parse(company.payrollSettings).salaryDaysSetting,
      payrollSettings: JSON.parse(company.payrollSettings),
      attendanceSettings: JSON.parse(company.attendanceSettings)
    };

    // Get employees
    let empSql = "SELECT * FROM employees WHERE companyId = ? AND status = 'Active'";
    const params = [companyId];
    if (branchId) {
      empSql += ' AND branchId = ?';
      params.push(branchId);
    }
    if (departmentId) {
      empSql += ' AND departmentId = ?';
      params.push(departmentId);
    }

    const employees = await allQuery(empSql, params);
    const previews = [];

    for (const emp of employees) {
      const calculation = await calculateEmployeeSalary(emp, parseInt(month, 10), parseInt(year, 10), companySettings);
      previews.push(calculation);
    }

    return res.status(200).json(previews);
  } catch (err) {
    console.error('Payroll preview error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// POST /api/payroll/run - Generate draft payroll records
const runPayroll = async (req, res) => {
  const { companyId, userId } = req.user;
  const { month, year, branchId, departmentId } = req.body;

  if (!month || !year) {
    return res.status(400).json({ message: 'Month and year are required' });
  }

  try {
    const company = await getQuery('SELECT * FROM companies WHERE companyId = ?', [companyId]);
    const companySettings = {
      salaryDaysSetting: JSON.parse(company.payrollSettings).salaryDaysSetting,
      payrollSettings: JSON.parse(company.payrollSettings),
      attendanceSettings: JSON.parse(company.attendanceSettings)
    };

    let empSql = "SELECT * FROM employees WHERE companyId = ? AND status = 'Active'";
    const params = [companyId];
    if (branchId) {
      empSql += ' AND branchId = ?';
      params.push(branchId);
    }
    if (departmentId) {
      empSql += ' AND departmentId = ?';
      params.push(departmentId);
    }

    const employees = await allQuery(empSql, params);

    for (const emp of employees) {
      // Check if locked
      const existing = await getQuery('SELECT locked FROM payroll WHERE employeeId = ? AND month = ? AND year = ?', [emp.employeeId, month, year]);
      if (existing && existing.locked === 1) {
        // Locked payroll cannot be rerun
        continue;
      }

      const calc = await calculateEmployeeSalary(emp, parseInt(month, 10), parseInt(year, 10), companySettings);
      
      const payrollId = `PAY_${emp.employeeId}_${year}_${month.toString().padStart(2, '0')}`;

      if (existing) {
        // Update draft
        await runQuery(`
          UPDATE payroll
          SET attendanceSummary = ?, earnings = ?, deductions = ?, grossSalary = ?, netSalary = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE payrollId = ?
        `, [
          JSON.stringify(calc.attendanceSummary),
          JSON.stringify(calc.earnings),
          JSON.stringify(calc.deductions),
          calc.grossSalary,
          calc.netSalary,
          payrollId
        ]);
      } else {
        // Create draft
        await runQuery(`
          INSERT INTO payroll (
            payrollId, companyId, employeeId, month, year, attendanceSummary, earnings, deductions, grossSalary, netSalary, paymentStatus, locked
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 0)
        `, [
          payrollId, companyId, emp.employeeId, month, year,
          JSON.stringify(calc.attendanceSummary),
          JSON.stringify(calc.earnings),
          JSON.stringify(calc.deductions),
          calc.grossSalary,
          calc.netSalary
        ]);
      }
    }

    // Insert Audit Log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, newValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`LOG_${Date.now()}`, companyId, userId, 'RUN_PAYROLL', 'Payroll', `Generated draft payroll for ${month}/${year}`]);

    return res.status(200).json({ message: 'Payroll drafts generated successfully' });
  } catch (err) {
    console.error('Run payroll error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// POST /api/payroll/lock - Lock payroll sheet and mark adjustments as processed
const lockPayroll = async (req, res) => {
  const { companyId, userId } = req.user;
  const { month, year } = req.body;

  if (!month || !year) {
    return res.status(400).json({ message: 'Month and year are required' });
  }

  try {
    // 1. Lock payroll records
    await runQuery(`
      UPDATE payroll
      SET locked = 1
      WHERE companyId = ? AND month = ? AND year = ? AND locked = 0
    `, [companyId, month, year]);

    // 2. Mark adjustments calculated in this month as Processed
    await runQuery(`
      UPDATE adjustments
      SET status = 'Processed'
      WHERE companyId = ? AND applicableMonth = ? AND applicableYear = ? AND status = 'Pending'
    `, [companyId, month, year]);

    // Audit Log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, newValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`LOG_${Date.now()}`, companyId, userId, 'LOCK_PAYROLL', 'Payroll', `Locked payroll sheet for ${month}/${year}`]);

    // Send notifications to all employees that payslips are ready
    const employees = await allQuery("SELECT employeeId FROM employees WHERE companyId = ? AND status = 'Active'", [companyId]);
    for (const emp of employees) {
      await runQuery(`
        INSERT INTO notifications (notificationId, companyId, userId, title, message, type)
        VALUES (?, ?, ?, ?, ?, 'payroll')
      `, [`NOT_${Date.now()}_${emp.employeeId}`, companyId, `USR_${emp.employeeId}`, 'Payslip Available', `Your salary slip for ${month}/${year} has been generated. You can view and download it now.`, 'payroll']);
    }

    return res.status(200).json({ message: 'Payroll locked and adjustments processed' });
  } catch (err) {
    console.error('Lock payroll error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// POST /api/payroll/unlock - Unlock payroll sheet (Super Admin only)
const unlockPayroll = async (req, res) => {
  const { companyId, userId } = req.user;
  const { month, year } = req.body;

  try {
    // 1. Unlock payroll records
    await runQuery(`
      UPDATE payroll
      SET locked = 0
      WHERE companyId = ? AND month = ? AND year = ? AND locked = 1
    `, [companyId, month, year]);

    // 2. Revert adjustments back to Pending
    await runQuery(`
      UPDATE adjustments
      SET status = 'Pending'
      WHERE companyId = ? AND applicableMonth = ? AND applicableYear = ? AND status = 'Processed'
    `, [companyId, month, year]);

    // Audit Log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, newValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`LOG_${Date.now()}`, companyId, userId, 'UNLOCK_PAYROLL', 'Payroll', `Unlocked payroll sheet for ${month}/${year}`]);

    return res.status(200).json({ message: 'Payroll sheet unlocked successfully' });
  } catch (err) {
    console.error('Unlock payroll error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/payroll/records - Get list of saved payroll records
const getPayrollRecords = async (req, res) => {
  const { companyId } = req.user;
  const { month, year, branchId, departmentId, paymentStatus } = req.query;

  if (!month || !year) {
    return res.status(400).json({ message: 'Month and year are required' });
  }

  try {
    let sql = `
      SELECT p.*, e.name as employeeName, e.salaryType, e.monthlySalary, e.perDaySalary,
             b.name as branchName, d.name as departmentName
      FROM payroll p
      JOIN employees e ON p.employeeId = e.employeeId
      LEFT JOIN branches b ON e.branchId = b.branchId
      LEFT JOIN departments d ON e.departmentId = d.departmentId
      WHERE p.companyId = ? AND p.month = ? AND p.year = ?
    `;
    const params = [companyId, parseInt(month, 10), parseInt(year, 10)];

    if (branchId) {
      sql += ' AND e.branchId = ?';
      params.push(branchId);
    }
    if (departmentId) {
      sql += ' AND e.departmentId = ?';
      params.push(departmentId);
    }
    if (paymentStatus) {
      sql += ' AND p.paymentStatus = ?';
      params.push(paymentStatus);
    }

    const records = await allQuery(sql, params);

    // Parse structures
    const result = records.map(rec => {
      return {
        ...rec,
        attendanceSummary: JSON.parse(rec.attendanceSummary),
        earnings: JSON.parse(rec.earnings),
        deductions: JSON.parse(rec.deductions)
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Get payroll records error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PUT /api/payroll/:id/payment - HR: Mark salary as paid
const updatePaymentStatus = async (req, res) => {
  const { companyId, userId } = req.user;
  const { id } = req.params; // payrollId
  const { paymentStatus, paymentMode, remarks } = req.body; // paymentStatus: Paid/Hold, paymentMode: Cash/Bank/UPI

  try {
    const record = await getQuery('SELECT * FROM payroll WHERE payrollId = ? AND companyId = ?', [id, companyId]);
    if (!record) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    await runQuery(`
      UPDATE payroll
      SET paymentStatus = ?, paymentMode = ?, paymentDate = ?, remarks = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE payrollId = ?
    `, [paymentStatus, paymentMode || null, paymentStatus === 'Paid' ? todayStr : null, remarks || null, id]);

    // Insert Audit Log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue, newValue)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `LOG_${Date.now()}`, companyId, userId, 'UPDATE_PAYROLL_PAYMENT', 'Payroll',
      JSON.stringify(record),
      JSON.stringify({ paymentStatus, paymentMode })
    ]);

    return res.status(200).json({ message: 'Payment status updated successfully' });
  } catch (err) {
    console.error('Update payment error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/payroll/:id/slip - Download PDF Salary Slip
const downloadSalarySlip = async (req, res) => {
  const { companyId } = req.user;
  const { id } = req.params; // payrollId

  try {
    const record = await getQuery('SELECT * FROM payroll WHERE payrollId = ? AND companyId = ?', [id, companyId]);
    if (!record) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (record.locked !== 1) {
      return res.status(400).json({ message: 'Salary slip PDF can only be generated after payroll is finalized and locked' });
    }


    const employee = await getQuery(`
      SELECT e.*, b.name as branchName, d.name as departmentName, des.name as designationName, s.name as shiftName
      FROM employees e
      LEFT JOIN branches b ON e.branchId = b.branchId
      LEFT JOIN departments d ON e.departmentId = d.departmentId
      LEFT JOIN designations des ON e.designationId = des.designationId
      LEFT JOIN shifts s ON e.shiftId = s.shiftId
      WHERE e.employeeId = ?
    `, [record.employeeId]);

    const company = await getQuery('SELECT * FROM companies WHERE companyId = ?', [companyId]);

    // Unpack sub JSON structures
    record.attendanceSummary = JSON.parse(record.attendanceSummary);
    record.earnings = JSON.parse(record.earnings);
    record.deductions = JSON.parse(record.deductions);
    employee.bankDetails = JSON.parse(employee.bankDetails);

    // File name
    const tempDir = path.resolve(__dirname, '../../uploads/slips');
    const fileName = `slip_${record.employeeId}_${record.year}_${record.month}.pdf`;
    const outputPath = path.join(tempDir, fileName);

    await generateSalarySlipPDF(record, employee, company, outputPath);

    // Stream the file back
    return res.download(outputPath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to stream PDF file' });
        }
      }
      // Clean up file after download to save storage
      try {
        fs.unlinkSync(outputPath);
      } catch (unlinkErr) {
        console.warn('Failed to delete temp file:', unlinkErr.message);
      }
    });

  } catch (err) {
    console.error('Download slip error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  calculateEmployeeSalary,
  previewPayroll,
  runPayroll,
  lockPayroll,
  unlockPayroll,
  getPayrollRecords,
  updatePaymentStatus,
  downloadSalarySlip
};
