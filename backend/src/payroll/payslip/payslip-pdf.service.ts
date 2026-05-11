import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PayrollItem } from '../entities/payroll-item.entity';
import { User } from '../../users/entities/user.entity';
import { CompanyProfile } from '../entities/company-profile.entity';

// Local aliases instead of the global PDFKit namespace (not always available).
type PDFDoc = InstanceType<typeof PDFDocument>;
type PDFDocOptions = ConstructorParameters<typeof PDFDocument>[0];

export interface PayslipRenderContext {
  item: PayrollItem;
  user: User;
  company: CompanyProfile;
  month: number;
  year: number;
  monthName: string; // e.g., "MARCH"
  working: {
    wd: number;
    cl: string;
    sl: string;
    lwp: string;
    pl: string;
    wfh: string;
    comp_off: string;
    present: string;
  };
  watermark?: string; // e.g., 'PREVIEW — NOT RELEASED'
  password?: string; // DOB in DDMM
}

/**
 * Renders a payroll_item into a PDF matching the sample_pay_slip format.
 * Zone layout per PAYROLL_PAYSLIP_FORMAT.md §1.
 * No thousand separators per D26.
 */
@Injectable()
export class PayslipPdfService {
  async render(ctx: PayslipRenderContext): Promise<Buffer> {
    const options: PDFDocOptions = {
      size: 'A4',
      margin: 36,
      info: {
        Title: `Payslip ${ctx.monthName} ${ctx.year} — ${ctx.user.emp_number ?? ctx.user.name}`,
        Author: ctx.company.company_name,
      },
    };
    if (ctx.password) {
      options.userPassword = ctx.password;
      options.ownerPassword = `${ctx.password}_admin`;
      options.permissions = {
        printing: 'highResolution',
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: true,
        documentAssembly: false,
      };
    }

    const doc = new PDFDocument(options);
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const end = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.drawZone1(doc, ctx);
    this.drawZone2(doc, ctx);
    this.drawZone3(doc, ctx);
    this.drawZone4(doc, ctx);

    if (ctx.watermark) {
      this.drawWatermark(doc, ctx.watermark);
    }

    doc.end();
    return end;
  }

  // ==========================================================================
  // Zone 1 — Company header
  // ==========================================================================
  private drawZone1(doc: PDFDoc, ctx: PayslipRenderContext): void {
    doc.font('Helvetica-Bold').fontSize(14)
      .text(ctx.company.company_name.toUpperCase(), { align: 'center' });

    const addr = [
      ctx.company.address_line_1,
      ctx.company.address_line_2,
      ctx.company.city,
      ctx.company.state,
      ctx.company.pincode,
    ].filter(Boolean).join(', ');
    if (addr) {
      doc.font('Helvetica').fontSize(9).text(addr, { align: 'center' });
    }
    doc.moveDown(0.5);
    this.hr(doc);
  }

  // ==========================================================================
  // Zone 2 — Employee meta (two-column KV grid)
  // ==========================================================================
  private drawZone2(doc: PDFDoc, ctx: PayslipRenderContext): void {
    doc.moveDown(0.3);
    const startY = doc.y;
    const colWidth = 250;
    const leftX = 40;
    const rightX = 310;

    const left: Array<[string, string]> = [
      ['EMP NUMBER', ctx.user.emp_number ?? '—'],
      ['EMP NAME', ctx.user.name],
      ['DESIGNATION', ctx.user.designation ?? '—'],
      ['CTC', this.fmt(ctx.item.ctc)],
    ];
    const right: Array<[string, string]> = [
      ['BANK NAME', ctx.user.bank_name ?? '—'],
      ['A/C NO', ctx.user.bank_account_no ?? '—'],
      ['DOJ', this.fmtDate(ctx.user.join_date)],
      ['MONTH', `${ctx.monthName}_${ctx.year}`],
    ];

    doc.font('Helvetica').fontSize(10);
    for (let i = 0; i < 4; i++) {
      const y = startY + i * 16;
      doc.font('Helvetica-Bold').text(`${left[i][0]} :`, leftX, y, { width: 100, continued: false });
      doc.font('Helvetica').text(left[i][1], leftX + 100, y, { width: colWidth - 100 });
      doc.font('Helvetica-Bold').text(`${right[i][0]} :`, rightX, y, { width: 100, continued: false });
      doc.font('Helvetica').text(right[i][1], rightX + 100, y, { width: colWidth - 100 });
    }
    doc.y = startY + 4 * 16 + 6;
    this.hr(doc);
  }

