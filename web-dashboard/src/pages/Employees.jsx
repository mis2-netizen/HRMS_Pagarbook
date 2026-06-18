import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, X, Save, ArrowRight, ArrowLeft } from 'lucide-react';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Dropdown Metadata
  const [metadata, setMetadata] = useState({
    branches: [],
    departments: [],
    designations: [],
    shifts: [],
    managers: []
  });

  // Active Profile Drawer View
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empDetails, setEmpDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState('overview'); // 'overview', 'work', 'salary', 'ledger'

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [modalStep, setModalStep] = useState(1); // 1: Bio, 2: Position, 3: Payroll
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    mobile: '',
    email: '',
    gender: 'Male',
    dob: '',
    address: '',
    joiningDate: '',
    employmentType: 'Full-time',
    status: 'Active',
    branchId: '',
    departmentId: '',
    designationId: '',
    managerId: '',
    shiftId: '',
    weeklyOff: 'Sunday',
    salaryType: 'Monthly',
    monthlySalary: 0,
    perDaySalary: 0,
    role: 'employee',
    password: '',
    salaryStructure: {
      pfEnabled: false,
      esiEnabled: false,
      ptEnabled: false
    },
    bankDetails: {
      bankName: '',
      accountNumberMasked: '',
      ifsc: '',
      uan: '',
      esicNumber: ''
    }
  });

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let url = '/api/employees';
      const queryParams = [];
      if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
      if (filterBranch) queryParams.push(`branchId=${filterBranch}`);
      if (filterDept) queryParams.push(`departmentId=${filterDept}`);
      if (filterStatus) queryParams.push(`status=${filterStatus}`);
      if (queryParams.length > 0) {
        url += '?' + queryParams.join('&');
      }

      const res = await fetch(url, { headers });
      const data = await res.json();
      if (res.ok) setEmployees(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const res = await fetch('/api/employees/metadata', { headers });
      const data = await res.json();
      if (res.ok) {
        setMetadata(data);
        if (data.branches.length > 0 && !formData.branchId) {
          setFormData(prev => ({
            ...prev,
            branchId: data.branches[0].id,
            departmentId: data.departments[0]?.id || '',
            designationId: data.designations[0]?.id || '',
            shiftId: data.shifts[0]?.id || ''
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchMetadata();
  }, [search, filterBranch, filterDept, filterStatus]);

  // View Detailed Profile Drawer
  const handleViewProfile = async (empId) => {
    setDetailsLoading(true);
    setSelectedEmp(empId);
    setDrawerTab('overview');
    try {
      const res = await fetch(`/api/employees/${empId}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setEmpDetails(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Open Onboarding Modal
  const openCreateModal = () => {
    setModalMode('create');
    setModalStep(1);
    setFormData({
      employeeId: '',
      name: '',
      mobile: '',
      email: '',
      gender: 'Male',
      dob: '',
      address: '',
      joiningDate: new Date().toISOString().split('T')[0],
      employmentType: 'Full-time',
      status: 'Active',
      branchId: metadata.branches[0]?.id || '',
      departmentId: metadata.departments[0]?.id || '',
      designationId: metadata.designations[0]?.id || '',
      managerId: '',
      shiftId: metadata.shifts[0]?.id || '',
      weeklyOff: 'Sunday',
      salaryType: 'Monthly',
      monthlySalary: 0,
      perDaySalary: 0,
      role: 'employee',
      password: '',
      salaryStructure: {
        pfEnabled: false,
        esiEnabled: false,
        ptEnabled: false
      },
      bankDetails: {
        bankName: '',
        accountNumberMasked: '',
        ifsc: '',
        uan: '',
        esicNumber: ''
      }
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (emp) => {
    setModalMode('edit');
    setModalStep(1);
    setFormData({
      employeeId: emp.employeeId,
      name: emp.name,
      mobile: emp.mobile,
      email: emp.email,
      gender: emp.gender,
      dob: emp.dob || '',
      address: emp.address || '',
      joiningDate: emp.joiningDate || '',
      employmentType: emp.employmentType,
      status: emp.status,
      branchId: emp.branchId || '',
      departmentId: emp.departmentId || '',
      designationId: emp.designationId || '',
      managerId: emp.managerId || '',
      shiftId: emp.shiftId || '',
      weeklyOff: emp.weeklyOff,
      salaryType: emp.salaryType,
      monthlySalary: emp.monthlySalary,
      perDaySalary: emp.perDaySalary,
      role: emp.role || 'employee',
      password: '',
      salaryStructure: emp.salaryStructure || {
        pfEnabled: false,
        esiEnabled: false,
        ptEnabled: false
      },
      bankDetails: emp.bankDetails || {
        bankName: '',
        accountNumberMasked: '',
        ifsc: '',
        uan: '',
        esicNumber: ''
      }
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      bankDetails: {
        ...prev.bankDetails,
        [name]: value
      }
    }));
  };

  const handleStructureToggle = (field) => {
    setFormData(prev => ({
      ...prev,
      salaryStructure: {
        ...prev.salaryStructure,
        [field]: !prev.salaryStructure[field]
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const endpoint = modalMode === 'create' ? '/api/employees' : `/api/employees/${formData.employeeId}`;
    const method = modalMode === 'create' ? 'POST' : 'PUT';

    try {
      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        setFormSuccess(data.message || 'Onboard processing completed successfully.');
        setTimeout(() => {
          setIsModalOpen(false);
          fetchEmployees();
        }, 1500);
      } else {
        setFormError(data.message || 'Validation checks failed.');
      }
    } catch (err) {
      setFormError('Connection issue occurred.');
    }
  };

  const handleDelete = async (empId) => {
    if (!window.confirm(`Are you sure you want to remove ${empId}? This deletes all leave and attendance records.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/employees/${empId}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        alert('Employee master record deleted.');
        fetchEmployees();
        if (selectedEmp === empId) {
          setSelectedEmp(null);
          setEmpDetails(null);
        }
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (e) {
      alert('Delete failed');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedEmp ? '1fr 380px' : '1fr', gap: '32px', transition: 'all 0.3s' }}>
      
      {/* Left List Pane */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '28px', color: 'var(--primary-color)' }}>Employee Master</h2>
            <p style={{ color: 'var(--text-sub)', fontSize: '14px' }}>Directory database of onboarding profiles, salaries, and files.</p>
          </div>
          
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus size={18} />
            <span>Onboard Employee</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by ID, name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="select" style={{ width: '160px' }} value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {metadata.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select className="select" style={{ width: '160px' }} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {metadata.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <select className="select" style={{ width: '120px' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Left">Left</option>
          </select>

        </div>

        {/* Table List */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Branch</th>
                <th>Department</th>
                <th>Salary Structure</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px' }}>Loading employees catalog...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No employee profiles found.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employeeId} style={{ cursor: 'pointer', backgroundColor: selectedEmp === emp.employeeId ? 'var(--primary-soft)' : '' }}>
                    <td onClick={() => handleViewProfile(emp.employeeId)}><strong>{emp.employeeId}</strong></td>
                    <td onClick={() => handleViewProfile(emp.employeeId)}>{emp.name}</td>
                    <td>{emp.mobile}</td>
                    <td>{emp.branchName}</td>
                    <td>{emp.departmentName}</td>
                    <td>
                      {emp.salaryType === 'Monthly' ? `₹${emp.monthlySalary.toLocaleString()}/mo` : `₹${emp.perDaySalary}/day`}
                    </td>
                    <td>
                      <span className={`badge ${emp.status === 'Active' ? 'badge-present' : 'badge-absent'}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          title="View Details"
                          onClick={() => handleViewProfile(emp.employeeId)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          title="Edit Profile"
                          onClick={() => openEditModal(emp)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--secondary-color)' }}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          title="Delete Employee"
                          onClick={() => handleDelete(emp.employeeId)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                        >
                          <Trash2 size={16} />
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

      {/* Right Drawer detailed profile pane */}
      {selectedEmp && (
        <div className="card" style={{ height: 'calc(100vh - 120px)', position: 'sticky', top: '90px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--primary-color)' }}>Employee File</h3>
            <button onClick={() => setSelectedEmp(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
              <X size={18} />
            </button>
          </div>

          {detailsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading file details...</div>
          ) : !empDetails ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Profile not found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              
              {/* Bio Header card */}
              <div style={{ textAlign: 'center', backgroundColor: 'var(--primary-soft)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', margin: '0 auto 8px' }}>
                  {empDetails.employee.name.charAt(0)}
                </div>
                <h4 style={{ fontSize: '15px' }}>{empDetails.employee.name}</h4>
                <p style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{empDetails.employee.designationName}</p>
                <p style={{ color: 'var(--text-sub)', fontSize: '11px', marginTop: '2px' }}>ID: {empDetails.employee.employeeId}</p>
              </div>

              {/* Drawer Tabs */}
              <div className="form-tab-header" style={{ marginBottom: '8px' }}>
                <button className={`form-tab-btn ${drawerTab === 'overview' ? 'active' : ''}`} onClick={() => setDrawerTab('overview')}>Overview</button>
                <button className={`form-tab-btn ${drawerTab === 'work' ? 'active' : ''}`} onClick={() => setDrawerTab('work')}>Work</button>
                <button className={`form-tab-btn ${drawerTab === 'salary' ? 'active' : ''}`} onClick={() => setDrawerTab('salary')}>Salary</button>
                <button className={`form-tab-btn ${drawerTab === 'ledger' ? 'active' : ''}`} onClick={() => setDrawerTab('ledger')}>Ledger</button>
              </div>

              {/* Tab Content 1: Overview */}
              {drawerTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p><strong>Mobile:</strong> {empDetails.employee.mobile}</p>
                  <p><strong>Email:</strong> {empDetails.employee.email}</p>
                  <p><strong>Gender:</strong> {empDetails.employee.gender}</p>
                  <p><strong>Date of Birth:</strong> {empDetails.employee.dob || '-'}</p>
                  <p><strong>Address:</strong> {empDetails.employee.address}</p>
                </div>
              )}

              {/* Tab Content 2: Work */}
              {drawerTab === 'work' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p><strong>Branch HQ:</strong> {empDetails.employee.branchName}</p>
                  <p><strong>Department:</strong> {empDetails.employee.departmentName}</p>
                  <p><strong>Shift TIMING:</strong> {empDetails.employee.shiftName} (09:00 - 18:00)</p>
                  <p><strong>Weekly Off:</strong> {empDetails.employee.weeklyOff}</p>
                  <p><strong>Reports To:</strong> {empDetails.employee.managerName || 'None'}</p>
                  <p><strong>Joining Date:</strong> {empDetails.employee.joiningDate}</p>
                  <p><strong>Employment:</strong> {empDetails.employee.employmentType}</p>
                </div>
              )}

              {/* Tab Content 3: Salary */}
              {drawerTab === 'salary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <p><strong>Wage Plan:</strong> {empDetails.employee.salaryType}</p>
                  {empDetails.employee.salaryType === 'Monthly' ? (
                    <p><strong>Monthly Rate:</strong> ₹{empDetails.employee.monthlySalary.toLocaleString()}/mo</p>
                  ) : (
                    <p><strong>Per Day Rate:</strong> ₹{empDetails.employee.perDaySalary}/day</p>
                  )}
                  <p><strong>Bank Name:</strong> {empDetails.employee.bankDetails.bankName || '-'}</p>
                  <p><strong>IFSC:</strong> {empDetails.employee.bankDetails.ifsc || '-'}</p>
                  <p><strong>Account:</strong> {empDetails.employee.bankDetails.accountNumberMasked || '-'}</p>
                  <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <p><strong>PF State:</strong> {empDetails.employee.salaryStructure.pfEnabled ? '✅ Enabled' : '❌ Disabled'}</p>
                    <p><strong>ESI State:</strong> {empDetails.employee.salaryStructure.esiEnabled ? '✅ Enabled' : '❌ Disabled'}</p>
                  </div>
                </div>
              )}

              {/* Tab Content 4: Ledger */}
              {drawerTab === 'ledger' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Leaves List */}
                  <div>
                    <h5 style={{ fontWeight: 'bold', marginBottom: '6px' }}>Leave Balances</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', textAlign: 'center' }}>
                      {empDetails.leaveBalances.map((b, i) => (
                        <div key={i} style={{ backgroundColor: 'var(--gray-50)', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                          <p style={{ fontSize: '8px', color: 'var(--text-sub)' }}>{b.leaveType}</p>
                          <p style={{ fontSize: '11px', fontWeight: 'bold' }}>{b.available}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Logs */}
                  <div>
                    <h5 style={{ fontWeight: 'bold', marginBottom: '6px' }}>Recent Attendance logs</h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {empDetails.attendance.slice(0, 4).map((a, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '2px', fontSize: '11px' }}>
                          <span>{a.date}</span>
                          <span className={`badge ${a.status === 'Present' ? 'badge-present' : a.status === 'Absent' ? 'badge-absent' : 'badge-late'}`}>{a.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Adjustments history */}
                  <div>
                    <h5 style={{ fontWeight: 'bold', marginBottom: '4px' }}>Adjustment ledger</h5>
                    {empDetails.adjustments.length === 0 ? (
                      <p style={{ fontSize: '11px', color: 'var(--text-sub)' }}>No advances/bonuses.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {empDetails.adjustments.slice(0, 3).map((adj, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span>{adj.type} ({adj.applicableMonth}/{adj.applicableYear})</span>
                            <strong>₹{adj.amount.toLocaleString()}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Onboarding Wizard Modal Overlay */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', color: 'var(--primary-color)' }}>
                {modalMode === 'create' ? 'Onboard Employee Wizard' : 'Edit Employee Settings'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            {/* Wizard progress steps */}
            <div style={{ display: 'flex', justifyItems: 'space-between', marginBottom: '24px', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '20px',
                right: '20px',
                height: '2px',
                backgroundColor: 'var(--border-color)',
                zIndex: 1
              }}></div>
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '20px',
                width: modalStep === 2 ? '50%' : modalStep === 3 ? '100%' : '0%',
                height: '2px',
                backgroundColor: 'var(--primary-color)',
                zIndex: 1,
                transition: 'all 0.3s'
              }}></div>

              {[
                { step: 1, label: '1. Personal Bio' },
                { step: 2, label: '2. Job Profile' },
                { step: 3, label: '3. Salary & Bank' }
              ].map((s) => (
                <div key={s.step} style={{ flex: 1, textAlign: 'center', zIndex: 2 }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: modalStep >= s.step ? 'var(--primary-color)' : 'var(--bg-app)',
                    color: modalStep >= s.step ? '#ffffff' : 'var(--text-sub)',
                    border: `2.5px solid ${modalStep >= s.step ? 'var(--primary-color)' : 'var(--border-color)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    transition: 'all 0.3s'
                  }}>
                    {s.step}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: modalStep === s.step ? 'bold' : 'normal', color: modalStep === s.step ? 'var(--primary-color)' : 'var(--text-sub)' }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* STEP 1: Personal Details */}
              {modalStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Full Name *</label>
                      <input type="text" className="input" name="name" value={formData.name} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                      <label className="label">Mobile Number *</label>
                      <input type="tel" className="input" name="mobile" value={formData.mobile} onChange={handleFormChange} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Email Address *</label>
                      <input type="email" className="input" name="email" value={formData.email} onChange={handleFormChange} required />
                    </div>
                    <div className="form-group">
                      <label className="label">Gender</label>
                      <select className="select" name="gender" value={formData.gender} onChange={handleFormChange}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Date of Birth</label>
                      <input type="date" className="input" name="dob" value={formData.dob} onChange={handleFormChange} />
                    </div>
                    <div className="form-group">
                      <label className="label">Residential Address</label>
                      <input type="text" className="input" name="address" value={formData.address} onChange={handleFormChange} />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Position / Shift settings */}
              {modalStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Branch Office *</label>
                      <select className="select" name="branchId" value={formData.branchId} onChange={handleFormChange} required>
                        {metadata.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">Department *</label>
                      <select className="select" name="departmentId" value={formData.departmentId} onChange={handleFormChange} required>
                        {metadata.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Designation *</label>
                      <select className="select" name="designationId" value={formData.designationId} onChange={handleFormChange} required>
                        {metadata.designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">Direct Manager</label>
                      <select className="select" name="managerId" value={formData.managerId} onChange={handleFormChange}>
                        <option value="">No Direct Manager</option>
                        {metadata.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Shift TIMING *</label>
                      <select className="select" name="shiftId" value={formData.shiftId} onChange={handleFormChange} required>
                        {metadata.shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">Weekly Off</label>
                      <select className="select" name="weeklyOff" value={formData.weeklyOff} onChange={handleFormChange}>
                        <option value="Sunday">Sunday</option>
                        <option value="Saturday,Sunday">Saturday, Sunday</option>
                        <option value="Monday">Monday</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Employment Type</label>
                      <select className="select" name="employmentType" value={formData.employmentType} onChange={handleFormChange}>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Intern">Intern</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label">System User Role</label>
                      <select className="select" name="role" value={formData.role} onChange={handleFormChange}>
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="hr">HR Admin</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Salary and Bank details */}
              {modalStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Wages structure */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Salary Plan</label>
                      <select className="select" name="salaryType" value={formData.salaryType} onChange={handleFormChange}>
                        <option value="Monthly">Monthly Salary</option>
                        <option value="Daily wage">Daily Wage</option>
                        <option value="Hourly">Hourly rate</option>
                      </select>
                    </div>
                    {formData.salaryType === 'Monthly' ? (
                      <div className="form-group">
                        <label className="label">Base Monthly Salary *</label>
                        <input type="number" className="input" name="monthlySalary" value={formData.monthlySalary} onChange={handleFormChange} required />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="label">Per Day Rate *</label>
                        <input type="number" className="input" name="perDaySalary" value={formData.perDaySalary} onChange={handleFormChange} required />
                      </div>
                    )}
                  </div>

                  {formData.salaryType === 'Monthly' && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '10px 0' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formData.salaryStructure.pfEnabled} onChange={() => handleStructureToggle('pfEnabled')} />
                        PF (12%)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formData.salaryStructure.esiEnabled} onChange={() => handleStructureToggle('esiEnabled')} />
                        ESI (0.75%)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={formData.salaryStructure.ptEnabled} onChange={() => handleStructureToggle('ptEnabled')} />
                        Prof. Tax (PT)
                      </label>
                    </div>
                  )}

                  {/* Bank info */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">Bank Name</label>
                      <input type="text" className="input" name="bankName" value={formData.bankDetails.bankName} onChange={handleBankChange} />
                    </div>
                    <div className="form-group">
                      <label className="label">Account Number</label>
                      <input type="text" className="input" name="accountNumberMasked" value={formData.bankDetails.accountNumberMasked} onChange={handleBankChange} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="label">IFSC Code</label>
                      <input type="text" className="input" name="ifsc" value={formData.bankDetails.ifsc} onChange={handleBankChange} />
                    </div>
                    <div className="form-group">
                      <label className="label">EPFO UAN</label>
                      <input type="text" className="input" name="uan" value={formData.bankDetails.uan} onChange={handleBankChange} />
                    </div>
                  </div>

                  {modalMode === 'create' && (
                    <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <label className="label">Portal Password (Default: emp123)</label>
                      <input type="password" className="input" name="password" value={formData.password} onChange={handleFormChange} placeholder="Enter login password" />
                    </div>
                  )}

                </div>
              )}

              {/* Status responses */}
              {formError && <p style={{ color: 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>{formError}</p>}
              {formSuccess && <p style={{ color: 'var(--success)', fontSize: '12px', textAlign: 'center' }}>{formSuccess}</p>}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '12px' }}>
                <button
                  type="button"
                  disabled={modalStep === 1}
                  onClick={() => setModalStep(prev => prev - 1)}
                  className="btn btn-secondary"
                  style={{ opacity: modalStep === 1 ? 0.4 : 1 }}
                >
                  <ArrowLeft size={16} /> Back
                </button>

                {modalStep < 3 ? (
                  <button type="button" onClick={() => setModalStep(prev => prev + 1)} className="btn btn-primary">
                    Next <ArrowRight size={16} />
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary">
                    <Save size={16} /> Confirm Onboard
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
