import React, { useState, useEffect } from 'react';
import { Save, Settings as SettingsIcon, MapPin, Shield, CreditCard, Clock } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('corporate'); // 'corporate', 'payroll', 'attendance'

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    payrollSettings: {
      salaryDaysSetting: 'Calendar Days',
      weeklyOffPaid: true,
      holidayPaid: true,
      overtimeRateType: 'Multiplier',
      latePenaltyConfig: {
        enabled: true,
        graceMinutes: 15,
        allowedLateDays: 0,
        deductionPerLate: 100
      }
    },
    attendanceSettings: {
      fullDayHours: 8,
      halfDayHours: 4,
      lateGraceMinutes: 15,
      overtimeRate: 1.5,
      geofenceEnabled: true
    }
  });

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/extra/settings', { headers });
      const data = await res.json();
      if (res.ok) {
        // Enforce default keys for newly added settings
        const payroll = data.payrollSettings || {};
        setForm({
          ...data,
          payrollSettings: {
            salaryDaysSetting: payroll.salaryDaysSetting || 'Calendar Days',
            weeklyOffPaid: payroll.weeklyOffPaid !== false,
            holidayPaid: payroll.holidayPaid !== false,
            overtimeRateType: payroll.overtimeRateType || 'Multiplier',
            latePenaltyConfig: {
              enabled: payroll.latePenaltyConfig?.enabled !== false,
              graceMinutes: payroll.latePenaltyConfig?.graceMinutes ?? 15,
              allowedLateDays: payroll.latePenaltyConfig?.allowedLateDays ?? 0,
              deductionPerLate: payroll.latePenaltyConfig?.deductionPerLate ?? 100,
            }
          }
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAttendanceChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      attendanceSettings: {
        ...prev.attendanceSettings,
        [name]: type === 'checkbox' ? checked : parseFloat(value)
      }
    }));
  };

  const handlePayrollChange = (name, value) => {
    setForm(prev => ({
      ...prev,
      payrollSettings: {
        ...prev.payrollSettings,
        [name]: value
      }
    }));
  };

  const handleLatePenaltyChange = (name, value) => {
    setForm(prev => ({
      ...prev,
      payrollSettings: {
        ...prev.payrollSettings,
        latePenaltyConfig: {
          ...prev.payrollSettings.latePenaltyConfig,
          [name]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch('/api/extra/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Company settings saved successfully.');
        fetchSettings();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Save failed');
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading system settings...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '28px', color: 'var(--primary-color)' }}>Company Configurations</h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '14px' }}>Configure company profiles, geofences, shifts, and payroll rules.</p>
      </div>

      {/* Tabs Menu */}
      <div className="form-tab-header">
        <button 
          type="button" 
          className={`form-tab-btn ${activeTab === 'corporate' ? 'active' : ''}`} 
          onClick={() => setActiveTab('corporate')}
        >
          Corporate Profile
        </button>
        <button 
          type="button" 
          className={`form-tab-btn ${activeTab === 'payroll' ? 'active' : ''}`} 
          onClick={() => setActiveTab('payroll')}
        >
          Payroll & Wage Calculations
        </button>
        <button 
          type="button" 
          className={`form-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`} 
          onClick={() => setActiveTab('attendance')}
        >
          Shift & Geofencing Rules
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* TAB 1: CORPORATE PROFILE */}
        {activeTab === 'corporate' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
              Corporate Profile Settings
            </h3>
            
            <div className="form-group">
              <label className="label">Company Name *</label>
              <input type="text" className="input" name="name" value={form.name} onChange={handleTextChange} required />
            </div>

            <div className="form-group">
              <label className="label">Office Address *</label>
              <input type="text" className="input" name="address" value={form.address} onChange={handleTextChange} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="label">Contact Phone *</label>
                <input type="text" className="input" name="phone" value={form.phone} onChange={handleTextChange} required />
              </div>
              <div className="form-group">
                <label className="label">Email Address *</label>
                <input type="email" className="input" name="email" value={form.email} onChange={handleTextChange} required />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PAYROLL CALCULATIONS */}
        {activeTab === 'payroll' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Calculation rules */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                Payroll Divisor & Wage Settings
              </h3>

              <div className="form-group">
                <label className="label">Salary Days Setting *</label>
                <select 
                  className="select" 
                  value={form.payrollSettings.salaryDaysSetting} 
                  onChange={(e) => handlePayrollChange('salaryDaysSetting', e.target.value)} 
                  required
                >
                  <option value="Calendar Days">Calendar Days (28/30/31 days depending on month)</option>
                  <option value="Fixed 30">Fixed 30 Days (Standard divisor)</option>
                  <option value="Fixed 26">Fixed 26 Days (Excludes standard weekly offs)</option>
                  <option value="Working Days">Actual Working Days (Calendar days minus Sundays/weekly offs)</option>
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '4px' }}>
                  Determines the daily wage divisor used when calculating monthly salary payouts.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                  <input
                    type="checkbox"
                    checked={form.payrollSettings.weeklyOffPaid}
                    onChange={(e) => handlePayrollChange('weeklyOffPaid', e.target.checked)}
                  />
                  Weekly Off is Paid
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                  <input
                    type="checkbox"
                    checked={form.payrollSettings.holidayPaid}
                    onChange={(e) => handlePayrollChange('holidayPaid', e.target.checked)}
                  />
                  Holiday is Paid
                </label>
              </div>
            </div>

            {/* Overtime rate configuration */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} />
                <span>Overtime Rate Rules</span>
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="label">Overtime Rate Type</label>
                  <select
                    className="select"
                    value={form.payrollSettings.overtimeRateType}
                    onChange={(e) => handlePayrollChange('overtimeRateType', e.target.value)}
                  >
                    <option value="Multiplier">Multiplier (e.g. 1.5x of hourly rate)</option>
                    <option value="Flat">Flat Hourly Rate (e.g. ₹200/hr)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">
                    {form.payrollSettings.overtimeRateType === 'Flat' ? 'Overtime Rate (INR/hr) *' : 'Overtime Multiplier *'}
                  </label>
                  <input
                    type="number"
                    className="input"
                    name="overtimeRate"
                    value={form.attendanceSettings.overtimeRate}
                    onChange={handleAttendanceChange}
                    step={form.payrollSettings.overtimeRateType === 'Flat' ? '1' : '0.1'}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Late penalties config */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} />
                <span>Late Coming Penalties</span>
              </h3>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={form.payrollSettings.latePenaltyConfig.enabled}
                  onChange={(e) => handleLatePenaltyChange('enabled', e.target.checked)}
                />
                Enable Late Penalty Deductions
              </label>

              {form.payrollSettings.latePenaltyConfig.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="label">Grace Time (Mins) *</label>
                    <input
                      type="number"
                      className="input"
                      value={form.payrollSettings.latePenaltyConfig.graceMinutes}
                      onChange={(e) => handleLatePenaltyChange('graceMinutes', parseInt(e.target.value, 10))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Allowed Late Days (Free) *</label>
                    <input
                      type="number"
                      className="input"
                      value={form.payrollSettings.latePenaltyConfig.allowedLateDays}
                      onChange={(e) => handleLatePenaltyChange('allowedLateDays', parseInt(e.target.value, 10))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Deduction Per Late Day (INR) *</label>
                    <input
                      type="number"
                      className="input"
                      value={form.payrollSettings.latePenaltyConfig.deductionPerLate}
                      onChange={(e) => handleLatePenaltyChange('deductionPerLate', parseInt(e.target.value, 10))}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: SHIFT & GEOFENCING */}
        {activeTab === 'attendance' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--primary-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} />
              <span>Shift Timing & Geofencing Bounds</span>
            </h3>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
              <input
                type="checkbox"
                name="geofenceEnabled"
                checked={form.attendanceSettings.geofenceEnabled}
                onChange={handleAttendanceChange}
              />
              Enable Mobile Punch Geofencing Validation
            </label>
            <p style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '-8px' }}>
              Requires employees to punch attendance within their branch geofence radius.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
              <div className="form-group">
                <label className="label">Full Day Work threshold (Hrs) *</label>
                <input
                  type="number"
                  className="input"
                  name="fullDayHours"
                  value={form.attendanceSettings.fullDayHours}
                  onChange={handleAttendanceChange}
                  step="0.5"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Half Day Work threshold (Hrs) *</label>
                <input
                  type="number"
                  className="input"
                  name="halfDayHours"
                  value={form.attendanceSettings.halfDayHours}
                  onChange={handleAttendanceChange}
                  step="0.5"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="label">Shift Entrance Late Grace (Mins) *</label>
                <input
                  type="number"
                  className="input"
                  name="lateGraceMinutes"
                  value={form.attendanceSettings.lateGraceMinutes}
                  onChange={handleAttendanceChange}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          {success && <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>{success}</p>}
          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>{error}</p>}
          
          <button type="submit" className="btn btn-primary" style={{ padding: '14px 0', fontSize: '15px' }}>
            <Save size={18} />
            <span>Save Settings Changes</span>
          </button>
        </div>

      </form>
    </div>
  );
}
