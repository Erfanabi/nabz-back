import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const DEFAULT_ALERTS = {
  budgetNear: true,
  budgetOver: true,
  spendingSpike: true,
  recurringDue: true,
  balanceDrop: true,
  goalBehind: true,
  savingRateDown: false,
};

const DEFAULT_HOME_SECTIONS = { goals: false, chart: false, insights: false };

/** کلیدهای مجاز بخش‌های صفحهٔ خانه — تا JSON با کلید ناشناس بی‌مرز رشد نکند. */
const HOME_SECTION_KEYS = Object.keys(DEFAULT_HOME_SECTIONS);

/**
 * ادغام نقشهٔ بولین با نادیده گرفتن مقدارهای `undefined`.
 *
 * ضروری است چون DTOها کلاس‌اند و با `target: ES2022` هر فیلد **اعلام‌شده** — حتی
 * آن که کلاینت نفرستاده — به‌صورت یک پراپرتی با مقدار `undefined` روی نمونه
 * می‌نشیند. spread ساده آن‌ها را روی مقدارهای قبلی می‌ریخت و ترجیح‌های
 * ذخیره‌شدهٔ کاربر را **بی‌صدا پاک می‌کرد**.
 */
function mergeFlags(
  current: Record<string, boolean>,
  patch: Record<string, unknown>,
  allowedKeys?: string[],
): Record<string, boolean> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value !== 'boolean') continue;
    if (allowedKeys && !allowedKeys.includes(key)) continue;
    merged[key] = value;
  }
  return merged;
}

/**
 * آینهٔ تنظیمات برای چنددستگاهی.
 *
 * کلاینت **بی‌قید و شرط محلی کار می‌کند**؛ این فقط همگام‌سازی است. پس هیچ خطایی
 * از این مسیر نباید جریان کار کاربر را بشکند.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
  ) {}

  async get(userId: string) {
    const row =
      (await this.prisma.userSettings.findUnique({ where: { userId } })) ??
      (await this.prisma.userSettings.create({ data: { userId } }));
    return this.view(row);
  }

  /**
   * ذخیرهٔ تنظیمات.
   *
   * روشن شدن `localOnly` یک اثر جانبی جدی دارد: دادهٔ مالی موجود کاربر از سرور
   * **پاک می‌شود** (§۶.۴). «داده‌ام از گوشی بیرون نرود» با نگه داشتن دادهٔ قبلی
   * جمع نمی‌شود.
   */
  async update(userId: string, patch: UpdateSettingsDto) {
    const before = await this.prisma.userSettings.findUnique({ where: { userId } });

    const data: Prisma.UserSettingsUncheckedUpdateInput = {};
    if (patch.calendar !== undefined) data.calendar = patch.calendar;
    if (patch.digits !== undefined) data.digits = patch.digits;
    if (patch.weekStart !== undefined) data.weekStart = patch.weekStart;
    if (patch.reportChart !== undefined) data.reportChart = patch.reportChart;
    if (patch.reportStory !== undefined) data.reportStory = patch.reportStory;
    if (patch.autoLock !== undefined) data.autoLock = patch.autoLock;
    if (patch.benchmarking !== undefined) data.benchmarking = patch.benchmarking;
    if (patch.localOnly !== undefined) data.localOnly = patch.localOnly;
    if (patch.quietHours !== undefined) data.quietHours = patch.quietHours;
    if (patch.quietFrom !== undefined) data.quietFrom = patch.quietFrom;
    if (patch.quietTo !== undefined) data.quietTo = patch.quietTo;
    if (patch.timezone !== undefined) data.timezone = patch.timezone;

    if (patch.homeSections !== undefined) {
      const current = (before?.homeSections as Record<string, boolean>) ?? DEFAULT_HOME_SECTIONS;
      data.homeSections = mergeFlags(current, patch.homeSections, HOME_SECTION_KEYS);
    }
    if (patch.alerts !== undefined) {
      const current = (before?.alerts as Record<string, boolean>) ?? DEFAULT_ALERTS;
      data.alerts = mergeFlags(current, patch.alerts as Record<string, unknown>);
    }

    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { ...(data as Prisma.UserSettingsUncheckedCreateInput), userId },
      update: data,
    });

    const turnedOnLocalOnly = patch.localOnly === true && before?.localOnly !== true;
    if (turnedOnLocalOnly) {
      await this.sync.wipeServerData(userId);
    }

    return this.view(row);
  }

  private view(row: {
    calendar: string;
    digits: string;
    weekStart: string;
    reportChart: string;
    reportStory: boolean;
    homeSections: unknown;
    autoLock: number;
    benchmarking: boolean;
    localOnly: boolean;
    alerts: unknown;
    quietHours: boolean;
    quietFrom: string;
    quietTo: string;
    timezone: string;
    updatedAt: Date;
  }) {
    return {
      calendar: row.calendar,
      digits: row.digits,
      weekStart: row.weekStart,
      reportChart: row.reportChart,
      reportStory: row.reportStory,
      homeSections: row.homeSections,
      autoLock: row.autoLock,
      benchmarking: row.benchmarking,
      localOnly: row.localOnly,
      alerts: row.alerts,
      quietHours: row.quietHours,
      quietFrom: row.quietFrom,
      quietTo: row.quietTo,
      timezone: row.timezone,
      updated_at: row.updatedAt.getTime(),
    };
  }
}