  // ==========================================================================
  // Zone 3 — Three columns: Working | Earnings | Deductions
  // ==========================================================================
  private drawZone3(doc: PDFDoc, ctx: PayslipRenderContext): void {
    doc.moveDown(0.3);
    const topY = doc.y;
    const colX = [40, 180, 400];
    const colW = [130, 210, 155];

    // Headers
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('WORKING DETAILS', colX[0], topY, { width: colW[0] });
    doc.text('EARNING DETAILS (A)', colX[1], topY, { width: colW[1] });
    doc.text('DEDUCTION DETAILS (B)', colX[2], topY, { width: colW[2] });

    // Sub-headers for earnings: Row | Actual | Payable
    doc.font('Helvetica').fontSize(9);
    const subY = topY + 14;
    doc.text('ROW', colX[1], subY, { width: 90 });
    doc.text('ACTUAL', colX[1] + 90, subY, { width: 60, align: 'right' });
    doc.text('PAYABLE', colX[1] + 150, subY, { width: 60, align: 'right' });

    const bodyY = subY + 14;

    // ---- Column 1: Working Details ----
    const working: Array<[string, string]> = [
      ['WD', String(ctx.working.wd)],
      ['CL', ctx.working.cl],
      ['SL', ctx.working.sl],
      ['LWP', ctx.working.lwp],
      ['PL', ctx.working.pl],
      ['WFH', ctx.working.wfh],
      ['Complimentary Off', ctx.working.comp_off],
    ];
    doc.font('Helvetica').fontSize(9);
    working.forEach(([k, v], i) => {
      const y = bodyY + i * 13;
      doc.text(k, colX[0], y, { width: 90 });
      doc.text(v, colX[0] + 90, y, { width: 40, align: 'right' });
    });
    doc.font('Helvetica-Bold');
    doc.text('PRESENT', colX[0], bodyY + working.length * 13 + 8, { width: 90 });
    doc.text(ctx.working.present, colX[0] + 90, bodyY + working.length * 13 + 8, {
      width: 40,
      align: 'right',
    });

    // ---- Column 2: Earnings ----
    doc.font('Helvetica').fontSize(9);
    const earnings: Array<[string, string, string]> = [
      ['BASIC', ctx.item.basic_actual, ctx.item.basic_payable],
      ['HRA', ctx.item.hra_actual, ctx.item.hra_payable],
      ['SP. ALLOWANCES', ctx.item.sp_allow_actual, ctx.item.sp_allow_payable],
      ['CONVEYANCE', ctx.item.conveyance_actual, ctx.item.conveyance_payable],
      ['LTC', ctx.item.ltc_actual, ctx.item.ltc_payable],
      ['RE. MEDICAL', ctx.item.re_medical_actual, ctx.item.re_medical_payable],
      ['EDU. ALLOWANCES', ctx.item.education_actual, ctx.item.education_payable],
      ['FIX VARIABLE', ctx.item.fix_variable, ctx.item.fix_variable],
      ['EXTRA WORKING HRS', ctx.item.ot_pay, ctx.item.ot_pay],
    ];
    earnings.forEach(([label, a, p], i) => {
      const y = bodyY + i * 13;
      doc.text(label, colX[1], y, { width: 90 });
      doc.text(this.fmt(a), colX[1] + 90, y, { width: 60, align: 'right' });
      doc.text(this.fmt(p), colX[1] + 150, y, { width: 60, align: 'right' });
    });
    const earnTotalY = bodyY + earnings.length * 13 + 8;
    doc.font('Helvetica-Bold');
    doc.text('TOTAL', colX[1], earnTotalY, { width: 90 });
    doc.text(this.fmt(ctx.item.total_earnings), colX[1] + 150, earnTotalY, {
      width: 60,
      align: 'right',
    });

    // ---- Column 3: Deductions ----
    doc.font('Helvetica').fontSize(9);
    const deductions: Array<[string, string]> = [
      ['PF', ctx.item.employee_pf],
      ['ESIC', ctx.item.esic_applied ? ctx.item.employee_esic : '0'],
      ['P.TAX', ctx.item.professional_tax],
      ['TDS', ctx.item.tds],
      ['SECURITY', ctx.item.security_return || '0'],
    ];
    if (Number(ctx.item.loan_emi) > 0) {
      deductions.push(['LOAN', ctx.item.loan_emi]);
    }
    if (Number(ctx.item.sal_deduction) > 0) {
      deductions.push(['SAL DEDUCTION', ctx.item.sal_deduction]);
    }
    deductions.forEach(([label, v], i) => {
      const y = bodyY + i * 13;
      doc.text(label, colX[2], y, { width: 90 });
      doc.text(this.fmt(v), colX[2] + 90, y, { width: 60, align: 'right' });
    });
    const dedTotalY = bodyY + deductions.length * 13 + 8;
    doc.font('Helvetica-Bold');
    doc.text('TOTAL', colX[2], dedTotalY, { width: 90 });
    doc.text(this.fmt(ctx.item.total_deductions), colX[2] + 90, dedTotalY, {
      width: 60,
      align: 'right',
    });

    // Move cursor below the three columns
    const bottomY = Math.max(
      bodyY + working.length * 13 + 30,
      bodyY + earnings.length * 13 + 30,
      bodyY + deductions.length * 13 + 30,
    );
    doc.y = bottomY;
    this.hr(doc);
  }

