import React, { useState, useEffect } from 'react';
import { Play, MapPin, Camera, LogOut, CheckCircle, AlertTriangle, FileText, User, Home, Calendar, Send } from 'lucide-react';

export default function EmployeeSimulator() {
  const [empToken, setEmpToken] = useState(null);
  const [empUser, setEmpUser] = useState(null);
  const [empProfile, setEmpProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // 'home', 'punch', 'leave', 'salary', 'profile'
  
  // Quick select list for easy testing
  const testEmployees = [
    { email: 'john@company.com', name: 'John Doe (Dev - Bangalore)' },
    { email: 'bob@company.com', name: 'Bob Johnson (Sales - Mumbai)' },
    { email: 'alice@company.com', name: 'Alice Brown (Dev - Bangalore)' },
    { email: 'charlie@company.com', name: 'Charlie Green (Sales - Mumbai)' },
    { email: 'david@company.com', name: 'David White (Manager - Bangalore)' },
    { email: 'henry@company.com', name: 'Henry Wilson (Daily Wage - Bangalore)' }
  ];

  // Mobile App States
  const [punchStatus, setPunchStatus] = useState('Not Marked'); // 'Not Marked', 'IN Done', 'OUT Done'
  const [punchRecord, setPunchRecord] = useState(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState(true);
  const [selfieUrl, setSelfieUrl] = useState('');
  const [gpsAddress, setGpsAddress] = useState('Koramangala, Bengaluru');
  const [punchMessage, setPunchMessage] = useState(null);

  // Leave Form States
  const [leaveType, setLeaveType] = useState('Casual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveMessage, setLeaveMessage] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);

  // Salary Slip States
  const [myPayroll, setMyPayroll] = useState([]);

  // Load profile when logged in
  const fetchEmployeeData = async (token) => {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEmpUser(data.user);
        setEmpProfile(data.employee);
        
        // Sync Geofence address mock
        if (data.employee.branchId === 'BR01') {
          setGpsAddress('Nariman Point, Mumbai');
        } else {
          setGpsAddress('Koramangala, Bengaluru');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttendanceStatus = async (token) => {
    try {
      const res = await fetch('/api/attendance/today', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPunchStatus(data.status);
        setPunchRecord(data.record);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeaves = async (token) => {
    try {
      const resB = await fetch('/api/leaves/balances', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataB = await resB.json();
      if (resB.ok) setLeaveBalances(dataB);

      const resL = await fetch('/api/leaves/my', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataL = await resL.json();
      if (resL.ok) setMyLeaves(dataL);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPayrollHistory = async (token, empId) => {
    try {
      const res = await fetch(`/api/employees/${empId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMyPayroll(data.payroll || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (empToken) {
      fetchEmployeeData(empToken);
      fetchAttendanceStatus(empToken);
      fetchLeaves(empToken);
    }
  }, [empToken]);

  useEffect(() => {
    if (empToken && empUser?.employeeId) {
      fetchPayrollHistory(empToken, empUser.employeeId);
    }
  }, [empUser]);

  // Handle Quick Login
  const handleQuickLogin = async (email) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'emp123' })
      });
      const data = await res.json();
      if (res.ok) {
        setEmpToken(data.token);
        setActiveTab('home');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Login error');
    }
  };

  // Mark Attendance Punch IN / OUT
  const handlePunch = async (type) => {
    setPunchMessage(null);
    
    // Coordinates inside geofence vs outside geofence
    // Mumbai HQ coords: 19.0760, 72.8777
    // Bangalore Tech Hub coords: 12.9716, 77.5946
    const isMumbai = empProfile.branchId === 'BR01';
    let lat = isMumbai ? 19.0760 : 12.9716;
    let lng = isMumbai ? 72.8777 : 77.5946;

    if (!isInsideGeofence) {
      // Add significant offset to be outside 100/200 meters geofence
      lat += 0.05;
      lng += 0.05;
    }

    const endpoint = type === 'IN' ? '/api/attendance/punch-in' : '/api/attendance/punch-out';
    const body = {
      latitude: lat,
      longitude: lng,
      address: isInsideGeofence ? gpsAddress : 'Unknown Road, Far Away',
      photoUrl: selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      deviceId: 'MOCK_DEVICE_ID_99'
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${empToken}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok) {
        setPunchMessage({ type: 'success', text: data.message });
        fetchAttendanceStatus(empToken);
        fetchLeaves(empToken); // update dashboard leave balances
      } else {
        setPunchMessage({ type: 'error', text: data.message });
      }
    } catch (e) {
      setPunchMessage({ type: 'error', text: 'Network connection failed' });
    }
  };

  // Apply Leave
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setLeaveMessage(null);
    if (!fromDate || !toDate || !leaveReason) {
      alert('Please fill all leave application fields');
      return;
    }

    // Calculate total days
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diffTime = Math.abs(end - start);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    try {
      const res = await fetch('/api/leaves/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${empToken}`
        },
        body: JSON.stringify({
          leaveType,
          fromDate,
          toDate,
          totalDays,
          reason: leaveReason
        })
      });
      const data = await res.json();

      if (res.ok) {
        setLeaveMessage({ type: 'success', text: 'Leave application submitted!' });
        setFromDate('');
        setToDate('');
        setLeaveReason('');
        fetchLeaves(empToken);
      } else {
        setLeaveMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setLeaveMessage({ type: 'error', text: 'Leave application error' });
    }
  };

  // Download payslip
  const triggerDownloadSlip = async (payrollId) => {
    try {
      const response = await fetch(`/api/payroll/${payrollId}/slip`, {
        headers: {
          'Authorization': `Bearer ${empToken}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Payslip_${payrollId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
      } else {
        alert('Failed to download PDF. Slip might not be generated or locked.');
      }
    } catch (e) {
      alert('Error fetching payslip');
    }
  };

  const handleLogout = () => {
    setEmpToken(null);
    setEmpUser(null);
    setEmpProfile(null);
    setPunchRecord(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      
      {/* Mobile Frame Container */}
      <div className="simulator-panel">
        <div className="simulator-notch"></div>
        <div className="simulator-screen">
          
          {!empToken ? (
            /* MOBILE LOGIN SCREEN */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyItems: 'center', padding: '24px', backgroundColor: '#ffffff', paddingTop: '50px' }}>
              <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '30px' }}>
                <span style={{ fontSize: '48px' }}>💼</span>
                <h2 style={{ fontSize: '22px', color: 'var(--primary-color)', marginTop: '12px' }}>Pagarbook Mobile</h2>
                <p style={{ fontSize: '12px', color: '#64748b' }}>Employee Attendance Portal</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Demo Quick Login</p>
                {testEmployees.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickLogin(e.email)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      fontSize: '11px',
                      textAlign: 'left',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: '0.2s'
                    }}
                    onMouseOver={(ev) => ev.currentTarget.style.borderColor = 'var(--primary-light)'}
                    onMouseOut={(ev) => ev.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    <Play size={10} style={{ color: 'var(--success)' }} />
                    {e.name}
                  </button>
                ))}
              </div>

              <div style={{ textAlign: 'center', fontSize: '10px', color: '#94a3b8', marginTop: 'auto' }}>
                Password: <strong>emp123</strong> for all users.
              </div>
            </div>
          ) : (
            /* SIMULATOR SCREEN CONTENT */
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              {/* Top Navigation */}
              <div className="simulator-navbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#ffffff', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                    {empUser?.name.charAt(0)}
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', margin: 0 }}>{empUser?.name}</p>
                    <p style={{ fontSize: '9px', fontWeight: 'normal', color: 'rgba(255,255,255,0.7)', margin: 0 }}>ID: {empUser?.employeeId}</p>
                  </div>
                </div>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}>
                  <LogOut size={16} />
                </button>
              </div>

              {/* Simulator Screen Body */}
              <div className="simulator-body" style={{ flex: 1, overflowY: 'auto' }}>
                
                {/* 1. HOME TAB */}
                {activeTab === 'home' && (
                  <>
                    {/* Punch Banner */}
                    <div className="mobile-card" style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ fontSize: '11px', opacity: 0.8, textTransform: 'uppercase', fontWeight: 'bold' }}>Today's Attendance</p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ fontSize: '20px' }}>{punchStatus}</h4>
                          {punchRecord && (
                            <p style={{ fontSize: '11px', opacity: 0.8, marginTop: '4px' }}>
                              IN: {punchRecord.inTime} {punchRecord.outTime ? `| OUT: ${punchRecord.outTime}` : ''}
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize: '32px' }}>
                          {punchStatus === 'Not Marked' ? '⏱️' : punchStatus === 'IN Done' ? '🟢' : '✅'}
                        </span>
                      </div>
                      
                      {punchStatus !== 'OUT Done' && (
                        <button
                          onClick={() => setActiveTab('punch')}
                          style={{
                            backgroundColor: '#ffffff',
                            color: 'var(--primary-color)',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          {punchStatus === 'Not Marked' ? 'Clock In Now' : 'Clock Out Now'}
                        </button>
                      )}
                    </div>

                    {/* Stats Row */}
                    <div className="mobile-stats-row">
                      <div className="mobile-stat-box">
                        <p className="mobile-stat-label">Estimated Salary</p>
                        <p className="mobile-stat-value" style={{ color: 'var(--primary-color)' }}>
                          ₹{empProfile ? (empProfile.salaryType === 'Monthly' ? empProfile.monthlySalary : empProfile.perDaySalary * 26).toLocaleString() : 0}
                        </p>
                      </div>
                      <div className="mobile-stat-box">
                        <p className="mobile-stat-label">Employment</p>
                        <p className="mobile-stat-value" style={{ fontSize: '13px', paddingTop: '2px' }}>{empProfile?.employmentType}</p>
                      </div>
                    </div>

                    {/* Leave Summary Card */}
                    <div className="mobile-card">
                      <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Leave Balances (2026)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                        {leaveBalances.map((b, i) => (
                          <div key={i} style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                            <p style={{ fontSize: '9px', color: '#64748b' }}>{b.leaveType}</p>
                            <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{b.available}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shift details */}
                    <div className="mobile-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <h4 style={{ fontSize: '14px', marginBottom: '4px' }}>Shift Details</h4>
                      <p><strong>Weekly Off:</strong> {empProfile?.weeklyOff}</p>
                      <p><strong>Branch HQ:</strong> {empProfile?.branchId === 'BR01' ? 'Mumbai' : 'Bengaluru'}</p>
                      <p><strong>Shift Code:</strong> Day Shift (09:00 - 18:00)</p>
                    </div>
                  </>
                )}

                {/* 2. PUNCH TAB */}
                {activeTab === 'punch' && (
                  <>
                    <div className="mobile-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <h3 style={{ fontSize: '16px', color: 'var(--primary-color)' }}>Clock In/Out Simulator</h3>
                      
                      {/* Geofence Simulator Controller */}
                      <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: '#64748b' }}>GPS Geolocation Simulator</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px' }}>Location check:</span>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: isInsideGeofence ? 'var(--success)' : 'var(--danger)' }}>
                            {isInsideGeofence ? 'INSIDE GEOFENCE' : 'OUTSIDE GEOFENCE'}
                          </span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isInsideGeofence}
                            onChange={(ev) => setIsInsideGeofence(ev.target.checked)}
                          />
                          Mock employee is inside allowed radius
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
                          <MapPin size={12} />
                          <span>{isInsideGeofence ? gpsAddress : 'Unknown Road (Distance: 540m)'}</span>
                        </div>
                      </div>

                      {/* Mock Camera Preview */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', alignSelf: 'flex-start' }}>Selfie verification</p>
                        <div style={{ width: '100%', height: '140px', borderRadius: '12px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
                          {selfieUrl ? (
                            <img src={selfieUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="selfie preview" />
                          ) : (
                            <>
                              <Camera size={32} style={{ color: '#94a3b8' }} />
                              <button
                                onClick={() => setSelfieUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}
                                style={{
                                  marginTop: '8px',
                                  fontSize: '11px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  cursor: 'pointer'
                                }}
                              >
                                Take Mock Photo
                              </button>
                            </>
                          )}
                        </div>
                        {selfieUrl && (
                          <button
                            onClick={() => setSelfieUrl('')}
                            style={{ fontSize: '10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            Retake Photo
                          </button>
                        )}
                      </div>

                      {/* Punch triggers */}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button
                          onClick={() => handlePunch('IN')}
                          disabled={punchStatus === 'IN Done' || punchStatus === 'OUT Done'}
                          className="btn btn-primary"
                          style={{ flex: 1, padding: '12px 0', borderRadius: '10px', fontSize: '13px', opacity: (punchStatus === 'IN Done' || punchStatus === 'OUT Done') ? 0.5 : 1 }}
                        >
                          Punch IN
                        </button>
                        <button
                          onClick={() => handlePunch('OUT')}
                          disabled={punchStatus !== 'IN Done'}
                          className="btn"
                          style={{
                            flex: 1,
                            padding: '12px 0',
                            borderRadius: '10px',
                            backgroundColor: 'var(--secondary-color)',
                            color: '#ffffff',
                            fontSize: '13px',
                            opacity: punchStatus !== 'IN Done' ? 0.5 : 1
                          }}
                        >
                          Punch OUT
                        </button>
                      </div>

                      {/* Messages log */}
                      {punchMessage && (
                        <div style={{
                          padding: '12px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          backgroundColor: punchMessage.type === 'success' ? '#e8f5e9' : '#ffebee',
                          color: punchMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${punchMessage.type === 'success' ? '#c8e6c9' : '#ffcdd2'}`
                        }}>
                          {punchMessage.type === 'success' ? <CheckCircle size={16} style={{ flexShrink: 0 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
                          <span>{punchMessage.text}</span>
                        </div>
                      )}

                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        * Note: late calculation triggers if you punch past 9:15 AM server time.
                      </div>
                    </div>
                  </>
                )}

                {/* 3. LEAVE TAB */}
                {activeTab === 'leave' && (
                  <>
                    {/* Apply Form */}
                    <form onSubmit={handleApplyLeave} className="mobile-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ fontSize: '14px', color: 'var(--primary-color)' }}>Apply for Leave</h4>
                      
                      <div className="form-group">
                        <label className="label" style={{ fontSize: '11px' }}>Leave Type</label>
                        <select className="select" style={{ fontSize: '12px', padding: '8px' }} value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                          <option value="Casual">Casual Leave (CL)</option>
                          <option value="Sick">Sick Leave (SL)</option>
                          <option value="Earned">Earned Leave (EL)</option>
                          <option value="Unpaid">Unpaid Leave</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="label" style={{ fontSize: '11px' }}>From</label>
                          <input type="date" className="input" style={{ fontSize: '11px', padding: '8px' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                          <label className="label" style={{ fontSize: '11px' }}>To</label>
                          <input type="date" className="input" style={{ fontSize: '11px', padding: '8px' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="label" style={{ fontSize: '11px' }}>Reason</label>
                        <textarea className="textarea" rows="2" style={{ fontSize: '12px', padding: '8px' }} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Reason for leave..."></textarea>
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ padding: '8px 0', fontSize: '12px' }}>
                        Submit Application
                      </button>

                      {leaveMessage && (
                        <div style={{
                          padding: '10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          backgroundColor: leaveMessage.type === 'success' ? '#e8f5e9' : '#ffebee',
                          color: leaveMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                          border: `1px solid ${leaveMessage.type === 'success' ? '#c8e6c9' : '#ffcdd2'}`
                        }}>
                          {leaveMessage.text}
                        </div>
                      )}
                    </form>

                    {/* Applied Leave History */}
                    <div className="mobile-card">
                      <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Leave Requests History</h4>
                      {myLeaves.length === 0 ? (
                        <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', padding: '12px' }}>No leaves applied yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {myLeaves.map((l, i) => (
                            <div key={i} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', fontSize: '11px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>{l.leaveType} Leave ({l.totalDays} Days)</strong>
                                <span style={{
                                  fontSize: '9px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: l.status === 'Approved' ? 'rgba(16,185,129,0.1)' : l.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                  color: l.status === 'Approved' ? 'var(--success)' : l.status === 'Rejected' ? 'var(--danger)' : 'var(--warning)',
                                  fontWeight: 'bold'
                                }}>
                                  {l.status}
                                </span>
                              </div>
                              <p style={{ color: '#64748b', marginTop: '2px' }}>{l.fromDate} to {l.toDate}</p>
                              {l.rejectionReason && <p style={{ color: 'var(--danger)', fontSize: '10px', marginTop: '2px' }}><strong>Reason:</strong> {l.rejectionReason}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 4. SALARY TAB */}
                {activeTab === 'salary' && (
                  <>
                    <div className="mobile-card">
                      <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Locked Payslips</h4>
                      
                      {myPayroll.length === 0 ? (
                        <p style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', padding: '12px' }}>No locked payslips available yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {myPayroll.map((p, i) => (
                            <div key={i} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h5 style={{ fontSize: '12px' }}>Salary Month: {p.month}/{p.year}</h5>
                                <p style={{ color: 'var(--success)', fontWeight: 'bold', marginTop: '4px' }}>Net Pay: ₹{p.netSalary.toLocaleString()}</p>
                                <p style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>Status: {p.paymentStatus}</p>
                              </div>
                              
                              <button
                                onClick={() => triggerDownloadSlip(p.payrollId)}
                                style={{
                                  backgroundColor: '#f1f5f9',
                                  border: 'none',
                                  padding: '8px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  color: 'var(--primary-color)'
                                }}
                              >
                                <FileText size={18} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 5. PROFILE TAB */}
                {activeTab === 'profile' && (
                  <>
                    <div className="mobile-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                      <div style={{ textAlign: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', margin: '0 auto 8px' }}>
                          {empProfile?.name.charAt(0)}
                        </div>
                        <h4 style={{ fontSize: '15px' }}>{empProfile?.name}</h4>
                        <p style={{ fontSize: '11px', color: '#64748b' }}>{empProfile?.designationName} | {empProfile?.departmentName}</p>
                      </div>

                      <p><strong>Mobile:</strong> {empProfile?.mobile}</p>
                      <p><strong>Email:</strong> {empProfile?.email}</p>
                      <p><strong>DOB:</strong> {empProfile?.dob}</p>
                      <p><strong>Address:</strong> {empProfile?.address}</p>
                      
                      <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <h5 style={{ fontSize: '12px', marginBottom: '6px' }}>Salary Summary</h5>
                        <p><strong>Salary Type:</strong> {empProfile?.salaryType}</p>
                        {empProfile?.salaryType === 'Monthly' ? (
                          <p><strong>Monthly Rate:</strong> ₹{empProfile?.monthlySalary.toLocaleString()}</p>
                        ) : (
                          <p><strong>Per Day Rate:</strong> ₹{empProfile?.perDaySalary.toLocaleString()}</p>
                        )}
                        <p><strong>Bank Details:</strong> Masked {JSON.parse(empProfile?.bankDetails || '{}').accountNumberMasked}</p>
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Simulator Bottom Nav */}
              <div className="simulator-bottom-nav">
                <button className={`simulator-nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                  <Home size={20} />
                  <span>Home</span>
                </button>
                <button className={`simulator-nav-item ${activeTab === 'punch' ? 'active' : ''}`} onClick={() => setActiveTab('punch')}>
                  <MapPin size={20} />
                  <span>Punch</span>
                </button>
                <button className={`simulator-nav-item ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>
                  <Calendar size={20} />
                  <span>Leave</span>
                </button>
                <button className={`simulator-nav-item ${activeTab === 'salary' ? 'active' : ''}`} onClick={() => setActiveTab('salary')}>
                  <FileText size={20} />
                  <span>Salary</span>
                </button>
                <button className={`simulator-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                  <User size={20} />
                  <span>Profile</span>
                </button>
              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
}
