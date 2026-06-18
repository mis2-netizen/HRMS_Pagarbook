import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, DollarSign, FileText } from 'lucide-react';

function Adjustments() {
  const [adjustments, setAdjustments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States
  const [form, setForm] = useState({
    employeeId: '',
    type: 'Advance',
    amount: '',
    applicableMonth: new Date().getMonth() + 1,
    applicableYear: 2026,
    remarks: ''
  });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchAdjustments = async () => {
    try {
      const res = await fetch('/api/adjustments', { headers });
      const data = await res.json();
      if (res.ok) setAdjustments(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees/metadata', { headers });
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.managers); // lists active employees
        if (data.managers.length > 0 && !form.employeeId) {
          setForm(prev => ({ ...prev, employeeId: data.managers[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdjustments();
    fetchEmployees();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Amount must be positive');
      return;
    }

    try {
      const res = await fetch('/api/adjustments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          applicableMonth: parseInt(form.applicableMonth, 10),
          applicableYear: parseInt(form.applicableYear, 10)
        })
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess('Adjustment recorded successfully.');
        setForm(prev => ({
          ...prev,
          amount: '',
          remarks: ''
        }));
        fetchAdjustments();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this adjustment request?')) {
      return;
    }
    try {
      const res = await fetch(`/api/adjustments/${id}`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (res.ok) {
        alert('Adjustment deleted.');
        fetchAdjustments();
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert('Delete failed');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '32px' }}>
      
      {/* 1. Add Adjustment Card Form */}
      <div className="card" style={{ height: 'fit-content' }}>
        <h3 style={{ fontSize: '18px', color: 'var(--primary-color)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarSign size={20} />
          <span>Record Adjustment Ledger</span>
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group">
            <label className="label">Select Employee *</label>
            <select
              className="select"
              value={form.employeeId}
              onChange={(e) => setForm(prev => ({ ...prev, employeeId: e.target.value }))}
              required
            >
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">Adjustment Type *</label>
              <select
                className="select"
                value={form.type}
                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                required
              >
                <option value="Advance">Salary Advance</option>
                <option value="Bonus">Cash Bonus</option>
                <option value="Incentive">Incentive</option>
                <option value="Reimbursement">Reimbursement</option>
                <option value="Penalty">Property Damage Penalty</option>
                <option value="Other Deduction">Other Deduction</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">Amount (INR) *</label>
              <input
                type="number"
                className="input"
                value={form.amount}
                onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                required
                placeholder="E.g. 5000"
              />
            </div>

          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">Target Month *</label>
              <select
                className="select"
                value={form.applicableMonth}
                onChange={(e) => setForm(prev => ({ ...prev, applicableMonth: e.target.value }))}
                required
              >
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">Target Year *</label>
              <select
                className="select"
                value={form.applicableYear}
                onChange={(e) => setForm(prev => ({ ...prev, applicableYear: e.target.value }))}
                required
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>

          </div>

          <div className="form-group">
            <label className="label">Description / Remarks *</label>
            <input
              type="text"
              className="input"
              value={form.remarks}
              onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="Reason for adjustment"
              required
            />
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>{error}</p>}
          {success && <p style={{ color: 'var(--success)', fontSize: '13px', textAlign: 'center' }}>{success}</p>}

          <button type="submit" className="btn btn-primary" style={{ padding: '12px 0', fontSize: '14px', marginTop: '8px' }}>
            <Plus size={16} />
            <span>Apply to Salary Sheet</span>
          </button>

        </form>
      </div>

      {/* 2. Adjustment ledger log */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '18px', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} />
          <span>Ledger Logs & Settlements</span>
        </h3>

        <div className="table-container" style={{ flex: 1, overflowY: 'auto', maxHeight: '480px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Applicable</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No adjustments logged.</td>
                </tr>
              ) : (
                adjustments.map((a) => (
                  <tr key={a.adjustmentId}>
                    <td>
                      <strong>{a.employeeName}</strong>
                      <p style={{ fontSize: '11px', color: '#64748b' }}>{a.employeeId}</p>
                    </td>
                    <td>
                      <span className="badge" style={{
                        backgroundColor: ['Bonus', 'Incentive', 'Reimbursement'].includes(a.type) ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: ['Bonus', 'Incentive', 'Reimbursement'].includes(a.type) ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {a.type}
                      </span>
                    </td>
                    <td><strong>₹{a.amount.toLocaleString()}</strong></td>
                    <td>{a.applicableMonth}/{a.applicableYear}</td>
                    <td>
                      <span className={`badge ${a.status === 'Processed' ? 'badge-approved' : 'badge-pending'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      {a.status === 'Pending' ? (
                        <button
                          onClick={() => handleDelete(a.adjustmentId)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                          title="Delete Ledger"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--success)' }}>Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default Adjustments;
