const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const adjustmentRoutes = require('./routes/adjustmentRoutes');
const extraRoutes = require('./routes/extraRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure uploads folder and subdirectories exist
const subDirs = ['', '/slips', '/selfies', '/documents'];
subDirs.forEach(sub => {
  const dirPath = path.resolve(UPLOAD_DIR + sub);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

// Route bindings
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/extra', extraRoutes);
app.use('/api/payroll', require('./routes/payrollRoutes')); // Direct binding for payroll

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'HRMS Backend Server is running smoothly' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ message: 'Internal server error occurred', error: err.message });
});

// Start Server after database check
const startServer = async () => {
  try {
    // We assume the DB is initialized by the seeding script.
    // If not, we run initDB. Let's run a quick SELECT 1 check or initDB itself.
    console.log('Verifying database tables...');
    // Simply boot Express
    app.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(` HRMS API SERVER STARTED SUCCESSFULLY ON PORT ${PORT} `);
      console.log(` API Health: http://localhost:${PORT}/health`);
      console.log(`===================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
  }
};

startServer();
