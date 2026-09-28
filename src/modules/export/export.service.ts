import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { AppError } from '../../common/errors';
import { StorageService } from '../files/storage.service';
import { EntitlementsService } from '../billing/entitlements.service';

const SECTION_LABELS: Record<string, string> = {
  transactions: 'تراکنش‌ها',
  budgets: 'بودجه‌ها',
  goals: 'اهداف',
  accounts: 'حساب‌ها',
};

const TYPE_LABELS: Record<string, string> = {
  expense: 'هزینه',
  income: 'درآمد',
  transfer: 'انتقال',
};

interface Sheet {
  name: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}

/**
 * خروجی داده.
 *
 * `csv` برای همهٔ پلن‌ها باز است و کلاینت هم می‌تواند آفلاین خودش بسازد، پس این
 * مسیر برای او اختیاری است. `xlsx` و `pdf` به قابلیت `export.pro_formats` گره
 * خورده‌اند (API-SPEC §۹.۱).
 *
 * BR-01 اینجا هم برقرار است: **انتقال در جمع‌ها شمرده نمی‌شود** و در برگهٔ جمع
 * جداگانه و بی‌رنگ می‌آید.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async create(
    userId: string,
    format: string,
    from: string | undefined,
    to: string | undefined,
    include: string[] | undefined,
  ): Promise<{ format: string; url: string; expires_in: number; sections: string[] }> {
    if (format !== 'csv') {
      await this.entitlements.requireFeature(userId, 'export.pro_formats');
    }
    if (format === 'pdf') {
      // کلید قابلیت باز است ولی تولیدکنندهٔ PDF فارسی/RTL هنوز ساخته نشده؛ پیام
      // صریح بهتر از فایل خرابِ بدون شکل حروف است.
      throw new AppError('feature_not_available', {
        message: 'خروجی PDF به‌زودی اضافه می‌شود. فعلاً اکسل یا CSV بگیر.',
        messageEn: 'PDF export is not available yet.',
      });
    }

    const sections = include?.length ? include : ['transactions'];
    const range = this.parseRange(from, to);
    const sheets: Sheet[] = [];

    for (const section of sections) {
      switch (section) {
        case 'transactions':
          sheets.push(await this.transactionsSheet(userId, range));
          break;
        case 'budgets':
          sheets.push(await this.budgetsSheet(userId));
          break;
        case 'goals':
          sheets.push(await this.goalsSheet(userId));
          break;
        case 'accounts':
          sheets.push(await this.accountsSheet(userId));
          break;
      }
    }

    const stamp = this.clock.iso().slice(0, 19).replace(/[:T]/g, '-');
    const file =
      format === 'csv'
        ? await this.buildCsv(sheets)
        : { buffer: await this.buildXlsx(sheets), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

    const stored = await this.storage.save(
      `exports/${userId}`,
      `nabz-${stamp}.${format}`,
      file.mime,
      file.buffer,
    );

    return {
      format,
      url: this.storage.signedUrl(stored.path),
      expires_in: 900,
      sections,
    };
  }

  private parseRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) {
      const start = new Date(`${from}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime())) {
        throw new AppError('validation_failed', { fields: { from: 'تاریخ شروع معتبر نیست.' } });
      }
      range.gte = start;
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999Z`);
      if (Number.isNaN(end.getTime())) {
        throw new AppError('validation_failed', { fields: { to: 'تاریخ پایان معتبر نیست.' } });
      }
      range.lte = end;
    }
    if (range.gte && range.lte && range.gte > range.lte) {
      throw new AppError('validation_failed', {
        fields: { to: 'تاریخ پایان باید بعد از تاریخ شروع باشد.' },
      });
    }
    return range;
  }

  private async transactionsSheet(
    userId: string,
    range: { gte?: Date; lte?: Date },
  ): Promise<Sheet> {
    const [transactions, categories, accounts] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          ...(range.gte || range.lte ? { occurredAt: range } : {}),
        },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.category.findMany({ where: { userId } }),
      this.prisma.account.findMany({ where: { userId } }),
    ]);

    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const accountName = new Map(accounts.map((a) => [a.id, a.name]));

    return {
      name: SECTION_LABELS.transactions,
      headers: ['تاریخ', 'نوع', 'نام', 'مبلغ (تومان)', 'دسته', 'حساب', 'از', 'به', 'توضیح'],
      rows: transactions.map((t) => [
        t.occurredAt.toISOString(),
        TYPE_LABELS[t.type] ?? t.type,
        t.name,
        t.amount,
        t.categoryId ? (categoryName.get(t.categoryId) ?? '') : '',
        t.accountId ? (accountName.get(t.accountId) ?? '') : '',
        t.fromId ? (accountName.get(t.fromId) ?? '') : '',
        t.toId ? (accountName.get(t.toId) ?? '') : '',
        t.note ?? '',
      ]),
    };
  }

  /**
   * بودجه‌ها با `spent` **محاسبه‌شده در لحظه**، نه خوانده‌شده از ستون.
   * هر عدد باید تا خود تراکنش دنبال‌شدنی باشد (BR-02 / P6).
   */
  private async budgetsSheet(userId: string): Promise<Sheet> {
    const [budgets, categories] = await Promise.all([
      this.prisma.budget.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.category.findMany({ where: { userId } }),
    ]);
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    const monthStart = new Date(this.clock.now());
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const rows: Array<Array<string | number | null>> = [];
    for (const budget of budgets) {
      // فقط هزینه شمرده می‌شود: انتقال در هیچ جمعی نمی‌آید (BR-01).
      const spent = await this.prisma.transaction.aggregate({
        where: {
          userId,
          deletedAt: null,
          type: 'expense',
          categoryId: budget.categoryId,
          occurredAt: { gte: monthStart },
        },
        _sum: { amount: true },
      });
      rows.push([
        categoryName.get(budget.categoryId) ?? '',
        budget.limit,
        spent._sum.amount ?? 0,
        budget.limit - (spent._sum.amount ?? 0),
      ]);
    }

    return {
      name: SECTION_LABELS.budgets,
      headers: ['دسته', 'سقف (تومان)', 'خرج‌شده تا امروز (تومان)', 'باقی‌مانده (تومان)'],
      rows,
    };
  }

  private async goalsSheet(userId: string): Promise<Sheet> {
    const goals = await this.prisma.goal.findMany({ where: { userId, deletedAt: null } });
    return {
      name: SECTION_LABELS.goals,
      headers: ['نام', 'مبلغ هدف (تومان)', 'پس‌انداز شده (تومان)', 'تعداد ماه', 'مهلت'],
      rows: goals.map((g) => [
        g.name,
        g.target,
        g.current,
        g.months ?? '',
        g.deadline?.toISOString().slice(0, 10) ?? '',
      ]),
    };
  }

  /** حساب‌ها — فقط چهار رقم آخر کارت، هرگز شمارهٔ کامل. */
  private async accountsSheet(userId: string): Promise<Sheet> {
    const accounts = await this.prisma.account.findMany({ where: { userId, deletedAt: null } });
    return {
      name: SECTION_LABELS.accounts,
      headers: ['نام', 'موجودی (تومان)', 'بانک', 'چهار رقم آخر کارت'],
      rows: accounts.map((a) => [
        a.name,
        a.balance,
        a.cardBank ?? '',
        a.cardLast4 ? `****${a.cardLast4}` : '',
      ]),
    };
  }

  /**
   * CSV با BOM.
   *
   * بدون BOM، اکسل فارسی فایل را با کدگذاری محلی باز می‌کند و همهٔ متن فارسی
   * جویده می‌شود — برای کاربر یعنی «خروجی خراب است».
   */
  private async buildCsv(sheets: Sheet[]): Promise<{ buffer: Buffer; mime: string }> {
    const lines: string[] = [];
    for (const [index, sheet] of sheets.entries()) {
      if (index > 0) lines.push('');
      if (sheets.length > 1) lines.push(this.csvRow([`# ${sheet.name}`]));
      lines.push(this.csvRow(sheet.headers));
      for (const row of sheet.rows) lines.push(this.csvRow(row));
    }
    const content = `﻿${lines.join('\r\n')}\r\n`;
    return { buffer: Buffer.from(content, 'utf8'), mime: 'text/csv; charset=utf-8' };
  }

  private csvRow(values: Array<string | number | null>): string {
    return values
      .map((value) => {
        if (value === null || value === undefined) return '';
        const text = String(value);
        // `=`، `+`، `-` و `@` در ابتدای سلول در اکسل به فرمول تبدیل می‌شوند
        // (CSV injection) — پس با یک آپستروف بی‌اثر می‌شوند.
        const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
        return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
      })
      .join(',');
  }

  private async buildXlsx(sheets: Sheet[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'نبض';
    workbook.created = this.clock.now();

    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.name, {
        views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
      });
      worksheet.addRow(sheet.headers);
      worksheet.getRow(1).font = { bold: true };
      for (const row of sheet.rows) worksheet.addRow(row);
      worksheet.columns.forEach((column) => {
        column.width = 20;
        column.alignment = { horizontal: 'right' };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
