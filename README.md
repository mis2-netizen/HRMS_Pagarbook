# HR Payroll Management System (Pagarbook Style)

A production-ready HRMS system where employees can mark attendance, apply for leaves, and download payslips, and HR/Admin can manage employee rosters, adjust salary advances, and process monthly payroll with locked records.

---

## 🌟 Tech Stack & Project Architecture

- **Backend API (`backend/`)**: Node.js & Express.js with SQLite (easily portable to PostgreSQL). Uses `pdfkit` for payslips and has native geofence calculations.
- **Web Dashboard & Mobile Simulator (`web-dashboard/`)**: Vite + React.js SPA. Contains both the **HR/Admin Administration Panel** and a fully interactive **Employee Mobile App Simulator** right in the browser.
- **Mobile App Codebase (`employee-mobile/`)**: Standard buildable Flutter structure for compiling native Android APKs.

---

## 🔑 Demo Login Credentials

The database comes pre-seeded with **30 days of realistic daily attendance logs**, leave request entries, financial adjustments, and finalized payroll history.

Use these credentials to log in:

| Role | Username / Email | Password | Linked Employee / Notes |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@company.com` | `admin123` | Can lock/unlock payroll sheets and edit branch coordinates |
| **HR Manager** | `hr@company.com` | `hr123` | Can onboard employees, run payroll, and approve leaves |
| **Manager** | `david@company.com` | `emp123` | David White (directs Bangalore Tech Hub) |
| **Employee (Monthly)** | `john@company.com` | `emp123` | John Doe (Software Engineer - Bangalore Hub) |
| **Employee (Daily)** | `henry@company.com` | `emp123` | Henry Wilson (Daily wage contractor) |

---

## 🚀 Step-by-Step Setup Instructions

### 1. Start the Backend API
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. The dependencies are already installed. Seed the database to create `hrms.db` and populate mock history:
   ```bash
   npm run seed
   ```
3. Start the Express server:
   ```bash
   npm start
   ```
   *The backend will boot up on port `5000` (URL: `http://localhost:5000`).*

### 2. Start the Web Dashboard & Mobile Simulator
1. Open a new terminal and navigate to the web-dashboard directory:
   ```bash
   cd web-dashboard
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The development server will boot on port `3000` (URL: `http://localhost:3000`).*
3. Open `http://localhost:3000` in your browser.

---

## 📱 Interactive Employee Mobile Simulator

Since compilation of mobile APKs requires Android SDK, you can test all native APK features instantly inside the React dashboard:
1. Log in as HR or Admin on the dashboard.
2. Click **Open Mobile App** in the sidebar.
3. Use the **Quick Login** dropdown to log in as John, Bob, or Henry.
4. **Mark Attendance Tab**:
   - Toggle the **GPS Geofence checkbox** to mock whether the employee is physically inside the branch radius. Try clocking in while outside to see the geofence restriction block message.
   - Click **Take Mock Photo** to attach a selfie punch.
5. **Leave Tab**: Apply for Sick/Casual leaves. Then check the HR panel to approve it and verify that the calendar dates automatically fill with Leave status.
6. **Salary Tab**: Click the PDF icon to dynamically generate and download a professional corporate salary slip.

---

## 🧮 Payroll Calculation Formulas

The payroll calculations are computed as follows:
1. **Payable Days**:
   $$\text{Payable Days} = \text{Present Days} + \text{Paid Leaves} + \text{Weekly Offs} + \text{Holidays} + (0.5 \times \text{Half Days})$$
2. **Monthly salary base**:
   $$\text{Earned Base} = \text{Monthly Base Salary} \times \left(\frac{\text{Payable Days}}{\text{Divisor Setting}}\right)$$
   *(Divisor Setting can be configured in Settings page to Calendar Days, Fixed 30, Fixed 26, or Working Days)*
3. **Overtime Amount**:
   $$\text{Overtime} = \text{Overtime Hours} \times \left(\frac{\text{Base Salary}}{26 \times 8}\right) \times 1.5$$
4. **Net Payable Salary**:
   $$\text{Net Salary} = \text{Earned Base} + \text{Overtime} + \text{Bonuses} - \text{PF} - \text{ESI} - \text{Professional Tax} - \text{Advances} - \text{Late Penalty}$$

---

## 🧪 Verification & Testing Checks

- To run backend payroll unit tests proving mathematical precision on the 30 days of seeded data:
  ```bash
  cd backend
  npm run test-payroll
  ```
- To test CSV reporting: Go to the **Export Reports** page, select a report, check the live preview, and click **Export CSV** to download it.
