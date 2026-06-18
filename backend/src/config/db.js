const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set in .env! Database connection will fail.');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for direct Supabase cloud database connection
  }
});

// Helper function to translate SQLite "?" placeholders into PostgreSQL "$1, $2, $3"
const translateQuery = (sql) => {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

// Map lowercase PostgreSQL columns back to camelCase properties expected by the controllers
const keyMap = {
  employeeid: 'employeeId',
  companyid: 'companyId',
  branchid: 'branchId',
  departmentid: 'departmentId',
  designationid: 'designationId',
  managerid: 'managerId',
  joiningdate: 'joiningDate',
  employmenttype: 'employmentType',
  shiftid: 'shiftId',
  weeklyoff: 'weeklyOff',
  salarytype: 'salaryType',
  monthlysalary: 'monthlySalary',
  perdaysalary: 'perDaySalary',
  salarystructure: 'salaryStructure',
  bankdetails: 'bankDetails',
  createdat: 'createdAt',
  updatedat: 'updatedAt',
  intime: 'inTime',
  outtime: 'outTime',
  workinghours: 'workingHours',
  lateminutes: 'lateMinutes',
  earlyoutminutes: 'earlyOutMinutes',
  overtimehours: 'overtimeHours',
  inphotourl: 'inPhotoUrl',
  outphotourl: 'outPhotoUrl',
  inlatitude: 'inLatitude',
  inlongitude: 'inLongitude',
  outlatitude: 'outLatitude',
  outlongitude: 'outLongitude',
  inaddress: 'inAddress',
  outaddress: 'outAddress',
  deviceid: 'deviceId',
  correctionstatus: 'correctionStatus',
  hrremarks: 'hrRemarks',
  leaveid: 'leaveId',
  leavetype: 'leaveType',
  fromdate: 'fromDate',
  todate: 'toDate',
  totaldays: 'totalDays',
  halfday: 'halfDay',
  approvedby: 'approvedBy',
  approvedat: 'approvedAt',
  rejectionreason: 'rejectionReason',
  balanceid: 'balanceId',
  payrollid: 'payrollId',
  attendancesummary: 'attendanceSummary',
  grosssalary: 'grossSalary',
  netsalary: 'netSalary',
  paymentstatus: 'paymentStatus',
  paymentdate: 'paymentDate',
  paymentmode: 'paymentMode',
  salaryslipurl: 'salarySlipUrl',
  adjustmentid: 'adjustmentId',
  applicablemonth: 'applicableMonth',
  applicableyear: 'applicableYear',
  installmentamount: 'installmentAmount',
  holidayid: 'holidayId',
  paidholiday: 'paidHoliday',
  notificationid: 'notificationId',
  userid: 'userId',
  passwordhash: 'passwordHash',
  logid: 'logId',
  oldvalue: 'oldValue',
  newvalue: 'newValue',
  logourl: 'logoUrl',
  payrollsettings: 'payrollSettings',
  attendancesettings: 'attendanceSettings',
  radiusmeters: 'radiusMeters',
  starttime: 'startTime',
  endtime: 'endTime',
  fulldayhours: 'fullDayHours',
  halfdayhours: 'halfDayHours',
  lategraceminutes: 'lateGraceMinutes',
  weeklyoffs: 'weeklyOffs',
  attendanceid: 'attendanceId',
  attachmenturl: 'attachmentUrl'
};

const mapKeys = (row) => {
  if (!row) return row;
  const mapped = {};
  for (const key in row) {
    const mappedKey = keyMap[key] || key;
    mapped[mappedKey] = row[key];
  }
  return mapped;
};

// Helper function to run queries using promises
const runQuery = async (sql, params = []) => {
  if (sql.trim().toLowerCase().startsWith('pragma')) {
    return { lastID: null, changes: 0 };
  }
  const pgSql = translateQuery(sql);
  const res = await pool.query(pgSql, params);
  return { lastID: null, changes: res.rowCount };
};

// Helper function to fetch single row using promises
const getQuery = async (sql, params = []) => {
  const pgSql = translateQuery(sql);
  const res = await pool.query(pgSql, params);
  return mapKeys(res.rows[0]) || null;
};

// Helper function to fetch all rows using promises
const allQuery = async (sql, params = []) => {
  const pgSql = translateQuery(sql);
  const res = await pool.query(pgSql, params);
  return res.rows.map(mapKeys);
};

// Shim object for SQLite-compatible interface used in test scripts
const db = {
  close: () => pool.end()
};

// Initialize Supabase PostgreSQL Tables
const initDB = async () => {
  console.log('Initializing Supabase PostgreSQL tables...');

  // 1. Companies
  await runQuery(`
    CREATE TABLE IF NOT EXISTS companies (
      companyId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logoUrl TEXT,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      payrollSettings TEXT NOT NULL,
      attendanceSettings TEXT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Branches
  await runQuery(`
    CREATE TABLE IF NOT EXISTS branches (
      branchId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radiusMeters REAL DEFAULT 100,
      status TEXT DEFAULT 'active'
    )
  `);

  // 3. Departments
  await runQuery(`
    CREATE TABLE IF NOT EXISTS departments (
      departmentId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    )
  `);

  // 4. Designations
  await runQuery(`
    CREATE TABLE IF NOT EXISTS designations (
      designationId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    )
  `);

  // 5. Shifts
  await runQuery(`
    CREATE TABLE IF NOT EXISTS shifts (
      shiftId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      name TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      fullDayHours REAL DEFAULT 8.0,
      halfDayHours REAL DEFAULT 4.0,
      lateGraceMinutes INTEGER DEFAULT 15,
      weeklyOffs TEXT DEFAULT 'Sunday'
    )
  `);

  // 6. Employees
  await runQuery(`
    CREATE TABLE IF NOT EXISTS employees (
      employeeId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      branchId TEXT NOT NULL REFERENCES branches(branchId),
      departmentId TEXT NOT NULL REFERENCES departments(departmentId),
      designationId TEXT NOT NULL REFERENCES designations(designationId),
      managerId TEXT REFERENCES employees(employeeId) ON DELETE SET NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT NOT NULL,
      gender TEXT NOT NULL,
      dob TEXT NOT NULL,
      address TEXT NOT NULL,
      joiningDate TEXT NOT NULL,
      employmentType TEXT NOT NULL,
      status TEXT DEFAULT 'Active',
      shiftId TEXT NOT NULL REFERENCES shifts(shiftId),
      weeklyOff TEXT NOT NULL,
      salaryType TEXT NOT NULL,
      monthlySalary REAL NOT NULL,
      perDaySalary REAL NOT NULL,
      salaryStructure TEXT NOT NULL,
      bankDetails TEXT NOT NULL,
      documents TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Users
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      employeeId TEXT REFERENCES employees(employeeId) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      mobile TEXT,
      role TEXT NOT NULL,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      branchId TEXT REFERENCES branches(branchId) ON DELETE SET NULL,
      status TEXT DEFAULT 'active',
      deviceId TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. Attendance
  await runQuery(`
    CREATE TABLE IF NOT EXISTS attendance (
      attendanceId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      employeeId TEXT NOT NULL REFERENCES employees(employeeId) ON DELETE CASCADE,
      date TEXT NOT NULL,
      inTime TEXT,
      outTime TEXT,
      workingHours REAL DEFAULT 0.0,
      status TEXT NOT NULL,
      lateMinutes INTEGER DEFAULT 0,
      earlyOutMinutes INTEGER DEFAULT 0,
      overtimeHours REAL DEFAULT 0.0,
      inPhotoUrl TEXT,
      outPhotoUrl TEXT,
      inLatitude REAL,
      inLongitude REAL,
      outLatitude REAL,
      outLongitude REAL,
      inAddress TEXT,
      outAddress TEXT,
      deviceId TEXT,
      source TEXT DEFAULT 'mobile',
      correctionStatus TEXT DEFAULT 'None',
      hrRemarks TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employeeId, date)
    )
  `);

  // 9. Leave Requests
  await runQuery(`
    CREATE TABLE IF NOT EXISTS leaveRequests (
      leaveId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      employeeId TEXT NOT NULL REFERENCES employees(employeeId) ON DELETE CASCADE,
      leaveType TEXT NOT NULL,
      fromDate TEXT NOT NULL,
      toDate TEXT NOT NULL,
      totalDays REAL NOT NULL,
      halfDay INTEGER DEFAULT 0,
      reason TEXT NOT NULL,
      attachmentUrl TEXT,
      status TEXT DEFAULT 'Pending',
      approvedBy TEXT,
      approvedAt TIMESTAMP,
      rejectionReason TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 10. Leave Balances
  await runQuery(`
    CREATE TABLE IF NOT EXISTS leaveBalances (
      balanceId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      employeeId TEXT NOT NULL REFERENCES employees(employeeId) ON DELETE CASCADE,
      leaveType TEXT NOT NULL,
      opening REAL DEFAULT 0.0,
      accrued REAL DEFAULT 0.0,
      used REAL DEFAULT 0.0,
      pending REAL DEFAULT 0.0,
      available REAL DEFAULT 0.0,
      year INTEGER NOT NULL,
      UNIQUE(employeeId, leaveType, year)
    )
  `);

  // 11. Payroll
  await runQuery(`
    CREATE TABLE IF NOT EXISTS payroll (
      payrollId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      employeeId TEXT NOT NULL REFERENCES employees(employeeId) ON DELETE CASCADE,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      attendanceSummary TEXT NOT NULL,
      earnings TEXT NOT NULL,
      deductions TEXT NOT NULL,
      grossSalary REAL NOT NULL,
      netSalary REAL NOT NULL,
      paymentStatus TEXT DEFAULT 'Pending',
      paymentDate TEXT,
      paymentMode TEXT,
      salarySlipUrl TEXT,
      locked INTEGER DEFAULT 0,
      remarks TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employeeId, month, year)
    )
  `);

  // 12. Adjustments
  await runQuery(`
    CREATE TABLE IF NOT EXISTS adjustments (
      adjustmentId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      employeeId TEXT NOT NULL REFERENCES employees(employeeId) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      applicableMonth INTEGER NOT NULL,
      applicableYear INTEGER NOT NULL,
      recurring INTEGER DEFAULT 0,
      installmentAmount REAL,
      status TEXT DEFAULT 'Pending',
      remarks TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 13. Holidays
  await runQuery(`
    CREATE TABLE IF NOT EXISTS holidays (
      holidayId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      paidHoliday INTEGER DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 14. Notifications
  await runQuery(`
    CREATE TABLE IF NOT EXISTS notifications (
      notificationId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      type TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 15. Audit Logs
  await runQuery(`
    CREATE TABLE IF NOT EXISTS auditLogs (
      logId TEXT PRIMARY KEY,
      companyId TEXT NOT NULL REFERENCES companies(companyId) ON DELETE CASCADE,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      oldValue TEXT,
      newValue TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Supabase PostgreSQL tables initialized successfully.');
};

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery,
  initDB
};
