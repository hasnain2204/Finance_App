import { describe, it, expect, vi } from 'vitest';
import { exportFinancialReportPdf } from './pdfExport';

// Mock jsPDF save and constructor
vi.mock('jspdf', () => {
  const saveMock = vi.fn();
  const mockDoc = {
    internal: {
      pageSize: {
        getWidth: () => 595.28,
        getHeight: () => 841.89
      },
      getNumberOfPages: () => 1,
      getCurrentPageInfo: () => ({ pageNumber: 1 })
    },
    lastAutoTable: {
      finalY: 150
    },
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    rect: vi.fn(),
    roundedRect: vi.fn(),
    line: vi.fn(),
    text: vi.fn(),
    save: saveMock
  };

  return {
    jsPDF: function MockJsPdf() {
      return mockDoc;
    }
  };
});

vi.mock('jspdf-autotable', () => {
  return {
    default: vi.fn((doc, options) => {
      if (options?.didDrawPage) {
        options.didDrawPage({});
      }
    })
  };
});

describe('exportFinancialReportPdf', () => {
  it('generates and saves a financial report PDF without errors', () => {
    const transactions = [
      { id: 1, title: 'Groceries', amount: 3500, categoryId: 'cat-1', paymentMethodId: 'pm-1', date: '2026-11-10' }
    ];
    const budgets = [{ id: 'budget-all-overall', categoryId: 'overall', amount: 5000000 }];
    const categoryMap = { 'cat-1': { id: 'cat-1', name: 'Food' } };
    const paymentMap = { 'pm-1': { id: 'pm-1', name: 'Cash' } };
    const preferences = { name: 'Muhammad Hasnain', dateFormat: 'DD MMM YYYY' };

    const result = exportFinancialReportPdf({
      transactions,
      budgets,
      totalBudgetPaisa: 5000000,
      categoryMap,
      paymentMap,
      preferences
    });

    expect(result).toBe(true);
  });
});
