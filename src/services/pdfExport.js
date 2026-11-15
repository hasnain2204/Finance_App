import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateExpenseTotal, formatDate, fromPaisa } from '../lib/finance';

/**
 * Format currency safely for standard PDF typography
 * Using "PKR" or "Rs." to avoid glyph rendering issues in standard PDF fonts
 */
function formatPdfCurrency(amount) {
  const numeric = Number(amount || 0);
  const formatted = numeric.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return `PKR ${formatted}`;
}

/**
 * Generates and downloads a comprehensive personal finance statement PDF
 */
export function exportFinancialReportPdf({
  transactions = [],
  budgets = [],
  totalBudgetPaisa = 0,
  categoryMap = {},
  paymentMap = {},
  preferences = {}
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const totalExpense = calculateExpenseTotal(transactions);
  const hasOverallBudget = budgets.some((b) => b.categoryId === 'overall');
  const overallBudget = hasOverallBudget ? fromPaisa(totalBudgetPaisa) : null;
  const availableBalance = overallBudget === null ? null : overallBudget - totalExpense;

  const userName = preferences?.name?.trim() || 'User';
  const dateFormat = preferences?.dateFormat || 'DD MMM YYYY';
  const currentDate = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // --- 1. Header Section ---
  doc.setFillColor(23, 99, 79); // PWS Brand Primary (#17634F)
  doc.rect(margin, margin, contentWidth, 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text('Personal Financial Statement', margin, margin + 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('PWS — Personal Wallet & Spending', margin, margin + 42);

  // Top right metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Account: ${userName}`, pageWidth - margin, margin + 28, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${currentDate}`, pageWidth - margin, margin + 42, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(1);
  doc.line(margin, margin + 54, pageWidth - margin, margin + 54);

  // --- 2. KPI / Summary Cards ---
  const cardY = margin + 66;
  const cardWidth = (contentWidth - 16) / 3;
  const cardHeight = 52;

  // Box 1: Total Expenses
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 4, 4, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL EXPENSES', margin + 10, cardY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(220, 38, 38); // Red (#DC2626)
  doc.text(formatPdfCurrency(totalExpense), margin + 10, cardY + 36);

  // Box 2: Total Budget
  const box2X = margin + cardWidth + 8;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(box2X, cardY, cardWidth, cardHeight, 4, 4, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('OVERALL BUDGET', box2X + 10, cardY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(overallBudget === null ? 'Not Set' : formatPdfCurrency(overallBudget), box2X + 10, cardY + 36);

  // Box 3: Available Balance
  const box3X = box2X + cardWidth + 8;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(box3X, cardY, cardWidth, cardHeight, 4, 4, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('AVAILABLE BALANCE', box3X + 10, cardY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  if (availableBalance === null) {
    doc.setTextColor(100, 116, 139);
    doc.text('—', box3X + 10, cardY + 36);
  } else {
    doc.setTextColor(availableBalance < 0 ? 220 : 5, availableBalance < 0 ? 38 : 150, availableBalance < 0 ? 38 : 105);
    doc.text(formatPdfCurrency(availableBalance), box3X + 10, cardY + 36);
  }

  // --- 3. Category Breakdown Table ---
  const categorySummary = {};
  transactions.forEach((tx) => {
    const catId = tx.categoryId || 'unknown';
    const amount = Number(tx.amount || 0);
    if (!categorySummary[catId]) {
      categorySummary[catId] = { count: 0, amount: 0 };
    }
    categorySummary[catId].count += 1;
    categorySummary[catId].amount += amount;
  });

  const categoryRows = Object.entries(categorySummary)
    .map(([catId, data]) => {
      const name = categoryMap[catId]?.name || 'Other';
      const percent = totalExpense > 0 ? ((data.amount / totalExpense) * 100).toFixed(1) + '%' : '0%';
      return [name, String(data.count), formatPdfCurrency(data.amount), percent];
    })
    .sort((a, b) => {
      const numA = Number(a[2].replace(/[^0-9.-]+/g, '')) || 0;
      const numB = Number(b[2].replace(/[^0-9.-]+/g, '')) || 0;
      return numB - numA;
    });

  let currentY = cardY + cardHeight + 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Category Breakdown', margin, currentY);

  autoTable(doc, {
    startY: currentY + 6,
    margin: { left: margin, right: margin },
    head: [['Category', 'Transactions', 'Amount', '% of Total']],
    body: categoryRows.length ? categoryRows : [['No categories', '0', 'PKR 0', '0%']],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 80 },
      2: { halign: 'right', cellWidth: 100 },
      3: { halign: 'right', cellWidth: 70 }
    }
  });

  // --- 4. Transaction Ledger Table ---
  const sortedTransactions = [...transactions].sort(
    (a, b) => (b.date || '').localeCompare(a.date || '')
  );

  const transactionRows = sortedTransactions.map((tx) => [
    formatDate(tx.date, dateFormat),
    tx.title || 'Expense',
    categoryMap[tx.categoryId]?.name || 'Other',
    paymentMap[tx.paymentMethodId]?.name || 'Cash',
    formatPdfCurrency(tx.amount)
  ]);

  const afterCategoryY = doc.lastAutoTable.finalY + 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Transaction Ledger', margin, afterCategoryY);

  autoTable(doc, {
    startY: afterCategoryY + 6,
    margin: { left: margin, right: margin, bottom: 40 },
    head: [['Date', 'Description', 'Category', 'Payment Method', 'Amount']],
    body: transactionRows.length ? transactionRows : [['—', 'No transactions recorded', '—', '—', 'PKR 0']],
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [51, 65, 85]
    },
    headStyles: {
      fillColor: [23, 99, 79],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 85 },
      3: { cellWidth: 85 },
      4: { halign: 'right', cellWidth: 85, fontStyle: 'bold' }
    },
    didDrawPage: (data) => {
      // --- 5. Footer on every page ---
      const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
      const totalPages = doc.internal.getNumberOfPages();

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(
        'PWS Personal Wallet & Spending • Confidential Statement',
        margin,
        pageHeight - 16
      );
      doc.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 16,
        { align: 'right' }
      );
    }
  });

  // Save the generated document
  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`pws-statement-${fileDate}.pdf`);
  return true;
}
