const { runQuery, getQuery, allQuery } = require('../config/db');
const bcrypt = require('bcryptjs');

// Helper to generate a unique employee ID
const generateEmployeeId = async (companyId) => {
  const lastEmp = await getQuery('SELECT employeeId FROM employees WHERE companyId = ? ORDER BY createdAt DESC LIMIT 1', [companyId]);
  if (!lastEmp) {
    return 'EMP001';
  }
  const match = lastEmp.employeeId.match(/\d+/);
  if (!match) {
    return 'EMP' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  }
  const nextNum = parseInt(match[0], 10) + 1;
  return 'EMP' + nextNum.toString().padStart(3, '0');
};

// GET /api/employees - List all employees with filters
const getEmployees = async (req, res) => {
  const { companyId } = req.user;
  const { search, branchId, departmentId, status } = req.query;

  try {
    let sql = `
      SELECT e.employeeId, e.name, e.mobile, e.email, e.gender, e.employmentType, e.status, e.salaryType, e.monthlySalary, e.joiningDate,
             b.name as branchName, d.name as departmentName, des.name as designationName, s.name as shiftName,
             m.name as managerName
      FROM employees e
      LEFT JOIN branches b ON e.branchId = b.branchId
      LEFT JOIN departments d ON e.departmentId = d.departmentId
      LEFT JOIN designations des ON e.designationId = des.designationId
      LEFT JOIN shifts s ON e.shiftId = s.shiftId
      LEFT JOIN employees m ON e.managerId = m.employeeId
      WHERE e.companyId = ?
    `;
    const params = [companyId];

    if (search) {
      sql += ' AND (e.name LIKE ? OR e.employeeId LIKE ? OR e.mobile LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (branchId) {
      sql += ' AND e.branchId = ?';
      params.push(branchId);
    }
    if (departmentId) {
      sql += ' AND e.departmentId = ?';
      params.push(departmentId);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY e.employeeId ASC';

    const employees = await allQuery(sql, params);
    return res.status(200).json(employees);
  } catch (err) {
    console.error('List employees error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// GET /api/employees/metadata - Fetch dropdown metadata
const getMetadata = async (req, res) => {
  const { companyId } = req.user;

  try {
    const branches = await allQuery("SELECT branchId as id, name FROM branches WHERE companyId = ? AND status = 'active'", [companyId]);
    const departments = await allQuery("SELECT departmentId as id, name FROM departments WHERE companyId = ? AND status = 'active'", [companyId]);
    const designations = await allQuery("SELECT designationId as id, name FROM designations WHERE companyId = ? AND status = 'active'", [companyId]);
    const shifts = await allQuery('SELECT shiftId as id, name, startTime, endTime FROM shifts WHERE companyId = ?', [companyId]);
    const managers = await allQuery("SELECT employeeId as id, name FROM employees WHERE companyId = ? AND status = 'Active'", [companyId]);

    return res.status(200).json({
      branches,
      departments,
      designations,
      shifts,
      managers
    });
  } catch (err) {
    console.error('Fetch metadata error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// GET /api/employees/:id - Get detailed employee profile
const getEmployeeById = async (req, res) => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const employee = await getQuery(`
      SELECT e.*, b.name as branchName, d.name as departmentName, des.name as designationName, s.name as shiftName,
             m.name as managerName
      FROM employees e
      LEFT JOIN branches b ON e.branchId = b.branchId
      LEFT JOIN departments d ON e.departmentId = d.departmentId
      LEFT JOIN designations des ON e.designationId = des.designationId
      LEFT JOIN shifts s ON e.shiftId = s.shiftId
      LEFT JOIN employees m ON e.managerId = m.employeeId
      WHERE e.employeeId = ? AND e.companyId = ?
    `, [id, companyId]);

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Parse structures
    employee.salaryStructure = JSON.parse(employee.salaryStructure);
    employee.bankDetails = JSON.parse(employee.bankDetails);
    employee.documents = employee.documents ? JSON.parse(employee.documents) : [];

    // Fetch related records:
    // 1. Leave balances
    const leaveBalances = await allQuery('SELECT * FROM leaveBalances WHERE employeeId = ? AND year = 2026', [id]);
    
    // 2. Adjustments history
    const adjustments = await allQuery('SELECT * FROM adjustments WHERE employeeId = ? ORDER BY createdAt DESC', [id]);

    // 3. Payroll history
    const payroll = await allQuery('SELECT * FROM payroll WHERE employeeId = ? ORDER BY year DESC, month DESC', [id]);

    // 4. Leave history
    const leaveRequests = await allQuery('SELECT * FROM leaveRequests WHERE employeeId = ? ORDER BY fromDate DESC', [id]);

    // 5. Recent 30 days attendance
    const attendance = await allQuery('SELECT * FROM attendance WHERE employeeId = ? ORDER BY date DESC LIMIT 30', [id]);

    return res.status(200).json({
      employee,
      leaveBalances,
      adjustments,
      payroll,
      leaveRequests,
      attendance
    });
  } catch (err) {
    console.error('Fetch employee error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// POST /api/employees - Create employee
const createEmployee = async (req, res) => {
  const { companyId } = req.user;
  const {
    employeeId, name, mobile, email, gender, dob, address, joiningDate, employmentType,
    branchId, departmentId, designationId, managerId, shiftId, weeklyOff,
    salaryType, monthlySalary, perDaySalary, salaryStructure, bankDetails, role, password
  } = req.body;

  if (!name || !mobile || !email || !branchId || !departmentId || !designationId || !shiftId || !salaryType) {
    return res.status(400).json({ message: 'Required profile details are missing' });
  }

  try {
    // Check if email or mobile already registered
    const existingEmp = await getQuery('SELECT employeeId FROM employees WHERE email = ? OR mobile = ?', [email, mobile]);
    if (existingEmp) {
      return res.status(400).json({ message: 'Email or mobile number is already registered' });
    }

    const empId = employeeId || (await generateEmployeeId(companyId));
    const finalPerDaySalary = perDaySalary || (salaryType === 'Monthly' ? Math.round(monthlySalary / 26) : 0);

    const structStr = JSON.stringify(salaryStructure || {
      basicSalary: salaryType === 'Monthly' ? monthlySalary * 0.5 : 0,
      hra: salaryType === 'Monthly' ? monthlySalary * 0.25 : 0,
      conveyance: salaryType === 'Monthly' ? monthlySalary * 0.1 : 0,
      allowance: salaryType === 'Monthly' ? monthlySalary * 0.15 : 0,
      pfEnabled: false,
      esiEnabled: false,
      ptEnabled: false
    });

    const bankStr = JSON.stringify(bankDetails || {
      bankName: '',
      accountNumberMasked: '',
      ifsc: '',
      uan: '',
      esicNumber: ''
    });

    // Create Employee record
    await runQuery(`
      INSERT INTO employees (
        employeeId, companyId, branchId, departmentId, designationId, managerId, name, mobile, email, gender, dob, address,
        joiningDate, employmentType, status, shiftId, weeklyOff, salaryType, monthlySalary, perDaySalary, salaryStructure, bankDetails
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?, ?, ?, ?)
    `, [
      empId, companyId, branchId, departmentId, designationId, managerId || null, name, mobile, email, gender || 'Male',
      dob || '', address || '', joiningDate || '', employmentType || 'Full-time', shiftId, weeklyOff || 'Sunday',
      salaryType, monthlySalary || 0, finalPerDaySalary, structStr, bankStr
    ]);

    // Create User account linked to employee
    const salt = bcrypt.genSaltSync(10);
    const pass = password || 'emp123'; // Default password
    const passwordHash = bcrypt.hashSync(pass, salt);
    const userRole = role || 'employee';

    await runQuery(`
      INSERT INTO users (userId, employeeId, name, email, passwordHash, mobile, role, companyId, branchId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, ['USR_' + empId, empId, name, email, passwordHash, mobile, userRole, companyId, branchId]);

    // Initialize leave balances for 2026
    const leaveTypes = ['Casual', 'Sick', 'Earned', 'Unpaid'];
    for (const lt of leaveTypes) {
      let opening = 0;
      if (lt === 'Casual') opening = 8;
      else if (lt === 'Sick') opening = 8;
      else if (lt === 'Earned') opening = 12;

      await runQuery(`
        INSERT INTO leaveBalances (balanceId, companyId, employeeId, leaveType, opening, accrued, used, pending, available, year)
        VALUES (?, ?, ?, ?, ?, 0.0, 0.0, 0.0, ?, 2026)
      `, [`BAL_${empId}_${lt}`, companyId, empId, lt, opening, opening]);
    }

    // Insert audit log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, newValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`LOG_${Date.now()}`, companyId, req.user.userId, 'CREATE_EMPLOYEE', 'Employee Master', `Created employee ${empId}: ${name}`]);

    return res.status(201).json({
      message: 'Employee created successfully',
      employeeId: empId,
      tempPassword: pass
    });
  } catch (err) {
    console.error('Create employee error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// PUT /api/employees/:id - Update employee
const updateEmployee = async (req, res) => {
  const { companyId } = req.user;
  const { id } = req.params;
  const {
    name, mobile, email, gender, dob, address, joiningDate, employmentType, status,
    branchId, departmentId, designationId, managerId, shiftId, weeklyOff,
    salaryType, monthlySalary, perDaySalary, salaryStructure, bankDetails, role
  } = req.body;

  try {
    const existingEmp = await getQuery('SELECT * FROM employees WHERE employeeId = ? AND companyId = ?', [id, companyId]);
    if (!existingEmp) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const structStr = salaryStructure ? JSON.stringify(salaryStructure) : existingEmp.salaryStructure;
    const bankStr = bankDetails ? JSON.stringify(bankDetails) : existingEmp.bankDetails;
    const finalPerDaySalary = perDaySalary !== undefined ? perDaySalary : (salaryType === 'Monthly' ? Math.round(monthlySalary / 26) : existingEmp.perDaySalary);

    // Update Employee record
    await runQuery(`
      UPDATE employees
      SET name = ?, mobile = ?, email = ?, gender = ?, dob = ?, address = ?, joiningDate = ?, employmentType = ?, status = ?,
          branchId = ?, departmentId = ?, designationId = ?, managerId = ?, shiftId = ?, weeklyOff = ?,
          salaryType = ?, monthlySalary = ?, perDaySalary = ?, salaryStructure = ?, bankDetails = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE employeeId = ? AND companyId = ?
    `, [
      name || existingEmp.name,
      mobile || existingEmp.mobile,
      email || existingEmp.email,
      gender || existingEmp.gender,
      dob || existingEmp.dob,
      address || existingEmp.address,
      joiningDate || existingEmp.joiningDate,
      employmentType || existingEmp.employmentType,
      status || existingEmp.status,
      branchId || existingEmp.branchId,
      departmentId || existingEmp.departmentId,
      designationId || existingEmp.designationId,
      managerId !== undefined ? managerId : existingEmp.managerId,
      shiftId || existingEmp.shiftId,
      weeklyOff || existingEmp.weeklyOff,
      salaryType || existingEmp.salaryType,
      monthlySalary !== undefined ? monthlySalary : existingEmp.monthlySalary,
      finalPerDaySalary,
      structStr,
      bankStr,
      id,
      companyId
    ]);

    // Sync user profile matching details
    await runQuery(`
      UPDATE users
      SET name = ?, mobile = ?, email = ?, branchId = ?, role = ?, status = ?
      WHERE employeeId = ?
    `, [
      name || existingEmp.name,
      mobile || existingEmp.mobile,
      email || existingEmp.email,
      branchId || existingEmp.branchId,
      role || req.body.role || 'employee',
      (status === 'Active') ? 'active' : 'inactive',
      id
    ]);

    // Insert audit log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue, newValue)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      `LOG_${Date.now()}`, companyId, req.user.userId, 'UPDATE_EMPLOYEE', 'Employee Master',
      JSON.stringify(existingEmp),
      JSON.stringify({ id, name, email, status, branchId })
    ]);

    return res.status(200).json({ message: 'Employee updated successfully' });
  } catch (err) {
    console.error('Update employee error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// DELETE /api/employees/:id - Delete employee and linked user account
const deleteEmployee = async (req, res) => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const existingEmp = await getQuery('SELECT * FROM employees WHERE employeeId = ? AND companyId = ?', [id, companyId]);
    if (!existingEmp) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Delete user (cascade foreign keys in SQL will delete balances/attendances)
    // In SQLite, if FOREIGN KEYs are ON, deleting the employee will delete matching records
    await runQuery('DELETE FROM employees WHERE employeeId = ? AND companyId = ?', [id, companyId]);
    await runQuery('DELETE FROM users WHERE employeeId = ?', [id]);

    // Insert audit log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`LOG_${Date.now()}`, companyId, req.user.userId, 'DELETE_EMPLOYEE', 'Employee Master', `Deleted employee: ${id}`]);

    return res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Delete employee error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  getEmployees,
  getMetadata,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee
};
