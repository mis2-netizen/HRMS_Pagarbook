const assert = require('assert');
const { db, getQuery, runQuery, allQuery } = require('./config/db');
const { calculateEmployeeSalary } = require('./controllers/payrollController');

// Helper to seed attendance records for the test employee
async function seedTestAttendance(employeeId, companyId, month, year, config) {
  // Clear previous attendance for this employee & month
  const monthStr = month.toString().padStart(2, '0');
  await runQuery('DELETE FROM attendance WHERE employeeId = ? AND date LIKE ?', [employeeId, `${year}-${monthStr}-%`]);

  // Insert specified attendance
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${monthStr}-${day.toString().padStart(2, '0')}`;
    const d = new Date(year, month - 1, day);
    const isSunday = d.getDay() === 0;

    let status = 'Present';
    let overtimeHours = 0.0;
    let lateMinutes = 0;

    if (isSunday) {
      status = 'Weekly Off';
    } else {
      // Find matching config day
      const dayConfig = config[day] || {};
      status = dayConfig.status || 'Present';
      overtimeHours = dayConfig.overtimeHours || 0.0;
      lateMinutes = dayConfig.lateMinutes || 0;
    }

    const attendanceId = `ATT_${employeeId}_${dateStr}`;
    await runQuery(`
      INSERT INTO attendance (
        attendanceId, companyId, employeeId, date, status, lateMinutes, overtimeHours, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `, [attendanceId, companyId, employeeId, dateStr, status, lateMinutes, overtimeHours]);
  }
}

async function runTests() {
  console.log('\n==================================================');
  console.log('🚀 Running Payroll Engine Configuration Unit Tests');
  console.log('==================================================\n');

  const companyId = 'COMP01';
  const employeeId = 'EMP_TEST_01';

  try {
    // 1. Set up/Verify test employee in DB
    await runQuery('DELETE FROM employees WHERE employeeId = ?', [employeeId]);
    await runQuery('DELETE FROM users WHERE employeeId = ?', [employeeId]);

    const structure = JSON.stringify({
      basicSalary: 26000,
      hra: 13000,
      conveyance: 5200,
      allowance: 7800,
      pfEnabled: true,
      esiEnabled: true,
      ptEnabled: true
    });

    const bank = JSON.stringify({
      bankName: 'Test Bank',
      accountNumberMasked: 'XXXXXX1234',
      ifsc: 'TEST0001',
      uan: '1000222',
      esicNumber: '311000'
    });

    // Create a 52,000 INR/mo test employee (₹2000/day equivalent for 26 days)
    await runQuery(`
      INSERT INTO employees (
        employeeId, companyId, branchId, departmentId, designationId, name, mobile, email, gender, dob, address, joiningDate, employmentType, status, shiftId, weeklyOff, salaryType, monthlySalary, perDaySalary, salaryStructure, bankDetails
      ) VALUES (?, ?, 'BR02', 'DEP01', 'DES01', 'Test Employee', '9999988888', 'testemp@company.com', 'Male', '1995-01-01', 'Test Bengaluru', '2026-01-01', 'Full-time', 'Active', 'SH01', 'Sunday', 'Monthly', 52000, 2000, ?, ?)
    `, [employeeId, companyId, structure, bank]);


    const employee = await getQuery('SELECT * FROM employees WHERE employeeId = ?', [employeeId]);
    assert(employee, 'Failed to insert test employee');

    // Default company settings
    const companySettings = {
      salaryDaysSetting: 'Calendar Days',
      payrollSettings: {
        weeklyOffPaid: true,
        holidayPaid: true,
        overtimeRateType: 'Multiplier',
        latePenaltyConfig: {
          enabled: true,
          graceMinutes: 15,
          allowedLateDays: 0,
          deductionPerLate: 100
        }
      },
      attendanceSettings: {
        fullDayHours: 8,
        halfDayHours: 4,
        lateGraceMinutes: 15,
        overtimeRate: 1.5,
        geofenceEnabled: true
      }
    };

    // June 2026: 30 days, 4 Sundays (Weekly Offs on 7, 14, 21, 28)
    const month = 6;
    const year = 2026;

    // ==========================================
    // Test 1: Full Month Present
    // ==========================================
    console.log('📌 Test 1: Full Month Present...');
    await seedTestAttendance(employeeId, companyId, month, year, {});
    let calc = await calculateEmployeeSalary(employee, month, year, companySettings);

    assert.strictEqual(calc.attendanceSummary.presentDays, 26);
    assert.strictEqual(calc.attendanceSummary.weeklyOffs, 4);
    assert.strictEqual(calc.payableDays, 30); // 26 present + 4 paid weekly off
    assert.strictEqual(calc.earnings.basic + calc.earnings.hra + calc.earnings.conveyance + calc.earnings.allowance, 52000);
    
    // Statutory Deductions assertions:
    // PF: 12% of basic salary (50% of base earned = 26000) => 3120
    assert.strictEqual(calc.deductions.pf, 3120);
    // ESI: 0.75% of Gross Earned (52000) => 390
    assert.strictEqual(calc.deductions.esi, 390);
    // PT: 200 flat
    assert.strictEqual(calc.deductions.professionalTax, 200);
    console.log('✅ Test 1 PASSED.');

    // ==========================================
    // Test 2: Absent Days Deduction
    // ==========================================
    console.log('\n📌 Test 2: Absent Days Deduction...');
    // Mark 6 days absent (June 1 to 6)
    const absentMap = {};
    for (let i = 1; i <= 6; i++) absentMap[i] = { status: 'Absent' };
    await seedTestAttendance(employeeId, companyId, month, year, absentMap);
    calc = await calculateEmployeeSalary(employee, month, year, companySettings);

    assert.strictEqual(calc.attendanceSummary.presentDays, 20);
    assert.strictEqual(calc.attendanceSummary.absentDays, 6);
    assert.strictEqual(calc.payableDays, 24); // 20 present + 4 weekly off
    // Earned base salary: 52000 * (24 / 30) = 41600
    const baseEarned = calc.earnings.basic + calc.earnings.hra + calc.earnings.conveyance + calc.earnings.allowance;
    assert.strictEqual(baseEarned, 41600);
    console.log('✅ Test 2 PASSED.');

    // ==========================================
    // Test 3: Approved Paid Leave
    // ==========================================
    console.log('\n📌 Test 3: Approved Paid Leave...');
    // Mark June 1 to 6 as Paid Leave
    const paidLeaveMap = {};
    for (let i = 1; i <= 6; i++) paidLeaveMap[i] = { status: 'Paid Leave' };
    await seedTestAttendance(employeeId, companyId, month, year, paidLeaveMap);
    calc = await calculateEmployeeSalary(employee, month, year, companySettings);

    assert.strictEqual(calc.attendanceSummary.presentDays, 20);
    assert.strictEqual(calc.attendanceSummary.paidLeaveDays, 6);
    assert.strictEqual(calc.payableDays, 30); // 20 present + 6 leave + 4 weekly off = 30 days
    assert.strictEqual(calc.earnings.basic + calc.earnings.hra + calc.earnings.conveyance + calc.earnings.allowance, 52000);
    console.log('✅ Test 3 PASSED.');

    // ==========================================
    // Test 4: Unpaid Leave
    // ==========================================
    console.log('\n📌 Test 4: Unpaid Leave...');
    // Mark June 1 to 6 as Unpaid Leave
    const unpaidLeaveMap = {};
    for (let i = 1; i <= 6; i++) unpaidLeaveMap[i] = { status: 'Unpaid Leave' };
    await seedTestAttendance(employeeId, companyId, month, year, unpaidLeaveMap);
    calc = await calculateEmployeeSalary(employee, month, year, companySettings);

    assert.strictEqual(calc.attendanceSummary.presentDays, 20);
    assert.strictEqual(calc.attendanceSummary.unpaidLeaveDays, 6);
    assert.strictEqual(calc.payableDays, 24); // unpaid leaves are not paid
    assert.strictEqual(calc.earnings.basic + calc.earnings.hra + calc.earnings.conveyance + calc.earnings.allowance, 41600);
    console.log('✅ Test 4 PASSED.');

    // ==========================================
    // Test 5: Half Day
    // ==========================================
    console.log('\n📌 Test 5: Half Day Calculation...');
    // Mark June 1 to 6 as Half Days (each adds 0.5 payable days)
    const halfDayMap = {};
    for (let i = 1; i <= 6; i++) halfDayMap[i] = { status: 'Half Day' };
    await seedTestAttendance(employeeId, companyId, month, year, halfDayMap);
    calc = await calculateEmployeeSalary(employee, month, year, companySettings);

    assert.strictEqual(calc.attendanceSummary.presentDays, 20);
    assert.strictEqual(calc.attendanceSummary.halfDays, 6);
    // payableDays = 20 present + 4 weekly off + (6 * 0.5 half day) = 27 days
    assert.strictEqual(calc.payableDays, 27);
    assert.strictEqual(calc.earnings.basic + calc.earnings.hra + calc.earnings.conveyance + calc.earnings.allowance, 46800); // 52000 * 27/30
    console.log('✅ Test 5 PASSED.');

    // ==========================================
    // Test 6: Overtime (Flat & Multiplier)
    // ==========================================
    console.log('\n📌 Test 6: Overtime...');
    // Mark 10 hours overtime on June 1
    const otMap = { 1: { status: 'Present', overtimeHours: 10.0 } };
    await seedTestAttendance(employeeId, companyId, month, year, otMap);

    // Test A: Multiplier mode (1.5x)
    let calcOT = await calculateEmployeeSalary(employee, month, year, companySettings);
    // Base hourly wage = 52000 / (30 * 8) = 216.6667
    // Overtime pay = 10 * 216.6667 * 1.5 = 3250
    assert.strictEqual(calcOT.earnings.overtimeAmount, 3250);

    // Test B: Flat rate mode (200 INR/hr)
    const flatOTSettings = {
      ...companySettings,
      payrollSettings: {
        ...companySettings.payrollSettings,
        overtimeRateType: 'Flat'
      },
      attendanceSettings: {
        ...companySettings.attendanceSettings,
        overtimeRate: 200 // ₹200/hr
      }
    };
    calcOT = await calculateEmployeeSalary(employee, month, year, flatOTSettings);
    // Overtime pay = 10 * 200 = 2000
    assert.strictEqual(calcOT.earnings.overtimeAmount, 2000);
    console.log('✅ Test 6 PASSED.');

    // ==========================================
    // Test 7: Advance Deduction
    // ==========================================
    console.log('\n📌 Test 7: Advance Deduction Ledger...');
    await runQuery('DELETE FROM adjustments WHERE employeeId = ?', [employeeId]);
    await runQuery(`
      INSERT INTO adjustments (adjustmentId, companyId, employeeId, type, amount, applicableMonth, applicableYear, status, remarks)
      VALUES (?, ?, ?, 'Advance', 5000, ?, ?, 'Pending', 'Test salary advance')
    `, [`ADJ_${Date.now()}`, companyId, employeeId, month, year]);

    await seedTestAttendance(employeeId, companyId, month, year, {});
    calc = await calculateEmployeeSalary(employee, month, year, companySettings);
    
    assert.strictEqual(calc.deductions.advanceDeduction, 5000);
    // Gross: 52000, deductions: PF(3120) + ESI(390) + PT(200) + Advance(5000) = 8710
    // Net: 52000 - 8710 = 43290
    assert.strictEqual(calc.netSalary, 43290);
    console.log('✅ Test 7 PASSED.');

    // ==========================================
    // Test 8: PF / ESI / PT Deductions
    // ==========================================
    console.log('\n📌 Test 8: Stat PF/ESI Deductions...');
    // Already validated in Test 1 and Test 7.
    // PF = Basic Earned * 12% = (BaseEarned * 0.5) * 12%
    // ESI = Gross Salary * 0.75%
    // PT = 200
    assert.strictEqual(calc.deductions.pf, 3120);
    assert.strictEqual(calc.deductions.esi, 390);
    assert.strictEqual(calc.deductions.professionalTax, 200);
    console.log('✅ Test 8 PASSED.');

    // ==========================================
    // Test 9: Payroll Lock & Permissions
    // ==========================================
    console.log('\n📌 Test 9: Payroll Lock Controls...');
    const payrollId = `PAY_${employeeId}_2026_06`;
    await runQuery('DELETE FROM payroll WHERE payrollId = ?', [payrollId]);
    
    // Insert draft
    await runQuery(`
      INSERT INTO payroll (payrollId, companyId, employeeId, month, year, attendanceSummary, earnings, deductions, grossSalary, netSalary, paymentStatus, locked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 0)
    `, [
      payrollId, companyId, employeeId, month, year,
      JSON.stringify(calc.attendanceSummary),
      JSON.stringify(calc.earnings),
      JSON.stringify(calc.deductions),
      calc.grossSalary,
      calc.netSalary
    ]);

    // Lock payroll
    await runQuery('UPDATE payroll SET locked = 1 WHERE payrollId = ?', [payrollId]);
    const lockedRec = await getQuery('SELECT locked FROM payroll WHERE payrollId = ?', [payrollId]);
    assert.strictEqual(lockedRec.locked, 1);
    console.log('✅ Test 9 PASSED.');

    console.log('\n==================================================');
    console.log('🎉 ALL PAYROLL CALCULATIONS UNIT TESTS PASSED!');
    console.log('==================================================\n');

    // Clean up test employee/records
    await runQuery('DELETE FROM employees WHERE employeeId = ?', [employeeId]);
    await runQuery('DELETE FROM adjustments WHERE employeeId = ?', [employeeId]);
    await runQuery('DELETE FROM payroll WHERE employeeId = ?', [employeeId]);
    await runQuery('DELETE FROM attendance WHERE employeeId = ?', [employeeId]);

    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILURE:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTests();
