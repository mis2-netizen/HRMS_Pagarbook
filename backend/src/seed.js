const bcrypt = require('bcryptjs');
const { initDB, db, runQuery } = require('./config/db');

const seed = async () => {
  try {
    // 1. Initialize Tables
    await initDB();

    console.log('Seeding data...');
    
    // No SQLite PRAGMA required for PostgreSQL, resolving constraints by ordering updates

    // Clear existing data to prevent primary key collisions on multiple runs
    await runQuery('DELETE FROM notifications');
    await runQuery('DELETE FROM auditLogs');
    await runQuery('DELETE FROM holidays');
    await runQuery('DELETE FROM adjustments');
    await runQuery('DELETE FROM payroll');
    await runQuery('DELETE FROM leaveBalances');
    await runQuery('DELETE FROM leaveRequests');
    await runQuery('DELETE FROM attendance');
    await runQuery('DELETE FROM users');
    await runQuery('DELETE FROM employees');
    await runQuery('DELETE FROM shifts');
    await runQuery('DELETE FROM designations');
    await runQuery('DELETE FROM departments');
    await runQuery('DELETE FROM branches');
    await runQuery('DELETE FROM companies');

    console.log('Cleared existing data.');

    // 2. Insert Company
    const companyId = 'COMP01';
    const payrollSettings = JSON.stringify({
      salaryDaysSetting: 'Calendar Days',
      pfDeductionConfig: { enabled: true, rate: 12 },
      esiDeductionConfig: { enabled: true, rate: 0.75 },
      ptDeductionConfig: { enabled: true, amount: 200 },
      weeklyOffPaid: true,
      holidayPaid: true,
      overtimeRateType: 'Multiplier',
      latePenaltyConfig: { enabled: true, graceMinutes: 15, allowedLateDays: 0, deductionPerLate: 100 }
    });

    const attendanceSettings = JSON.stringify({
      fullDayHours: 8.0,
      halfDayHours: 4.0,
      lateGraceMinutes: 15,
      overtimeRate: 1.5,
      geofenceEnabled: true
    });

    await runQuery(`
      INSERT INTO companies (companyId, name, logoUrl, address, phone, email, payrollSettings, attendanceSettings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, 'Pagarbook Corp', 'https://picsum.photos/200', '123 HR Tech Boulevard, Suite 500', '+91 9999988888', 'contact@pagarbook.com', payrollSettings, attendanceSettings]);

    // 3. Insert Branches
    const branches = [
      { branchId: 'BR01', name: 'Mumbai Head Office', address: '405, Maker Chambers, Nariman Point, Mumbai', lat: 19.0760, lng: 72.8777, radius: 100 },
      { branchId: 'BR02', name: 'Bengaluru Tech Hub', address: '12, 100 Feet Rd, Koramangala, Bengaluru', lat: 12.9716, lng: 77.5946, radius: 200 }
    ];
    for (const br of branches) {
      await runQuery(`
        INSERT INTO branches (branchId, companyId, name, address, latitude, longitude, radiusMeters, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `, [br.branchId, companyId, br.name, br.address, br.lat, br.lng, br.radius]);
    }

    // 4. Insert Departments
    const departments = [
      { departmentId: 'DEP01', name: 'Engineering' },
      { departmentId: 'DEP02', name: 'Human Resources' },
      { departmentId: 'DEP03', name: 'Sales' }
    ];
    for (const dep of departments) {
      await runQuery(`
        INSERT INTO departments (departmentId, companyId, name, status)
        VALUES (?, ?, ?, 'active')
      `, [dep.departmentId, companyId, dep.name]);
    }

    // 5. Insert Designations
    const designations = [
      { designationId: 'DES01', name: 'Software Engineer' },
      { designationId: 'DES02', name: 'HR Manager' },
      { designationId: 'DES03', name: 'Sales Executive' },
      { designationId: 'DES04', name: 'Manager' },
      { designationId: 'DES05', name: 'Super Admin' }
    ];
    for (const des of designations) {
      await runQuery(`
        INSERT INTO designations (designationId, companyId, name, status)
        VALUES (?, ?, ?, 'active')
      `, [des.designationId, companyId, des.name]);
    }

    // 6. Insert Shifts
    const shifts = [
      { shiftId: 'SH01', name: 'Day Shift', start: '09:00', end: '18:00', weeklyOffs: 'Sunday' },
      { shiftId: 'SH02', name: 'Night Shift', start: '22:00', end: '07:00', weeklyOffs: 'Sunday' }
    ];
    for (const sh of shifts) {
      await runQuery(`
        INSERT INTO shifts (shiftId, companyId, name, startTime, endTime, fullDayHours, halfDayHours, lateGraceMinutes, weeklyOffs)
        VALUES (?, ?, ?, ?, ?, 8.0, 4.0, 15, ?)
      `, [sh.shiftId, companyId, sh.name, sh.start, sh.end, sh.weeklyOffs]);
    }

    // 7. Hash password helper
    const salt = bcrypt.genSaltSync(10);
    const superAdminPassword = bcrypt.hashSync('admin123', salt);
    const hrPassword = bcrypt.hashSync('hr123', salt);
    const empPassword = bcrypt.hashSync('emp123', salt);

    // 8. Insert Super Admin User
    await runQuery(`
      INSERT INTO users (userId, name, email, passwordHash, mobile, role, companyId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, ['USR_ADMIN', 'Super Admin User', 'admin@company.com', superAdminPassword, '9999900000', 'super_admin', companyId, 'active']);

    // 9. Insert HR Admin User (will also have an employee link)
    await runQuery(`
      INSERT INTO users (userId, name, email, passwordHash, mobile, role, companyId, branchId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ['USR_HR', 'HR Administrator', 'hr@company.com', hrPassword, '9999900001', 'hr', companyId, 'BR01', 'active']);

    // 10. Insert Employees
    const empData = [
      { id: 'EMP01', name: 'John Doe', mobile: '9876500001', email: 'john@company.com', gender: 'Male', dob: '1992-05-15', address: 'Koramangala, Bengaluru', joining: '2022-01-10', type: 'Full-time', shift: 'SH01', branch: 'BR02', dep: 'DEP01', des: 'DES01', salary: 80000, salaryType: 'Monthly', role: 'employee' },
      { id: 'EMP02', name: 'Jane Smith', mobile: '9876500002', email: 'jane@company.com', gender: 'Female', dob: '1990-08-22', address: 'Bandra West, Mumbai', joining: '2021-06-15', type: 'Full-time', shift: 'SH01', branch: 'BR01', dep: 'DEP02', des: 'DES02', salary: 70000, salaryType: 'Monthly', role: 'hr' },
      { id: 'EMP03', name: 'Bob Johnson', mobile: '9876500003', email: 'bob@company.com', gender: 'Male', dob: '1995-12-05', address: 'Andheri East, Mumbai', joining: '2023-03-20', type: 'Full-time', shift: 'SH01', branch: 'BR01', dep: 'DEP03', des: 'DES03', salary: 40000, salaryType: 'Monthly', role: 'employee' },
      { id: 'EMP04', name: 'Alice Brown', mobile: '9876500004', email: 'alice@company.com', gender: 'Female', dob: '1994-03-18', address: 'Indiranagar, Bengaluru', joining: '2022-11-01', type: 'Full-time', shift: 'SH01', branch: 'BR02', dep: 'DEP01', des: 'DES01', salary: 90000, salaryType: 'Monthly', role: 'employee' },
      { id: 'EMP05', name: 'Charlie Green', mobile: '9876500005', email: 'charlie@company.com', gender: 'Male', dob: '1996-07-30', address: 'Thane, Mumbai', joining: '2023-05-01', type: 'Full-time', shift: 'SH01', branch: 'BR01', dep: 'DEP03', des: 'DES03', salary: 35000, salaryType: 'Monthly', role: 'employee' },
      { id: 'EMP06', name: 'David White', mobile: '9876500006', email: 'david@company.com', gender: 'Male', dob: '1988-02-14', address: 'Whitefield, Bengaluru', joining: '2020-04-01', type: 'Full-time', shift: 'SH01', branch: 'BR02', dep: 'DEP01', des: 'DES04', salary: 120000, salaryType: 'Monthly', role: 'manager' },
      { id: 'EMP07', name: 'Eva Black', mobile: '9876500007', email: 'eva@company.com', gender: 'Female', dob: '1997-10-11', address: 'HSR Layout, Bengaluru', joining: '2024-01-15', type: 'Full-time', shift: 'SH01', branch: 'BR02', dep: 'DEP01', des: 'DES01', salary: 75000, salaryType: 'Monthly', role: 'employee' },
      { id: 'EMP08', name: 'Frank Miller', mobile: '9876500008', email: 'frank@company.com', gender: 'Male', dob: '1993-09-02', address: 'Chembur, Mumbai', joining: '2023-09-01', type: 'Full-time', shift: 'SH01', branch: 'BR01', dep: 'DEP03', des: 'DES03', salary: 42000, salaryType: 'Monthly', role: 'employee' },
      { id: 'EMP09', name: 'Grace Lee', mobile: '9876500009', email: 'grace@company.com', gender: 'Female', dob: '1995-11-25', address: 'Jayanagar, Bengaluru', joining: '2023-10-10', type: 'Full-time', shift: 'SH01', branch: 'BR02', dep: 'DEP01', des: 'DES01', salary: 82000, salaryType: 'Monthly', role: 'employee' },
      { id: 'EMP10', name: 'Henry Wilson', mobile: '9876500010', email: 'henry@company.com', gender: 'Male', dob: '1998-04-05', address: 'Electronic City, Bengaluru', joining: '2024-02-01', type: 'Contract', shift: 'SH01', branch: 'BR02', dep: 'DEP01', des: 'DES01', salary: 0, perDaySalary: 2000, salaryType: 'Daily wage', role: 'employee' }
    ];

    const seededEmployees = [];

    for (const emp of empData) {
      // 10.1 Prepare Salary Structure JSON
      const structure = JSON.stringify({
        basicSalary: emp.salaryType === 'Monthly' ? emp.salary * 0.5 : 0,
        hra: emp.salaryType === 'Monthly' ? emp.salary * 0.25 : 0,
        conveyance: emp.salaryType === 'Monthly' ? emp.salary * 0.1 : 0,
        allowance: emp.salaryType === 'Monthly' ? emp.salary * 0.15 : 0,
        pfEnabled: emp.salaryType === 'Monthly',
        esiEnabled: emp.salaryType === 'Monthly',
        ptEnabled: emp.salaryType === 'Monthly'
      });

      // 10.2 Mask Bank account details
      const bankDetails = JSON.stringify({
        bankName: 'HDFC Bank',
        accountNumberMasked: 'XXXXXX' + emp.mobile.slice(-4),
        ifsc: 'HDFC0000240',
        uan: emp.salaryType === 'Monthly' ? '100876543210' : '',
        esicNumber: emp.salaryType === 'Monthly' ? '31123456789012345' : ''
      });

      // 10.3 Calculate Per Day Salary based on 26 fixed days
      const perDaySalary = emp.salaryType === 'Monthly' ? Math.round(emp.salary / 26) : emp.perDaySalary;

      await runQuery(`
        INSERT INTO employees (employeeId, companyId, branchId, departmentId, designationId, managerId, name, mobile, email, gender, dob, address, joiningDate, employmentType, status, shiftId, weeklyOff, salaryType, monthlySalary, perDaySalary, salaryStructure, bankDetails)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        emp.id, companyId, emp.branch, emp.dep, emp.des,
        emp.name, emp.mobile, emp.email, emp.gender, emp.dob, emp.address, emp.joining,
        emp.type, 'Active', emp.shift, 'Sunday', emp.salaryType, emp.salary, perDaySalary,
        structure, bankDetails
      ]);

      // 10.4 Create User Record for Employee
      await runQuery(`
        INSERT INTO users (userId, employeeId, name, email, passwordHash, mobile, role, companyId, branchId, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, ['USR_' + emp.id, emp.id, emp.name, emp.email, empPassword, emp.mobile, emp.role, companyId, emp.branch]);

      // 10.5 Create Leave Balance for 2026
      const leaveTypes = ['Casual', 'Sick', 'Earned', 'Unpaid'];
      for (const lt of leaveTypes) {
        let opening = 0;
        if (lt === 'Casual') opening = 8;
        else if (lt === 'Sick') opening = 8;
        else if (lt === 'Earned') opening = 12;
        await runQuery(`
          INSERT INTO leaveBalances (balanceId, companyId, employeeId, leaveType, opening, accrued, used, pending, available, year)
          VALUES (?, ?, ?, ?, ?, 0.0, 0.0, 0.0, ?, 2026)
        `, [`BAL_${emp.id}_${lt}`, companyId, emp.id, lt, opening, opening]);
      }

      seededEmployees.push(emp);
    }

    // Resolve circular manager relationship: assign EMP06 as manager to other employees
    console.log('Resolving manager relationships...');
    await runQuery(`
      UPDATE employees SET managerId = 'EMP06' WHERE employeeId != 'EMP06'
    `);

    // 11. Seed Holidays
    const holidays = [
      { date: '2026-05-25', title: 'Memorial Day' },
      { date: '2026-06-15', title: 'Regional Festival' }
    ];
    for (const h of holidays) {
      await runQuery(`
        INSERT INTO holidays (holidayId, companyId, date, title, paidHoliday)
        VALUES (?, ?, ?, ?, 1)
      `, [`HOL_${h.date}`, companyId, h.date, h.title]);
    }

    // 12. Seed 30 Days of Attendance (May 19, 2026 to June 17, 2026)
    // We will simulate daily logs. Sundays are weekly off.
    const startDate = new Date('2026-05-19');
    const endDate = new Date('2026-06-17');

    console.log('Generating 30 days of attendance logs...');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday

      const isSunday = dayOfWeek === 0;
      const isHoliday = dateStr === '2026-05-25' || dateStr === '2026-06-15';

      for (const emp of seededEmployees) {
        let status = 'Present';
        let inTime = null;
        let outTime = null;
        let workingHours = 0.0;
        let lateMinutes = 0;
        let earlyOutMinutes = 0;
        let overtimeHours = 0.0;

        if (isSunday) {
          status = 'Weekly Off';
        } else if (isHoliday) {
          status = 'Holiday';
        } else {
          // Present, Late, Absent, Half Day or Leave
          const rand = Math.random();
          if (rand < 0.04) {
            status = 'Absent';
          } else if (rand < 0.07) {
            status = 'Half Day';
            inTime = '09:00:00';
            outTime = '13:00:00';
            workingHours = 4.0;
          } else if (rand < 0.10) {
            status = 'Paid Leave';
          } else {
            status = 'Present';
            // Regular punch timings
            // Shift starts 09:00, ends 18:00
            let startHour = 8;
            let startMin = 45 + Math.floor(Math.random() * 30); // 8:45 AM to 9:15 AM
            
            // Check if late (past 9:15 AM)
            if (startHour === 9 && startMin > 15) {
              lateMinutes = startMin - 15;
            } else if (startHour > 9) {
              lateMinutes = (startHour - 9) * 60 + startMin - 15;
            }

            let endHour = 18;
            let endMin = Math.floor(Math.random() * 30); // 6:00 PM to 6:30 PM
            // Sometime leaves early
            if (Math.random() < 0.05) {
              endHour = 17;
              endMin = 30 + Math.floor(Math.random() * 20); // 5:30 PM to 5:50 PM
              earlyOutMinutes = (18 - endHour) * 60 - endMin;
            }

            // Overtime hours
            if (endHour >= 18 && endMin > 0) {
              overtimeHours = Number(((endHour - 18) + endMin / 60).toFixed(2));
            }

            const inHStr = startHour.toString().padStart(2, '0');
            const inMStr = startMin.toString().padStart(2, '0');
            const outHStr = endHour.toString().padStart(2, '0');
            const outMStr = endMin.toString().padStart(2, '0');

            inTime = `${inHStr}:${inMStr}:00`;
            outTime = `${outHStr}:${outMStr}:00`;

            const diff = (endHour + endMin / 60) - (startHour + startMin / 60);
            workingHours = Number(diff.toFixed(2));
          }
        }

        // Latitudes/Longitudes close to branch office to look realistic
        const isMumbai = emp.branch === 'BR01';
        const centerLat = isMumbai ? 19.0760 : 12.9716;
        const centerLng = isMumbai ? 72.8777 : 77.5946;

        // Slight offset
        const latOffset = (Math.random() - 0.5) * 0.0008; // small distance
        const lngOffset = (Math.random() - 0.5) * 0.0008;

        await runQuery(`
          INSERT INTO attendance (
            attendanceId, companyId, employeeId, date, inTime, outTime, workingHours, status,
            lateMinutes, earlyOutMinutes, overtimeHours, inPhotoUrl, outPhotoUrl,
            inLatitude, inLongitude, outLatitude, outLongitude, inAddress, outAddress, deviceId, source, correctionStatus
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'mobile', 'None')
        `, [
          `ATT_${emp.id}_${dateStr}`, companyId, emp.id, dateStr, inTime, outTime, workingHours, status,
          lateMinutes, earlyOutMinutes, overtimeHours,
          inTime ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80' : null,
          outTime ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80' : null,
          inTime ? centerLat + latOffset : null,
          inTime ? centerLng + lngOffset : null,
          outTime ? centerLat + latOffset : null,
          outTime ? centerLng + lngOffset : null,
          inTime ? (isMumbai ? 'Nariman Point, Mumbai' : 'Koramangala, Bengaluru') : null,
          outTime ? (isMumbai ? 'Nariman Point, Mumbai' : 'Koramangala, Bengaluru') : null,
          inTime ? 'DEV_MOCK_123' : null
        ]);
      }
    }

    // 13. Seed Leave Requests
    const leaves = [
      { id: 'LR01', emp: 'EMP01', type: 'Sick', from: '2026-06-02', to: '2026-06-03', days: 2, reason: 'Viral fever', status: 'Approved' },
      { id: 'LR02', emp: 'EMP03', type: 'Casual', from: '2026-06-20', to: '2026-06-20', days: 1, reason: 'Personal work at bank', status: 'Pending' },
      { id: 'LR03', emp: 'EMP04', type: 'Earned', from: '2026-05-12', to: '2026-05-15', days: 4, reason: 'Family function in hometown', status: 'Approved' },
      { id: 'LR04', emp: 'EMP05', type: 'Sick', from: '2026-06-10', to: '2026-06-10', days: 1, reason: 'Dental appointment', status: 'Rejected', rejectReason: 'Urgent client meeting on same day' }
    ];
    for (const lv of leaves) {
      await runQuery(`
        INSERT INTO leaveRequests (leaveId, companyId, employeeId, leaveType, fromDate, toDate, totalDays, halfDay, reason, status, approvedBy, approvedAt, rejectionReason)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
      `, [
        lv.id, companyId, lv.emp, lv.type, lv.from, lv.to, lv.days, lv.reason, lv.status,
        lv.status === 'Approved' ? 'USR_HR' : null,
        lv.status === 'Approved' ? '2026-06-01 10:00:00' : null,
        lv.rejectReason || null
      ]);

      // If approved, update used and available leave balances
      if (lv.status === 'Approved') {
        await runQuery(`
          UPDATE leaveBalances
          SET used = used + ?, available = available - ?
          WHERE employeeId = ? AND leaveType = ? AND year = 2026
        `, [lv.days, lv.days, lv.emp, lv.type]);
      }
    }

    // 14. Seed Adjustments
    const adjustments = [
      { id: 'ADJ01', emp: 'EMP01', type: 'Bonus', amount: 5000, month: 5, year: 2026, remarks: 'Quarterly Dev Excellence Bonus' },
      { id: 'ADJ02', emp: 'EMP03', type: 'Advance', amount: 10000, month: 6, year: 2026, remarks: 'Advance for medical emergency' },
      { id: 'ADJ03', emp: 'EMP04', type: 'Incentive', amount: 3000, month: 5, year: 2026, remarks: 'Project completion incentive' },
      { id: 'ADJ04', emp: 'EMP05', type: 'Penalty', amount: 500, month: 5, year: 2026, remarks: 'Damage to office property' }
    ];
    for (const adj of adjustments) {
      await runQuery(`
        INSERT INTO adjustments (adjustmentId, companyId, employeeId, type, amount, applicableMonth, applicableYear, recurring, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Processed', ?)
      `, [adj.id, companyId, adj.emp, adj.type, adj.amount, adj.month, adj.year, adj.remarks]);
    }

    // 15. Seed Finalized Payroll for May 2026
    // Since May has 31 calendar days, let's assume salary days setting is Fixed 26 days.
    // We will insert historical records for all 10 employees for May 2026.
    console.log('Generating historical payroll data for May 2026...');
    for (const emp of seededEmployees) {
      const summary = JSON.stringify({
        presentDays: 20,
        absentDays: 1,
        halfDays: 1,
        paidLeaveDays: 2,
        unpaidLeaveDays: 0,
        weeklyOffs: 5,
        holidays: 2,
        latePenalties: 0,
        overtimeHours: 4.5
      });

      // Simple calculation simulation
      const baseSalary = emp.salaryType === 'Monthly' ? emp.salary : emp.perDaySalary * 26;
      const otAmt = Math.round(emp.salaryType === 'Monthly' ? (baseSalary / 208) * 1.5 * 4.5 : 0); // approx OT
      
      const earnings = JSON.stringify({
        basic: Math.round(baseSalary * 0.5),
        hra: Math.round(baseSalary * 0.25),
        conveyance: Math.round(baseSalary * 0.1),
        allowance: Math.round(baseSalary * 0.15),
        bonus: emp.id === 'EMP01' ? 5000 : 0,
        incentive: emp.id === 'EMP04' ? 3000 : 0,
        overtimeAmount: otAmt
      });

      const pf = emp.salaryType === 'Monthly' ? Math.round(baseSalary * 0.12) : 0;
      const esi = emp.salaryType === 'Monthly' ? Math.round(baseSalary * 0.0075) : 0;
      const pt = emp.salaryType === 'Monthly' ? 200 : 0;
      const penalty = emp.id === 'EMP05' ? 500 : 0;

      const deductions = JSON.stringify({
        advanceDeduction: 0,
        loanDeduction: 0,
        pf,
        esi,
        professionalTax: pt,
        tds: 0,
        latePenalty: 0,
        earlyOutPenalty: 0,
        otherDeductions: penalty
      });

      const gross = baseSalary + (emp.id === 'EMP01' ? 5000 : 0) + (emp.id === 'EMP04' ? 3000 : 0) + otAmt;
      const net = gross - (pf + esi + pt + penalty);

      const salarySlipUrl = `/slips/may_2026_${emp.id}.pdf`;
      await runQuery(`
        INSERT INTO payroll (
          payrollId, companyId, employeeId, month, year, attendanceSummary, earnings, deductions, grossSalary, netSalary,
          paymentStatus, paymentDate, paymentMode, salarySlipUrl, locked, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Paid', '2026-06-05', 'Bank Transfer', ?, 1, 'May payroll processed successfully')
      `, [`PAY_${emp.id}_2026_05`, companyId, emp.id, 5, 2026, summary, earnings, deductions, gross, net, salarySlipUrl]);
    }

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding database:', err.message);
  } finally {
    db.close((closeErr) => {
      if (closeErr) console.error('Error closing database:', closeErr);
    });
  }
};

seed();