  // ==========================================================================
  // Zone 4 — Net payable + footer
  // ==========================================================================
  private drawZone4(doc: PDFDoc, ctx: PayslipRenderContext): void {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(
      `NET PAYABLE (A − B):  Rs. ${this.fmt(ctx.item.net_payable)}`,
      { align: 'right' },
    );
    doc.moveDown(0.5);
    this.hr(doc);
    doc.moveDown(0.8);
    doc.font('Helvetica-Oblique').fontSize(9);
    doc.text(ctx.company.payslip_footer_text, { align: 'center' });
  }

  private drawWatermark(doc: PDFDoc, text: string): void {
    doc.save();
    doc.fillColor('#d1d5db');
    doc.font('Helvetica-Bold').fontSize(48);
    doc.rotate(-30, { origin: [300, 400] });
    doc.text(text, 100, 400, { align: 'center' });
    doc.restore();
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================
  private fmt(v: string | number): string {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
  }

  private fmtDate(d: string | null): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}-${m}-${y}`;
  }

  private hr(doc: PDFDoc): void {
    const y = doc.y;
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.strokeColor('#000');
    doc.moveDown(0.3);
  }
}

export function passwordFromDob(
  dob: string | Date | null | undefined,
): string | null {
  if (!dob) return null;

  // PostgreSQL DATE columns can come back as either strings ("1990-05-15")
  // or Date instances depending on TypeORM type parsers. We MUST NOT route
  // a Date through .toISOString() because that converts to UTC, which on
  // any timezone east of UTC will roll back to the previous calendar day
  // for any dob stored at local midnight (the typical DATE-column case).
  // That gave employees the password for the day BEFORE their birthday
  // half the time. Instead, read the local-date components directly.
  if (typeof dob === 'string') {
    const [y, m, day] = dob.slice(0, 10).split('-');
    if (!y || !m || !day) return null;
    return `${day}${m}`;
  }

  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}${month}`;
}
