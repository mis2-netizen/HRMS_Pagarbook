import React, { useState, useEffect } from 'react';
import { Download, FileText, Calendar, Filter } from 'lucide-react';

function Reports() {
  const [reportType, setReportType] = useState('employee-master');
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [month, setMonth] = useState('5'); // May is pre-seeded with populated data
  const [year, setYear] = useState('2026');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  const loadReportData = async () => {
    setLoading(true);
    try {
      let url = `/api/extra/reports?reportType=${reportType}`;
      if (reportType === 'branch-cost' || reportType === 'overtime' || reportType === 'late-coming' || reportType === 'advances' || reportType === 'leaves') {
        url += `&month=${month}&year=${year}`;
      } else if (reportType === 'department-attendance') {
        url += `&date=${date}`;
      }

      // Special check: if Employee Master report, we can fetch from employee CRUD list directly
      if (reportType === 'employee-master') {
        url = '/api/employees';
      }

      const res = await fetch(url, { headers });
      const data = await res.json();
      if (res.ok) {
        setDataList(data);
      } else {
        setDataList([]);
      }
    } catch (e) {
      console.error(e);
      setDataList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [reportType, month, year, date]);

  // Client-side CSV Export Engine
  const exportToCSV = () => {
    if (dataList.length === 0) {
      alert('No data available to export.');
      return;
    }

    const firstRow = dataList[0];
    // Flatten nested objects (e.g. attendanceSummary, earnings) if they exist
    const keys = Object.keys(firstRow).filter(k => typeof firstRow[k] !== 'object');
    
    const csvHeaders = keys.join(',');
    const csvRows = dataList.map(row => {
      return keys.map(k => {
        const val = row[k];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape quotes
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const filename = `${reportType}_report_${month}_${year}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper names
  const reportOptions = [
    { type: 'employee-master', label: 'Employee Master Details' },
    { type: 'branch-cost', label: 'Branch Salary Payout Cost' },
    { type: 'department-attendance', label: 'Department Daily Attendance' },
    { type: 'overtime', label: 'Employee Monthly Overtime' },
    { type: 'late-coming', label: 'Late Punch Compliance' },
    { type: 'advances', label: 'Salary Advances Ledger' },
    { type: 'leaves', label: 'Applied Leaves Registry' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '28px', color: 'var(--primary-color)' }}>Reports Exporter</h2>
        <p style={{ color: 'var(--text-light-sub)', fontSize: '14px' }}>Export system registers and ledger entries to Excel/CSV spreadsheet format.</p>
      </div>

      {/* Grid of Report Types */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {reportOptions.map((opt) => (
          <button
            key={opt.type}
            onClick={() => setReportType(opt.type)}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `1.5px solid ${reportType === opt.type ? 'var(--secondary-color)' : 'var(--border-light)'}`,
              backgroundColor: reportType === opt.type ? 'rgba(46,196,182,0.05)' : 'var(--bg-light-card)',
              color: reportType === opt.type ? 'var(--primary-color)' : 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'var(--transition)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '20px' }}>📊</span>
            <span style={{ fontSize: '13px' }}>{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Filter toolbar */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Render selectors depending on report scope */}
        {reportType === 'department-attendance' ? (
          <div className="form-group" style={{ width: '180px' }}>
            <label className="label">Date Picker</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        ) : reportType !== 'employee-master' ? (
          <>
            <div className="form-group" style={{ width: '140px' }}>
              <label className="label">Month</label>
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
            <div className="form-group" style={{ width: '100px' }}>
              <label className="label">Year</label>
              <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
          </>
        ) : (
          <span style={{ fontSize: '13px', color: '#64748b' }}>No date filter required. Full database master dump.</span>
        )}

        {/* CSV export */}
        <button onClick={exportToCSV} className="btn btn-primary" style={{ marginLeft: 'auto', padding: '10px 20px' }}>
          <Download size={16} />
          <span>Export Excel / CSV</span>
        </button>

      </div>

      {/* Live Data Preview Grid */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', color: 'var(--primary-color)' }}>Log Registry Live Preview</h3>
        
        <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="table">
            <thead>
              {reportType === 'employee-master' && (
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Gender</th>
                  <th>Joining Date</th>
                  <th>Type</th>
                  <th>Salary Rate</th>
                </tr>
              )}
              {reportType === 'branch-cost' && (
                <tr>
                  <th>Branch Location</th>
                  <th>Employee Headcount</th>
                  <th>Total Net Salary Payout</th>
                </tr>
              )}
              {reportType === 'department-attendance' && (
                <tr>
                  <th>Department Name</th>
                  <th>Presents</th>
                  <th>Absents</th>
                  <th>Half Days</th>
                  <th>Total Count Checked</th>
                </tr>
              )}
              {reportType === 'overtime' && (
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Total Overtime Hours worked</th>
                </tr>
              )}
              {reportType === 'late-coming' && (
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Late Marks Count</th>
                  <th>Sum of Late Minutes</th>
                </tr>
              )}
              {reportType === 'advances' && (
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Adjustment Type</th>
                  <th>Sum of Amount</th>
                </tr>
              )}
              {reportType === 'leaves' && (
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '30px' }}>Loading reports data...</td>
                </tr>
              ) : dataList.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No logs registered in this date range.</td>
                </tr>
              ) : (
                dataList.map((row, i) => (
                  <tr key={i}>
                    {reportType === 'employee-master' && (
                      <>
                        <td><strong>{row.employeeId}</strong></td>
                        <td>{row.name}</td>
                        <td>{row.mobile}</td>
                        <td>{row.email}</td>
                        <td>{row.gender}</td>
                        <td>{row.joiningDate}</td>
                        <td>{row.employmentType}</td>
                        <td>{row.salaryType === 'Monthly' ? `₹${row.monthlySalary.toLocaleString()}/mo` : `₹${row.perDaySalary}/day`}</td>
                      </>
                    )}
                    {reportType === 'branch-cost' && (
                      <>
                        <td><strong>{row.branchName}</strong></td>
                        <td>{row.employeeCount} active</td>
                        <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>₹{row.totalCost.toLocaleString()}</td>
                      </>
                    )}
                    {reportType === 'department-attendance' && (
                      <>
                        <td><strong>{row.departmentName}</strong></td>
                        <td style={{ color: 'var(--success)' }}>{row.presentCount}</td>
                        <td style={{ color: 'var(--danger)' }}>{row.absentCount}</td>
                        <td style={{ color: 'var(--warning)' }}>{row.halfDayCount}</td>
                        <td>{row.totalLogs} logs</td>
                      </>
                    )}
                    {reportType === 'overtime' && (
                      <>
                        <td><strong>{row.employeeId}</strong></td>
                        <td>{row.employeeName}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 'bold' }}>{row.totalOvertimeHours} hrs</td>
                      </>
                    )}
                    {reportType === 'late-coming' && (
                      <>
                        <td><strong>{row.employeeId}</strong></td>
                        <td>{row.employeeName}</td>
                        <td style={{ color: 'var(--danger)' }}>{row.lateDays} check-ins</td>
                        <td>{row.totalLateMinutes} minutes</td>
                      </>
                    )}
                    {reportType === 'advances' && (
                      <>
                        <td><strong>{row.employeeId}</strong></td>
                        <td>{row.employeeName}</td>
                        <td>{row.type}</td>
                        <td style={{ fontWeight: 'bold' }}>₹{row.totalAmount.toLocaleString()}</td>
                      </>
                    )}
                    {reportType === 'leaves' && (
                      <>
                        <td><strong>{row.employeeName}</strong></td>
                        <td>{row.leaveType}</td>
                        <td>{row.fromDate}</td>
                        <td>{row.toDate}</td>
                        <td><strong>{row.totalDays} Days</strong></td>
                        <td>
                          <span className={`badge ${row.status === 'Approved' ? 'badge-present' : row.status === 'Rejected' ? 'badge-absent' : 'badge-late'}`}>{row.status}</span>
                        </td>
                      </>
                    )}
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

export default Reports;
