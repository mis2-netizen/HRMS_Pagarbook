const { runQuery, getQuery, allQuery } = require('../config/db');

// POST /api/adjustments - Create an adjustment (Advance, Loan, Penalty, Bonus, Incentive, Reimbursement)
const createAdjustment = async (req, res) => {
  const { companyId, userId } = req.user;
  const { employeeId, type, amount, applicableMonth, applicableYear, remarks, recurring, installmentAmount } = req.body;

  if (!employeeId || !type || !amount || !applicableMonth || !applicableYear) {
    return res.status(400).json({ message: 'Employee, type, amount, month and year are required' });
  }

  const allowedTypes = ['Advance', 'Loan', 'Penalty', 'Reimbursement', 'Bonus', 'Incentive', 'Other Deduction'];
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({ message: 'Invalid adjustment type' });
  }

  try {
    const employee = await getQuery('SELECT name FROM employees WHERE employeeId = ? AND companyId = ?', [employeeId, companyId]);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Check if payroll for this month is already generated and locked
    const lockedPayroll = await getQuery('SELECT payrollId FROM payroll WHERE employeeId = ? AND month = ? AND year = ? AND locked = 1', [employeeId, applicableMonth, applicableYear]);
    if (lockedPayroll) {
      return res.status(400).json({ message: 'Payroll for this month is locked. You cannot add adjustments.' });
    }

    const adjustmentId = `ADJ_${Date.now()}`;
    await runQuery(`
      INSERT INTO adjustments (
        adjustmentId, companyId, employeeId, type, amount, applicableMonth, applicableYear, recurring, installmentAmount, status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `, [
      adjustmentId, companyId, employeeId, type, amount, applicableMonth, applicableYear,
      recurring ? 1 : 0, installmentAmount || null, remarks || `${type} added by HR`
    ]);

    // Insert Audit Log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, newValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`LOG_${Date.now()}`, companyId, userId, `CREATE_ADJUSTMENT_${type.toUpperCase()}`, 'Adjustments', `Added ${type} of ${amount} for employee ${employeeId}`]);

    return res.status(201).json({ message: 'Adjustment recorded successfully', adjustmentId });
  } catch (err) {
    console.error('Create adjustment error:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// GET /api/adjustments - HR: Get list of adjustments with filters
const getAdjustments = async (req, res) => {
  const { companyId } = req.user;
  const { employeeId, type, month, year, status } = req.query;

  try {
    let sql = `
      SELECT adj.*, e.name as employeeName, b.name as branchName
      FROM adjustments adj
      JOIN employees e ON adj.employeeId = e.employeeId
      LEFT JOIN branches b ON e.branchId = b.branchId
      WHERE adj.companyId = ?
    `;
    const params = [companyId];

    if (employeeId) {
      sql += ' AND adj.employeeId = ?';
      params.push(employeeId);
    }
    if (type) {
      sql += ' AND adj.type = ?';
      params.push(type);
    }
    if (month) {
      sql += ' AND adj.applicableMonth = ?';
      params.push(parseInt(month, 10));
    }
    if (year) {
      sql += ' AND adj.applicableYear = ?';
      params.push(parseInt(year, 10));
    }
    if (status) {
      sql += ' AND adj.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY adj.createdAt DESC';

    const list = await allQuery(sql, params);
    return res.status(200).json(list);
  } catch (err) {
    console.error('Fetch adjustments error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/adjustments/my - Employee: Get adjustments for current employee
const getMyAdjustments = async (req, res) => {
  const { employeeId } = req.user;
  const { month, year } = req.query;

  const targetMonth = parseInt(month || new Date().getMonth() + 1, 10);
  const targetYear = parseInt(year || new Date().getFullYear(), 10);

  try {
    const list = await allQuery(`
      SELECT * FROM adjustments
      WHERE employeeId = ? AND applicableMonth = ? AND applicableYear = ?
      ORDER BY createdAt DESC
    `, [employeeId, targetMonth, targetYear]);

    return res.status(200).json(list);
  } catch (err) {
    console.error('Fetch my adjustments error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/adjustments/:id - HR: Delete an adjustment (only if pending)
const deleteAdjustment = async (req, res) => {
  const { companyId, userId } = req.user;
  const { id } = req.params;

  try {
    const adj = await getQuery('SELECT * FROM adjustments WHERE adjustmentId = ? AND companyId = ?', [id, companyId]);
    if (!adj) {
      return res.status(404).json({ message: 'Adjustment not found' });
    }

    if (adj.status === 'Processed') {
      return res.status(400).json({ message: 'Processed adjustments cannot be deleted because they are locked in finalized payroll records.' });
    }

    await runQuery('DELETE FROM adjustments WHERE adjustmentId = ?', [id]);

    // Insert Audit Log
    await runQuery(`
      INSERT INTO auditLogs (logId, companyId, userId, action, module, oldValue)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`LOG_${Date.now()}`, companyId, userId, 'DELETE_ADJUSTMENT', 'Adjustments', JSON.stringify(adj)]);

    return res.status(200).json({ message: 'Adjustment deleted successfully' });
  } catch (err) {
    console.error('Delete adjustment error:', err.message);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createAdjustment,
  getAdjustments,
  getMyAdjustments,
  deleteAdjustment
};
