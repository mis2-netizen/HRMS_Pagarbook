import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Download, CreditCard, X, Calculator, RefreshCw, BarChart } from 'lucide-react';

export default function Payroll() {
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Progressive compilation loader simulator states
  const [compilationProgress, setCompilationProgress] = useState(0);
  const [compilationMsg, setCompilationMsg] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);

  // Month / Year selectors
  const [month, setMonth] = useState('6'); // Default to June
  const [year, setYear] = useState('2026');
  const [branchFilter, setBranchFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Dependency lists
  const [metadata, setMetadata] = useState({ branches: [], departments: [] });

  // Payment Status Dialog States
  const [payingRecordId, setPayingRecordId] = useState(null);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchDependencies = async () => {
    try {
      const res = await fetch('/api/employees/metadata', { headers });
      const data = await res.json();
      if (res.ok) {
        setMetadata({
          branches: data.branches,
          departments: data.departments
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadPayrollSheet = async () => {
    setLoading(true);
    setPreviews([]);
    try {
      let url = `/api/payroll/records?month=${month}&year=${year}`;
      if (branchFilter) url += `&branchId=${branchFilter}`;
      if (deptFilter) url += `&departmentId=${deptFilter}`;

      const res = await fetch(url, { headers });
      const data = await res.json();

      if (res.ok) {
        setPayrollRecords(data);
        if (data.length > 0) {
          setIsLocked(data[0].locked === 1);
        } else {
          setIsLocked(false);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    loadPayrollSheet();
  }, [month, year, branchFilter, deptFilter]);

  // Simulate progressive compiler loader
  const runCompilationLoader = (callback) => {
    setIsCompiling(true);
    setCompilationProgress(0);
    setCompilationMsg('Step 1: Compiling employee attendance shifts...');

    let prog = 0;
    const interval = setInterval(() => {
      prog += 25;
      setCompilationProgress(prog);
      if (prog === 25) {
        setCompilationMsg('Step 2: Processing loan recovery ledgers...');
      } else if (prog === 50) {
        setCompilationMsg('Step 3: Calculating PF/ESI payroll structure...');
      } else if (prog === 75) {
        setCompilationMsg('Step 4: Compiling allowances & OT multipliers...');
      } else if (prog >= 100) {
        clearInterval(interval);
        setIsCompiling(false);
        callback();
      }
    }, 400);
  };

  // Trigger preview dry-run
  const handlePreview = () => {
    runCompilationLoader(async () => {
      setLoading(true);
      setPayrollRecords([]);
      try {
        let url = `/api/payroll/preview?month=${month}&year=${year}`;
        if (branchFilter) url += `&branchId=${branchFilter}`;
        if (deptFilter) url += `&departmentId=${deptFilter}`;
        
        const res = await fetch(url, { headers });
        const data = await res.json();

        if (res.ok) {
          setPreviews(data);
          setIsLocked(false);
        } else {
          alert(data.message);
        }
      } catch (e) {
        alert('Error previewing payroll');
      } finally {
        setLoading(false);
      }
    });
  };

  // Run and save payroll drafts
  const handleRunPayroll = () => {
    runCompilationLoader(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/payroll/run', {
          method: 'POST',
          headers,
          body: JSON.stringify({ month: parseInt(month, 10), year: parseInt(year, 10), branchId: branchFilter, departmentId: deptFilter })
        });
        const data = await res.json();
        if (res.ok) {
          alert(data.message);
          setPreviews([]);
          loadPayrollSheet();
        } else {
          alert(data.message);
        }
      } catch (e) {
        alert('Error running payroll');
      } finally {
        setLoading(false);
      }
    });
  };

  // Lock Payroll
  const handleLockPayroll = async () => {
    if (!window.confirm('Are you sure you want to lock the payroll? This will finalize calculations, deduct employee advances, and notify employees of payslip availability.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/lock', {
        method: 'POST',
        headers,
        body: JSON.stringify({ month: parseInt(month, 10), year: parseInt(year, 10) })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadPayrollSheet();
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert('Error locking payroll');
    } finally {
      setLoading(false);
    }
  };

  // Unlock Payroll (Super Admin only)
  const handleUnlockPayroll = async () => {
    if (!window.confirm('Are you sure you want to unlock this payroll sheet? All calculated adjustment states will revert.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/unlock', {
        method: 'POST',
        headers,
        body: JSON.stringify({ month: parseInt(month, 10), year: parseInt(year, 10) })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadPayrollSheet();
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert('Error unlocking payroll');
    } finally {
      setLoading(false);
    }
  };

  // Download Slip PDF
  const handleDownloadSlip = async (payrollId, employeeName) => {
    try {
      const response = await fetch(`/api/payroll/${payrollId}/slip`, { headers });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `SalarySlip_${employeeName.replace(/\s+/g, '_')}_${month}_${year}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      } else {
        alert('Failed to download PDF. Please verify payroll locks.');
      }
    } catch (e) {
      alert('Connection error');
    }
  };

  // Open pay modal
  const openPayModal = (payrollId) => {
    setPayingRecordId(payrollId);
    setPaymentMode('Bank Transfer');
    setPaymentRemarks('');
    setIsPaymentModalOpen(true);
  };

  // Confirm payment status
  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/payroll/${payingRecordId}/payment`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          paymentStatus: 'Paid',
          paymentMode,
          remarks: paymentRemarks
        })
      });
      if (res.ok) {
        setIsPaymentModalOpen(false);
        loadPayrollSheet();
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Error marking payment');
    }
  };

  // Sum totals helper
  const getSumOfField = (field, isEarnings = true) => {
    const list = payrollRecords.length > 0 ? payrollRecords : previews;
    return list.reduce((sum, item) => {
      if (field === 'netSalary') return sum + item.netSalary;
      if (field === 'grossSalary') return sum + item.grossSalary;
      const subObj = isEarnings ? item.earnings : item.deductions;
      return sum + (subObj[field] || 0);
    }, 0);
  };

  const activeRecordsList = payrollRecords.length > 0 ? payrollRecords : previews;
  const isSheetLoaded = activeRecordsList.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--primary-color)' }}>Payroll Processing</h2>
          <p style={{ color: 'var(--text-sub)', fontSize: '14px' }}>Run monthly salary calculations, deduct advances, process PF/ESI, and generate salary slips.</p>
        </div>
      </div>

      {/* Control Panel Toolbar */}
      <div className="card" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Month Selector */}
        <div className="form-group" style={{ width: '140px' }}>
          <label className="label">Salary Month</label>
          <select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
          </select>
        </div>

        {/* Year Selector */}
        <div className="form-group" style={{ width: '100px' }}>
          <label className="label">Year</label>
          <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>
        </div>

        {/* Branch Filter */}
        <div className="form-group" style={{ width: '160px' }}>
          <label className="label">Branch Filter</label>
          <select className="select" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
            <option value="">All Branches</option>
            {metadata.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* Dept Filter */}
        <div className="form-group" style={{ width: '160px' }}>
          <label className="label">Department Filter</label>
          <select className="select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="">All Departments</option>
            {metadata.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Action Panel */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', paddingTop: '20px' }}>
          
          {!isLocked && (
            <button onClick={handlePreview} className="btn btn-secondary">
              <Calculator size={16} />
              <span>Dry Run Preview</span>
            </button>
          )}

          {!isLocked && isSheetLoaded && (
            <button onClick={handleRunPayroll} className="btn" style={{ backgroundColor: 'var(--primary-light)', color: '#ffffff' }}>
              <RefreshCw size={16} />
              <span>Save drafts</span>
            </button>
          )}

          {!isLocked && payrollRecords.length > 0 && (
            <button onClick={handleLockPayroll} className="btn btn-primary">
              <Lock size={16} />
              <span>Lock Payroll Sheet</span>
            </button>
          )}

          {isLocked && (
            <button onClick={handleUnlockPayroll} className="btn btn-danger">
              <Unlock size={16} />
              <span>Unlock Payroll Sheet</span>
            </button>
          )}

        </div>

      </div>

      {/* Lock alert notice */}
      {isLocked && (
        <div className="card" style={{ borderLeft: '4px solid var(--success)', backgroundColor: 'rgba(16,185,129,0.02)', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Check size={24} style={{ color: 'var(--success)' }} />
          <div>
            <h4 style={{ color: 'var(--success)', fontWeight: 'bold' }}>Payroll Sheet is Finalized & Locked</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-sub)' }}>Slips are available for download. Adjustments and attendance records for this month are frozen.</p>
          </div>
        </div>
      )}

      {/* Compilation Progress Modal */}
      {isCompiling && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center', maxWidth: '400px' }}>
            <span style={{ fontSize: '32px' }}>⚙️</span>
            <h4 style={{ fontSize: '16px', color: 'var(--primary-color)', margin: '12px 0 6px', fontWeight: 'bold' }}>Running Payroll Compiler</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-sub)', marginBottom: '16px' }}>{compilationMsg}</p>
            
            {/* Progress bar */}
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--gray-100)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${compilationProgress}%`, height: '100%', backgroundColor: 'var(--primary-color)', transition: 'width 0.2s' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Main calculation sheet or empty state */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', fontWeight: 'bold' }}>Calculating payroll details...</div>
      ) : isSheetLoaded ? (
        
        /* Dual Column SaaS layout: left is table, right is summary stats card */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'flex-start' }}>
          
          {/* Left: Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--primary-color)' }}>
              {payrollRecords.length > 0 ? 'Saved Monthly Salary Sheet' : 'Draft calculations preview (Unsaved)'}
            </h3>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    <th>Payable Days</th>
                    <th>Base Earned</th>
                    <th>OT Pay</th>
                    <th>Bonus</th>
                    <th>Deductions</th>
                    <th>Net Payable</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRecordsList.map((rec) => (
                    <tr key={rec.employeeId}>
                      <td><strong>{rec.employeeId}</strong></td>
                      <td>{rec.employeeName}</td>
                      <td>{rec.payableDays} Days</td>
                      <td>₹{rec.earnings.basic + rec.earnings.hra + rec.earnings.conveyance + rec.earnings.allowance}</td>
                      <td>₹{rec.earnings.overtimeAmount || 0}</td>
                      <td>₹{(rec.earnings.bonus || 0) + (rec.earnings.incentive || 0)}</td>
                      <td style={{ color: 'var(--danger)' }}>
                        ₹{
                          (rec.deductions.advanceDeduction || 0) + 
                          (rec.deductions.loanDeduction || 0) + 
                          (rec.deductions.pf || 0) + 
                          (rec.deductions.esi || 0) + 
                          (rec.deductions.professionalTax || 0) + 
                          (rec.deductions.latePenalty || 0) + 
                          (rec.deductions.otherDeductions || 0)
                        }
                      </td>
                      <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>₹{rec.netSalary.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${rec.paymentStatus === 'Paid' ? 'badge-present' : 'badge-pending'}`}>
                          {rec.paymentStatus || 'Draft'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {isLocked && (
                            <button
                              onClick={() => handleDownloadSlip(rec.payrollId, rec.employeeName)}
                              className="btn"
                              style={{ padding: '6px', backgroundColor: 'var(--gray-100)', color: 'var(--primary-color)', border: 'none' }}
                              title="Download PDF Salary Slip"
                            >
                              <Download size={14} />
                            </button>
                          )}
                          {isLocked && rec.paymentStatus !== 'Paid' && (
                            <button
                              onClick={() => openPayModal(rec.payrollId)}
                              className="btn"
                              style={{ padding: '6px', backgroundColor: 'var(--success)', color: '#ffffff' }}
                              title="Mark as Paid"
                            >
                              <CreditCard size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: wages summary card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <BarChart size={18} />
              <span>Wages Cost Summary</span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <p style={{ color: 'var(--text-sub)' }}>Total Net Salaries</p>
                <h4 style={{ fontSize: '20px', color: 'var(--success)', fontWeight: 'bold' }}>₹{getSumOfField('netSalary').toLocaleString()}</h4>
              </div>
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '10px' }}>
                <p style={{ color: 'var(--text-sub)' }}>Total Base Earned</p>
                <p style={{ fontWeight: 'bold' }}>₹{(getSumOfField('basic') + getSumOfField('hra') + getSumOfField('conveyance') + getSumOfField('allowance')).toLocaleString()}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-sub)' }}>Total Overtime Payout</p>
                <p style={{ fontWeight: 'bold' }}>₹{getSumOfField('overtimeAmount').toLocaleString()}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-sub)' }}>Total PF Deduct</p>
                <p style={{ fontWeight: 'bold', color: 'var(--danger)' }}>₹{getSumOfField('pf', false).toLocaleString()}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-sub)' }}>Total ESI Deduct</p>
                <p style={{ fontWeight: 'bold', color: 'var(--danger)' }}>₹{getSumOfField('esi', false).toLocaleString()}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-sub)' }}>Advances Recovered</p>
                <p style={{ fontWeight: 'bold', color: 'var(--danger)' }}>₹{getSumOfField('advanceDeduction', false).toLocaleString()}</p>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Empty State */
        <div className="card" style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '48px' }}>🧮</span>
          <h4 style={{ fontSize: '18px', fontWeight: 'bold' }}>No Payroll Records Generated</h4>
          <p style={{ color: 'var(--text-sub)', maxWidth: '400px', fontSize: '14px' }}>Click <strong>Dry Run Preview</strong> above to compile shift logs, attendances, and leaves to estimate wages.</p>
        </div>
      )}

      {/* Pay Modal Overlay */}
      {isPaymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--primary-color)' }}>Disburse Salary Pay</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="label">Payment Mode *</label>
                <select className="select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Reference Remarks</label>
                <input
                  type="text"
                  className="input"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="E.g. Transaction ID or Cash Handover details"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Mark as Disbursed</button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
