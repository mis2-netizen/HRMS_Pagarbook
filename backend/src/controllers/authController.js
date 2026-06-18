const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getQuery, runQuery } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'hrms_secret_key_super_secure_987654321';

// Login User
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Find user by email
    const user = await getQuery('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Verify password
    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Fetch employee details if linked
    let employee = null;
    if (user.employeeId) {
      employee = await getQuery('SELECT * FROM employees WHERE employeeId = ?', [user.employeeId]);
    }

    // Generate JWT Token
    const payload = {
      userId: user.userId,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      branchId: user.branchId || (employee ? employee.branchId : null)
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    // Return response
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        userId: user.userId,
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        branchId: payload.branchId
      },
      employee
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// Get profile details of currently logged in user
const getProfile = async (req, res) => {
  const { userId, employeeId } = req.user;

  try {
    const user = await getQuery('SELECT userId, employeeId, name, email, mobile, role, companyId, branchId, status, createdAt FROM users WHERE userId = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let employee = null;
    if (employeeId) {
      employee = await getQuery(`
        SELECT e.*, b.name as branchName, d.name as departmentName, des.name as designationName, s.name as shiftName
        FROM employees e
        LEFT JOIN branches b ON e.branchId = b.branchId
        LEFT JOIN departments d ON e.departmentId = d.departmentId
        LEFT JOIN designations des ON e.designationId = des.designationId
        LEFT JOIN shifts s ON e.shiftId = s.shiftId
        WHERE e.employeeId = ?
      `, [employeeId]);
    }

    return res.status(200).json({
      user,
      employee
    });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// Update Password
const changePassword = async (req, res) => {
  const { userId } = req.user;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Old and new passwords are required' });
  }

  try {
    const user = await getQuery('SELECT passwordHash FROM users WHERE userId = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = bcrypt.compareSync(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid old password' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newPasswordHash = bcrypt.hashSync(newPassword, salt);

    await runQuery('UPDATE users SET passwordHash = ? WHERE userId = ?', [newPasswordHash, userId]);

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

module.exports = {
  login,
  getProfile,
  changePassword
};
