const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper to convert number to words (Indian Rupee / general currency style)
const numberToWords = (num) => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertMillions = (n) => {
    if (n >= 1000000) {
      return convertMillions(Math.floor(n / 1000000)) + ' Million ' + convertMillions(n % 1000000);
    }
    if (n >= 1000) {
      return convertThousands(Math.floor(n / 1000)) + ' Thousand ' + convertThousands(n % 1000);
    }
    return convertThousands(n);
  };

  const convertThousands = (n) => {
    if (n >= 100) {
      return a[Math.floor(n / 100)] + ' Hundred ' + convertHundreds(n % 100);
    }
    return convertHundreds(n);
  };

  const convertHundreds = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  };

  if (num === 0) return 'Zero';
  
  const whole = Math.floor(num);
  const words = convertMillions(whole);
  
  return words + ' Only';
};

// Generate Salary Slip PDF
const generateSalarySlipPDF = (payrollData, employeeData, companyData, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    
    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // 1. Logo and Company Header
    doc.fillColor('#1b4332') // Deep green theme
       .rect(0, 0, 595, 12)
       .fill();

    doc.fillColor('#333333');
    doc.fontSize(20).text(companyData.name, 40, 30, { align: 'left', bold: true });
    doc.fontSize(9)
       .text(companyData.address, 40, 55)
       .text(`Phone: ${companyData.phone} | Email: ${companyData.email}`, 40, 68);

    doc.fontSize(14).fillColor('#1b4332').text('PAYSLIP', 450, 30, { align: 'right' });
    
    const monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    doc.fontSize(10).fillColor('#666666').text(`${monthNames[payrollData.month]} ${payrollData.year}`, 450, 48, { align: 'right' });

    // Horizontal line
    doc.moveTo(40, 88).lineTo(555, 88).strokeColor('#dddddd').stroke();

    // 2. Employee Details Block
    doc.fillColor('#333333');
    doc.fontSize(10);
    
    let y = 100;
    const drawMetaRow = (label1, val1, label2, val2, currY) => {
      doc.font('Helvetica-Bold').text(label1, 40, currY).font('Helvetica').text(`: ${val1 || '-'}`, 130, currY);
      doc.font('Helvetica-Bold').text(label2, 300, currY).font('Helvetica').text(`: ${val2 || '-'}`, 400, currY);
    };

    drawMetaRow('Employee ID', employeeData.employeeId, 'Department', employeeData.departmentName, y);
    drawMetaRow('Employee Name', employeeData.name, 'Designation', employeeData.designationName, y + 16);
    drawMetaRow('Bank Name', employeeData.bankDetails.bankName, 'Account Number', employeeData.bankDetails.accountNumberMasked, y + 32);
    drawMetaRow('IFSC Code', employeeData.bankDetails.ifsc, 'UAN Number', employeeData.bankDetails.uan, y + 48);
    drawMetaRow('Date of Joining', employeeData.joiningDate, 'Shift Assigned', employeeData.shiftName, y + 64);

    // Horizontal line
    doc.moveTo(40, 185).lineTo(555, 185).strokeColor('#dddddd').stroke();

    // 3. Attendance Summary Block
    const summary = payrollData.attendanceSummary;
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1b4332').text('ATTENDANCE SUMMARY', 40, 195);
    
    doc.fillColor('#333333');
    doc.fontSize(9);
    
    const payableDays = summary.presentDays + summary.paidLeaveDays + summary.weeklyOffs + summary.holidays + (0.5 * (summary.halfDays || 0));

    let attY = 212;
    doc.font('Helvetica-Bold')
       .text('Present', 40, attY).text('Leaves (Paid)', 120, attY).text('Weekly Offs', 210, attY).text('Holidays', 300, attY).text('Overtime (Hrs)', 380, attY).text('Payable Days', 470, attY);
    
    doc.font('Helvetica')
       .text(summary.presentDays, 40, attY + 14)
       .text(summary.paidLeaveDays, 120, attY + 14)
       .text(summary.weeklyOffs, 210, attY + 14)
       .text(summary.holidays, 300, attY + 14)
       .text(summary.overtimeHours || '0.0', 380, attY + 14)
       .text(payableDays, 470, attY + 14);

    // Horizontal line
    doc.moveTo(40, 250).lineTo(555, 250).strokeColor('#dddddd').stroke();

    // 4. Earnings vs Deductions Table
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1b4332').text('EARNINGS', 40, 260);
    doc.text('DEDUCTIONS', 300, 260);

    // Header backgrounds
    doc.fillColor('#f8f9fa').rect(40, 275, 250, 20).fill();
    doc.fillColor('#f8f9fa').rect(300, 275, 255, 20).fill();

    doc.fillColor('#333333').fontSize(9);
    doc.font('Helvetica-Bold')
       .text('Particulars', 45, 281)
       .text('Amount (INR)', 210, 281, { align: 'right', width: 70 })
       .text('Particulars', 305, 281)
       .text('Amount (INR)', 470, 281, { align: 'right', width: 75 });

    let earnY = 302;
    let dedY = 302;

    const earnings = payrollData.earnings;
    const deductions = payrollData.deductions;

    // Draw Earnings rows
    const drawEarnRow = (label, amt) => {
      doc.font('Helvetica').text(label, 45, earnY);
      doc.text(amt.toLocaleString('en-IN'), 210, earnY, { align: 'right', width: 70 });
      earnY += 18;
    };

    // Draw Deductions rows
    const drawDedRow = (label, amt) => {
      doc.font('Helvetica').text(label, 305, dedY);
      doc.text(amt.toLocaleString('en-IN'), 470, dedY, { align: 'right', width: 75 });
      dedY += 18;
    };

    // Populate Earnings
    drawEarnRow('Basic Salary', earnings.basic || 0);
    drawEarnRow('House Rent Allowance (HRA)', earnings.hra || 0);
    drawEarnRow('Conveyance Allowance', earnings.conveyance || 0);
    drawEarnRow('Special Allowance', earnings.allowance || 0);
    if (earnings.overtimeAmount > 0) drawEarnRow('Overtime Pay', earnings.overtimeAmount);
    if (earnings.bonus > 0) drawEarnRow('Bonus', earnings.bonus);
    if (earnings.incentive > 0) drawEarnRow('Incentives', earnings.incentive);
    
    // Populate Deductions
    drawDedRow('Provident Fund (PF)', deductions.pf || 0);
    drawDedRow('Employee State Insurance (ESI)', deductions.esi || 0);
    drawDedRow('Professional Tax (PT)', deductions.professionalTax || 0);
    if (deductions.advanceDeduction > 0) drawDedRow('Salary Advance Deduction', deductions.advanceDeduction);
    if (deductions.loanDeduction > 0) drawDedRow('Loan Installment Deduction', deductions.loanDeduction);
    if (deductions.latePenalty > 0) drawDedRow('Late Coming Penalty', deductions.latePenalty);
    if (deductions.otherDeductions > 0) drawDedRow('Other Deductions', deductions.otherDeductions);

    // Find the max Y to align total box
    const maxY = Math.max(earnY, dedY) + 10;
    doc.moveTo(40, maxY).lineTo(555, maxY).strokeColor('#dddddd').stroke();

    // Draw Totals row
    const totalsY = maxY + 8;
    doc.font('Helvetica-Bold');
    doc.text('Gross Earnings', 45, totalsY);
    doc.text(payrollData.grossSalary.toLocaleString('en-IN'), 210, totalsY, { align: 'right', width: 70 });

    doc.text('Total Deductions', 305, totalsY);
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (val || 0), 0);
    doc.text(totalDeductions.toLocaleString('en-IN'), 470, totalsY, { align: 'right', width: 75 });

    // Draw Net Pay Block
    const netPayY = totalsY + 30;
    doc.fillColor('#e8f5e9').rect(40, netPayY, 515, 36).fill();
    
    doc.fillColor('#1b4332').fontSize(12).font('Helvetica-Bold')
       .text('NET PAYABLE SALARY', 50, netPayY + 12);
    
    doc.text(`INR ${payrollData.netSalary.toLocaleString('en-IN')}`, 400, netPayY + 12, { align: 'right', width: 140 });

    // Amount in Words
    const wordsY = netPayY + 46;
    doc.fillColor('#555555').fontSize(9).font('Helvetica')
       .text(`Amount in Words: INR ${numberToWords(payrollData.netSalary)}`, 40, wordsY);

    // Footnote & signatures
    const sigY = wordsY + 60;
    doc.moveTo(40, sigY).lineTo(555, sigY).strokeColor('#dddddd').stroke();
    
    doc.fontSize(8).fillColor('#888888')
       .text('This is a computer generated document and does not require a physical signature.', 40, sigY + 15)
       .fontSize(10).font('Helvetica-Bold').fillColor('#333333')
       .text('HR Signature / Stamp', 430, sigY + 30);

    doc.end();

    stream.on('finish', () => {
      resolve(outputPath);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
};

module.exports = {
  generateSalarySlipPDF
};
