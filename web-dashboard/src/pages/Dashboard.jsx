import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, XCircle, AlertCircle, Calendar, CreditCard, Clock, FileWarning } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    onLeaveToday: 0,
    pendingLeaveApprovals: 0,
    pendingCorrections: 0,
    monthlySalaryCost: 0,
    payrollCalculatedCount: 0
  });
  
  const [branchCostData, setBranchCostData] = useState([]);
  const [deptAttendanceData, setDeptAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');

  const fetchDashboardData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // 1. Fetch main metrics
      const resM = await fetch('/api/extra/reports?reportType=dashboard-metrics', { headers });
      const dataM = await resM.json();
      if (resM.ok) setMetrics(dataM);

      // 2. Fetch branch cost chart data (assume month 5, year 2026 for populated demo data)
      const resB = await fetch('/api/extra/reports?reportType=branch-cost&month=5&year=2026', { headers });
      const dataB = await resB.json();
      if (resB.ok) setBranchCostData(dataB);

      // 3. Fetch department attendance chart data
      const resD = await fetch('/api/extra/reports?reportType=department-attendance', { headers });
      const dataD = await resD.json();
      if (resD.ok) setDeptAttendanceData(dataD);

    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontWeight: 'bold' }}>Loading analytics dashboard...</div>;
  }

  // Pie Chart formatting
  const pieData = [
    { name: 'Present Today', value: metrics.presentToday },
    { name: 'Absent Today', value: metrics.absentToday },
    { name: 'On Leave', value: metrics.onLeaveToday }
  ];
  const COLORS = ['#10b981', '#ef4444', '#3b82f6'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Page Title Header */}
      <div>
        <h2 style={{ fontSize: '28px', color: 'var(--primary-color)' }}>HR Operations Console</h2>
        <p style={{ color: 'var(--text-light-sub)', fontSize: '14px' }}>Real-time payroll analytics and attendance tracking metrics.</p>
      </div>

      {/* Metrics Cards Grid */}
      <div className="card-grid">
        
        <div className="card">
          <div className="card-title">Total Active Employees</div>
          <div className="card-value">{metrics.totalEmployees}</div>
          <Users className="card-icon" size={40} />
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="card-title">Present Today</div>
          <div className="card-value" style={{ color: 'var(--success)' }}>{metrics.presentToday}</div>
          <CheckCircle className="card-icon" size={40} style={{ color: 'var(--success)' }} />
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="card-title">Absent Today</div>
          <div className="card-value" style={{ color: 'var(--danger)' }}>{metrics.absentToday}</div>
          <XCircle className="card-icon" size={40} style={{ color: 'var(--danger)' }} />
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="card-title">Late Check-ins Today</div>
          <div className="card-value" style={{ color: 'var(--warning)' }}>{metrics.lateToday}</div>
          <Clock className="card-icon" size={40} style={{ color: 'var(--warning)' }} />
        </div>

        <div className="card">
          <div className="card-title">On Leave Today</div>
          <div className="card-value" style={{ color: 'var(--info)' }}>{metrics.onLeaveToday}</div>
          <Calendar className="card-icon" size={40} style={{ color: 'var(--info)' }} />
        </div>

        <div className="card">
          <div className="card-title">Pending Leave Requests</div>
          <div className="card-value" style={{ color: 'var(--warning)' }}>{metrics.pendingLeaveApprovals}</div>
          <FileWarning className="card-icon" size={40} style={{ color: 'var(--warning)' }} />
        </div>

        <div className="card">
          <div className="card-title">Pending Clock corrections</div>
          <div className="card-value" style={{ color: 'var(--warning)' }}>{metrics.pendingCorrections}</div>
          <AlertCircle className="card-icon" size={40} style={{ color: 'var(--warning)' }} />
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%)', color: '#ffffff' }}>
          <div className="card-title" style={{ color: 'rgba(255,255,255,0.7)' }}>May Salary Payable</div>
          <div className="card-value" style={{ color: '#ffffff' }}>₹{metrics.monthlySalaryCost ? metrics.monthlySalaryCost.toLocaleString() : '1,96,780'}</div>
          <CreditCard className="card-icon" size={40} style={{ color: '#ffffff' }} />
        </div>

      </div>

      {/* Analytics Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px' }}>
        
        {/* Branch-wise salary cost */}
        <div className="card" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--primary-color)' }}>Branch-wise Payroll Cost (May 2026)</h3>
          <div style={{ flex: 1 }}>
            {branchCostData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '100px', color: 'var(--text-light-sub)' }}>No cost data generated yet. Run payroll to preview.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchCostData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branchName" />
                  <YAxis />
                  <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="totalCost" name="Total Net Salary Payout" fill="#1b4332" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily Attendance split */}
        <div className="card" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--primary-color)' }}>Today's Attendance Status Share</h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {metrics.presentToday === 0 && metrics.absentToday === 0 ? (
              <div style={{ color: 'var(--text-light-sub)' }}>No attendance logs uploaded today. Use simulator to check.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Department-wise logs table/summary */}
      <div className="card">
        <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--primary-color)' }}>Department Attendance Logs (Today)</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Present Employees</th>
                <th>Absent Employees</th>
                <th>Half Days</th>
                <th>Total Checked Logs</th>
              </tr>
            </thead>
            <tbody>
              {deptAttendanceData.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-light-sub)' }}>No attendance logged today.</td>
                </tr>
              ) : (
                deptAttendanceData.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.departmentName}</strong></td>
                    <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{d.presentCount}</td>
                    <td style={{ color: 'var(--danger)' }}>{d.absentCount}</td>
                    <td style={{ color: 'var(--warning)' }}>{d.halfDayCount}</td>
                    <td>{d.totalLogs}</td>
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
