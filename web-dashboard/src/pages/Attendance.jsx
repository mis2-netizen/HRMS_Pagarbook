import React, { useState, useEffect } from 'react';
import { Check, X, Calendar as CalendarIcon, Edit, ShieldAlert, Plus, MapPin } from 'lucide-react';

export default function Attendance() {
  const [dailyLogs, setDailyLogs] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab state: 'daily' (Roster table) or 'calendar' (Employee calendar grid)
  const [activeSubTab, setActiveSubTab] = useState('daily');

  // Filters (Daily Roster)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Filters (Monthly Calendar)
  const [selectedCalEmployee, setSelectedCalEmployee] = useState('');
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [employeeCalLogs, setEmployeeCalLogs] = useState({});

  // Dependency lists
  const [metadata, setMetadata] = useState({ branches: [], departments: [] });

  // Manual Punch Modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    inTime: '09:00',
    outTime: '18:00',
    status: 'Present',
    remarks: ''
  });
  const [manualError, setManualError] = useState(null);
  const [manualSuccess, setManualSuccess] = useState(null);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchDailyLogs = async () => {
    try {
      let url = `/api/attendance/daily?date=${date}`;
      if (branchFilter) url += `&branchId=${branchFilter}`;
      if (deptFilter) url += `&departmentId=${deptFilter}`;
      
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (res.ok) setDailyLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCorrections = async () => {
    try {
      const res = await fetch('/api/attendance/corrections', { headers });
      const data = await res.json();
      if (res.ok) setCorrections(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDependencies = async () => {
    setLoading(true);
    try {
      const resMeta = await fetch('/api/employees/metadata', { headers });
      const dataMeta = await resMeta.json();
      if (resMeta.ok) {
        setMetadata({
          branches: dataMeta.branches,
          departments: dataMeta.departments
        });
        setEmployeesList(dataMeta.managers); // lists all active employees
        if (dataMeta.managers.length > 0) {
          if (!manualForm.employeeId) {
            setManualForm(prev => ({ ...prev, employeeId: dataMeta.managers[0].id }));
          }
          if (!selectedCalEmployee) {
            setSelectedCalEmployee(dataMeta.managers[0].id);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeMonthLogs = async () => {
    if (!selectedCalEmployee) return;
    try {
      const monthStr = calMonth.toString().padStart(2, '0');
      const res = await fetch(`/api/employees/${selectedCalEmployee}`, { headers });
      const data = await res.json();
      if (res.ok) {
        // Map logs from employee profile API (recent 30 days but filter for specific month)
        const logsMap = {};
        data.attendance.forEach(log => {
          // log.date is YYYY-MM-DD
          const [yr, mn, dy] = log.date.split('-').map(Number);
          if (mn === parseInt(calMonth, 10) && yr === parseInt(calYear, 10)) {
            logsMap[dy] = log;
          }
        });
        setEmployeeCalLogs(logsMap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDailyLogs();
  }, [date, branchFilter, deptFilter]);

  useEffect(() => {
    fetchCorrections();
    fetchDependencies();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'calendar') {
      fetchEmployeeMonthLogs();
    }
  }, [activeSubTab, selectedCalEmployee, calMonth, calYear]);

  // Approve / Reject Correction
  const handleApproveCorrection = async (attendanceId, status, remarks = '') => {
    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} this correction request?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/attendance/corrections/${attendanceId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status, remarks })
      });
      if (res.ok) {
        alert(`Correction request ${status.toLowerCase()}ed.`);
        fetchCorrections();
        fetchDailyLogs();
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (e) {
      alert('Error updating correction request');
    }
  };

  // Submit Manual punch
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualError(null);
    setManualSuccess(null);

    const body = {
      ...manualForm,
      inTime: manualForm.inTime ? `${manualForm.inTime}:00` : null,
      outTime: manualForm.outTime ? `${manualForm.outTime}:00` : null
    };

    try {
      const res = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        setManualSuccess('Attendance logged successfully.');
        fetchDailyLogs();
        if (activeSubTab === 'calendar') fetchEmployeeMonthLogs();
        setTimeout(() => {
          setIsManualModalOpen(false);
        }, 1200);
      } else {
        setManualError(data.message);
      }
    } catch (err) {
      setManualError('Network error');
    }
  };

  const openManualModal = (empId = '', defaultDate = '') => {
    setManualForm({
      employeeId: empId || (employeesList[0]?.id || ''),
      date: defaultDate || date,
      inTime: '09:00',
      outTime: '18:00',
      status: 'Present',
      remarks: ''
    });
    setManualError(null);
    setManualSuccess(null);
    setIsManualModalOpen(true);
  };

  // Generate Calendar Days helper
  const getDaysInMonth = (m, y) => new Date(y, m, 0).getDate();
  const getFirstDayOffset = (m, y) => new Date(y, m - 1, 1).getDay(); // 0 is Sunday, 1 is Monday...

  const daysInMonth = getDaysInMonth(calMonth, calYear);
  const firstDayOffset = getFirstDayOffset(calMonth, calYear);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header and Manual Mark */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '28px', color: 'var(--primary-color)' }}>Attendance logs</h2>
          <p style={{ color: 'var(--text-sub)', fontSize: '14px' }}>Log sheet of clock-ins, shift late compliance, and geofences.</p>
        </div>
        
        <button onClick={() => openManualModal()} className="btn btn-primary">
          <Plus size={18} />
          <span>Manual Punch Override</span>
        </button>
      </div>

      {/* Roster / Calendar Sub tabs */}
      <div className="form-tab-header">
        <button className={`form-tab-btn ${activeSubTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveSubTab('daily')}>Daily Team Roster</button>
        <button className={`form-tab-btn ${activeSubTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveSubTab('calendar')}>Monthly Attendance Calendar</button>
      </div>

      {/* 1. Correction Requests Alert Panel */}
      {corrections.length > 0 && activeSubTab === 'daily' && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning)', backgroundColor: 'rgba(245,158,11,0.02)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <ShieldAlert style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontSize: '16px', color: 'var(--warning)', fontWeight: 'bold' }}>Pending Attendance Corrections ({corrections.length})</h3>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {corrections.map((c) => (
              <div key={c.attendanceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                <div>
                  <strong>{c.employeeName}</strong> ({c.employeeId}) requested correction for <strong>{c.date}</strong>:
                  <p style={{ color: 'var(--primary-light)', marginTop: '4px', fontSize: '12px' }}>
                    Proposed IN: <strong>{c.correctionDetails?.inTime || 'N/A'}</strong> | Proposed OUT: <strong>{c.correctionDetails?.outTime || 'N/A'}</strong>
                  </p>
                  <p style={{ color: 'var(--text-sub)', fontStyle: 'italic', fontSize: '11px', marginTop: '2px' }}>
                    Reason: "{c.correctionDetails?.reason}"
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleApproveCorrection(c.attendanceId, 'Approved')}
                    className="btn"
                    style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'var(--success)', color: '#ffffff' }}
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => handleApproveCorrection(c.attendanceId, 'Rejected')}
                    className="btn"
                    style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'var(--danger)', color: '#ffffff' }}
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: DAILY TEAM ROSTER GRID */}
      {activeSubTab === 'daily' && (
        <>
          {/* Filters */}
          <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
              <CalendarIcon size={16} style={{ color: '#94a3b8' }} />
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <select className="select" style={{ width: '180px' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All Branches</option>
              {metadata.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select className="select" style={{ width: '180px' }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {metadata.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Roster Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Shift Timing</th>
                  <th>IN Time</th>
                  <th>OUT Time</th>
                  <th>Hours</th>
                  <th>Late (min)</th>
                  <th>Overtime</th>
                  <th>Punch Location</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dailyLogs.length === 0 ? (
                  <tr>
                    <td colSpan="12" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No attendance records found for this date.</td>
                  </tr>
                ) : (
                  dailyLogs.map((log) => (
                    <tr key={log.employeeId}>
                      <td><strong>{log.employeeId}</strong></td>
                      <td>{log.employeeName}</td>
                      <td>{log.branchName}</td>
                      <td>{log.shiftName}</td>
                      <td>{log.inTime || '--:--'}</td>
                      <td>{log.outTime || '--:--'}</td>
                      <td>{log.workingHours ? `${log.workingHours} hrs` : '-'}</td>
                      <td style={{ color: log.lateMinutes > 0 ? 'var(--danger)' : '' }}>
                        {log.lateMinutes > 0 ? `${log.lateMinutes} min` : '-'}
                      </td>
                      <td style={{ color: log.overtimeHours > 0 ? 'var(--success)' : '' }}>
                        {log.overtimeHours > 0 ? `${log.overtimeHours} hrs` : '-'}
                      </td>
                      <td>
                        {log.inLatitude ? (
                          <span title={`Address: ${log.inAddress}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--primary-color)' }}>
                            <MapPin size={12} /> Checked
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={`badge ${
                          log.attendanceStatus === 'Present' ? 'badge-present' :
                          log.attendanceStatus === 'Absent' ? 'badge-absent' :
                          log.attendanceStatus === 'Half Day' ? 'badge-late' :
                          log.attendanceStatus === 'Paid Leave' ? 'badge-paid-leave' :
                          log.attendanceStatus === 'Unpaid Leave' ? 'badge-unpaid-leave' :
                          log.attendanceStatus === 'Weekly Off' ? 'badge-unpaid-leave' : 'badge-paid-leave'
                        }`}>
                          {log.attendanceStatus || 'Absent'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => openManualModal(log.employeeId, date)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--secondary-color)' }}
                          title="Override punch"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 2: MONTHLY COLOR-CODED CALENDAR GRID */}
      {activeSubTab === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px' }}>
          
          {/* Calendar side selectors */}
          <div className="card" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--primary-color)' }}>Employee Filter</h3>
            
            <div className="form-group">
              <label className="label">Employee</label>
              <select className="select" value={selectedCalEmployee} onChange={(e) => setSelectedCalEmployee(e.target.value)}>
                {employeesList.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Month</label>
                <select className="select" value={calMonth} onChange={(e) => setCalMonth(e.target.value)}>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Year</label>
                <select className="select" value={calYear} onChange={(e) => setCalYear(e.target.value)}>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
            </div>

            {/* Legend block */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <h5 style={{ fontWeight: 'bold', marginBottom: '4px' }}>Status Indicators</h5>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                <span>Present</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                <span>Absent</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                <span>Late Check-in</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                <span>Paid Leave</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></div>
                <span>Paid Holiday</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#e2e8f0' }}></div>
                <span>Weekly Off</span>
              </div>
            </div>

          </div>

          {/* Calendar visual grid */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px', color: 'var(--primary-color)' }}>
              Calendar Grid: Month {calMonth}/{calYear}
            </h3>

            <div className="calendar-grid">
              
              {/* Header Days of Week */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="calendar-header-cell">{day}</div>
              ))}

              {/* Offset Empty blocks */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day-empty"></div>
              ))}

              {/* Grid Cells */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const log = employeeCalLogs[day];
                
                let cellClass = 'calendar-day-cell';
                let title = `Day ${day}: No punch recorded`;

                if (log) {
                  const status = log.status;
                  title = `Day ${day}: ${status}`;
                  if (log.inTime) title += `\nIN: ${log.inTime} | OUT: ${log.outTime || 'N/A'}`;
                  
                  if (status === 'Present') {
                    cellClass += log.lateMinutes > 0 ? ' cal-late' : ' cal-present';
                  } else if (status === 'Absent') {
                    cellClass += ' cal-absent';
                  } else if (status === 'Half Day') {
                    cellClass += ' cal-late';
                  } else if (status === 'Paid Leave' || status === 'Unpaid Leave') {
                    cellClass += ' cal-leave';
                  } else if (status === 'Weekly Off') {
                    cellClass += ' cal-weeklyoff';
                  } else if (status === 'Holiday') {
                    cellClass += ' cal-holiday';
                  }
                }

                return (
                  <div
                    key={`day-${day}`}
                    className={cellClass}
                    title={title}
                    onClick={() => {
                      const dateStr = `${calYear}-${calMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                      openManualModal(selectedCalEmployee, dateStr);
                    }}
                  >
                    {day}
                  </div>
                );
              })}

            </div>

          </div>

        </div>
      )}

      {/* Manual Punch Modal Overlay */}
      {isManualModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--primary-color)' }}>Manual Attendance Punch</h3>
              <button onClick={() => setIsManualModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div className="form-group">
                <label className="label">Select Employee *</label>
                <select
                  className="select"
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm(prev => ({ ...prev, employeeId: e.target.value }))}
                  required
                >
                  {employeesList.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Punch Date *</label>
                <input
                  type="date"
                  className="input"
                  value={manualForm.date}
                  onChange={(e) => setManualForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="label">Attendance Status *</label>
                <select
                  className="select"
                  value={manualForm.status}
                  onChange={(e) => setManualForm(prev => ({ ...prev, status: e.target.value }))}
                  required
                >
                  <option value="Present">Present</option>
                  <option value="Absent">Absent</option>
                  <option value="Half Day">Half Day</option>
                  <option value="Paid Leave">Paid Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Holiday">Paid Holiday</option>
                </select>
              </div>

              {['Present', 'Half Day'].includes(manualForm.status) && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="label">IN Time (HH:MM)</label>
                    <input
                      type="time"
                      className="input"
                      value={manualForm.inTime}
                      onChange={(e) => setManualForm(prev => ({ ...prev, inTime: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="label">OUT Time (HH:MM)</label>
                    <input
                      type="time"
                      className="input"
                      value={manualForm.outTime}
                      onChange={(e) => setManualForm(prev => ({ ...prev, outTime: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="label">HR Remarks / Reason *</label>
                <input
                  type="text"
                  className="input"
                  value={manualForm.remarks}
                  onChange={(e) => setManualForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="E.g. Forgot mobile, manually corrected"
                  required
                />
              </div>

              {manualError && <p style={{ color: 'var(--danger)', fontSize: '13px', textAlign: 'center' }}>{manualError}</p>}
              {manualSuccess && <p style={{ color: 'var(--success)', fontSize: '13px', textAlign: 'center' }}>{manualSuccess}</p>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Punch</button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
