import React, { useState, useEffect } from 'react';
import { Check, X, Calendar, Search, ShieldAlert, BadgeAlert } from 'lucide-react';

export default function Leaves() {
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab state: 'pending' (Request Inbox), 'balances' (Roster accruals), 'history' (Archive)
  const [activeTab, setActiveTab] = useState('pending');

  // Reject Reason Modal States
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchLeavesData = async () => {
    setLoading(true);
    try {
      const resP = await fetch('/api/leaves/requests?status=Pending', { headers });
      const dataP = await resP.json();
      if (resP.ok) setRequests(dataP);

      const resH = await fetch('/api/leaves/requests', { headers });
      const dataH = await resH.json();
      if (resH.ok) {
        const processed = dataH.filter(x => x.status !== 'Pending');
        setHistory(processed);
        
        // Deduce balances
        const uniqueEmps = {};
        dataH.forEach(item => {
          if (!uniqueEmps[item.employeeId]) {
            uniqueEmps[item.employeeId] = {
              id: item.employeeId,
              name: item.employeeName,
              dept: item.departmentName,
              casual: 8,
              sick: 8,
              earned: 12
            };
          }
          if (item.status === 'Approved' && item.leaveType !== 'Unpaid') {
            const typeKey = item.leaveType.toLowerCase();
            if (typeKey === 'casual') uniqueEmps[item.employeeId].casual = Math.max(0, uniqueEmps[item.employeeId].casual - item.totalDays);
            else if (typeKey === 'sick') uniqueEmps[item.employeeId].sick = Math.max(0, uniqueEmps[item.employeeId].sick - item.totalDays);
            else if (typeKey === 'earned') uniqueEmps[item.employeeId].earned = Math.max(0, uniqueEmps[item.employeeId].earned - item.totalDays);
          }
        });
        setBalances(Object.values(uniqueEmps));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeavesData();
  }, []);

  const handleApprove = async (leaveId) => {
    if (!window.confirm('Are you sure you want to approve this leave request? This will deduct balance and auto-mark attendance.')) {
      return;
    }

    try {
      const res = await fetch(`/api/leaves/requests/${leaveId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: 'Approved' })
      });
      if (res.ok) {
        alert('Leave request approved successfully.');
        fetchLeavesData();
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (e) {
      alert('Error processing approval');
    }
  };

  const openRejectModal = (leaveId) => {
    setRejectingId(leaveId);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!rejectReason) {
      alert('Please provide a reason for rejection.');
      return;
    }

    try {
      const res = await fetch(`/api/leaves/requests/${rejectingId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: 'Rejected', rejectionReason: rejectReason })
      });
      if (res.ok) {
        alert('Leave request rejected.');
        setIsRejectModalOpen(false);
        fetchLeavesData();
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (e) {
      alert('Error processing rejection');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '28px', color: 'var(--primary-color)' }}>Leave Approvals</h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '14px' }}>Process leave applications, track balances, and inspect approvals history.</p>
      </div>

      {/* Page Sub Tabs */}
      <div className="form-tab-header">
        <button className={`form-tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
          Request Inbox ({requests.length})
        </button>
        <button className={`form-tab-btn ${activeTab === 'balances' ? 'active' : ''}`} onClick={() => setActiveTab('balances')}>
          Accrued Balances
        </button>
        <button className={`form-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          Leave Archives
        </button>
      </div>

      {/* 1. REQUEST INBOX TAB */}
      {activeTab === 'pending' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-sub)' }}>
                      Leave request inbox is empty. No pending tasks.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.leaveId}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-soft)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {r.employeeName.charAt(0)}
                          </div>
                          <div>
                            <strong>{r.employeeName}</strong>
                            <p style={{ fontSize: '11px', color: 'var(--text-sub)' }}>ID: {r.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ backgroundColor: 'var(--gray-100)', color: 'var(--text-main)' }}>
                          {r.leaveType}
                        </span>
                      </td>
                      <td>{r.fromDate}</td>
                      <td>{r.toDate}</td>
                      <td><strong>{r.totalDays} Days</strong></td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>
                        {r.reason}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleApprove(r.leaveId)}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => openRejectModal(r.leaveId)}
                            className="btn"
                            style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'var(--danger)', color: '#ffffff' }}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ACCRUED BALANCES TAB */}
      {activeTab === 'balances' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Casual Leave</th>
                  <th>Sick Leave</th>
                  <th>Earned Leave</th>
                  <th>Unpaid Days Taken</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-sub)' }}>No balances logs initialized.</td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.name}</strong>
                        <p style={{ fontSize: '11px', color: 'var(--text-sub)' }}>{b.id}</p>
                      </td>
                      <td>{b.dept}</td>
                      <td><strong>{b.casual} / 8</strong> days</td>
                      <td><strong>{b.sick} / 8</strong> days</td>
                      <td><strong>{b.earned} / 12</strong> days</td>
                      <td>{8 + 8 + 12 - (b.casual + b.sick + b.earned) > 10 ? '2 Days' : '0 Days'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. LEAVE ARCHIVES TAB */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Dates Range</th>
                  <th>Reason</th>
                  <th>Resolution Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-sub)' }}>Leave history archive is empty.</td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.leaveId}>
                      <td>
                        <strong>{h.employeeName}</strong>
                        <p style={{ fontSize: '11px', color: 'var(--text-sub)' }}>{h.employeeId}</p>
                      </td>
                      <td>{h.leaveType}</td>
                      <td>{h.fromDate} to {h.toDate} ({h.totalDays} Days)</td>
                      <td>{h.reason}</td>
                      <td>
                        <span className={`badge ${h.status === 'Approved' ? 'badge-approved' : 'badge-rejected'}`}>
                          {h.status}
                        </span>
                      </td>
                      <td>
                        {h.status === 'Approved' ? (
                          <span style={{ color: 'var(--success)' }}>Settled by Admin</span>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontSize: '12px' }}>Reason: "{h.rejectionReason}"</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Modal Overlay */}
      {isRejectModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--primary-color)' }}>Reject Leave Request</h3>
              <button onClick={() => setIsRejectModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRejectConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="label">Reason for Rejection *</label>
                <textarea
                  className="textarea"
                  rows="3"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsRejectModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--danger)' }}>Reject Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
