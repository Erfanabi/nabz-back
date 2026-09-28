import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SyncOpStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../../common/clock.service';
import { AppError } from '../../common/errors';
import { decodeCursor, encodeCursor } from './cursor';
import { SyncAction, SyncEntity, SyncOpDto } from './dto/sync.dto';
import { NORMALIZERS, PayloadError, normalizeDelete } from './payload';
import { EntitlementsService, UsageLimitKey } from '../billing/entitlements.service';

/** حداکثر تعداد ردیف در یک صفحهٔ snapshot/pull. */
const PAGE_SIZE = 1000;

/** نقشهٔ موجودیت → کلید سقف پلن. تراکنش سقف ندارد (ثبت نامحدود در همهٔ پلن‌ها). */
const LIMIT_KEY_BY_ENTITY: Partial<Record<SyncEntity, UsageLimitKey>> = {
  account: 'accounts.max',
  budget: 'budgets.max',
  goal: 'goals.max',
  recurring: 'recurring.max',
};

export interface OpResult {
  op_id: string;
  status: SyncOpStatus;
  code?: string;
  message?: string;
  server_version?: unknown;
}

type Delegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  upsert: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

/**
 * همگام‌سازی: snapshot یک‌بار، بعد دلتای دوطرفه.
 *
 * چهار قاعده‌ای که شکل این کلاس را تعیین کرده‌اند (API-SPEC §۶.۲):
 *  ۱. **idempotency روی `op_id`** — کلاینت با شبکهٔ نامطمئن همان دسته را چند بار می‌فرستد.
 *  ۲. **موفقیت جزئی** — یک op خراب کل دسته را رد نمی‌کند؛ HTTP همیشه ۲۰۰.
 *  ۳. **last-write-wins روی `client_updated_at`**، و `delete` همیشه برنده است.
 *  ۴. **ترتیب آرایه** — چون تراکنش به حساب وابسته است.
 *
 * هیچ عدد مشتقی (spent، summary، goal.status) نه ذخیره و نه ارسال می‌شود (BR-02).
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger('Sync');

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * اگر کاربر `localOnly` را روشن کرده، هیچ عملیات همگام‌سازی‌ای مجاز نیست.
   * «داده‌ام از گوشی بیرون نرود» یعنی سرور هم باید آن را محترم بدارد (§۶.۴).
   */
  private async assertSyncAllowed(userId: string): Promise<void> {
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    if (settings?.localOnly) {
      throw new AppError('forbidden', {
        message: 'همگام‌سازی با سرور در تنظیمات تو خاموش است.',
        messageEn: 'Sync is disabled by the localOnly setting.',
      });
    }
  }

  private async currentCursor(userId: string): Promise<string> {
    const last = await this.prisma.changeLog.findFirst({
      where: { userId },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });
    return encodeCursor(last?.seq ?? 0n);
  }

  // ───────────────────────────── snapshot و pull ─────────────────────────────

  /**
   * کل داده (یا دلتا از یک نشانگر).
   *
   * snapshot و pull یک شکل دارند: pull فقط `sinceSeq` غیرصفر می‌گیرد. این باعث
   * می‌شود کلاینت یک مسیر رمزگشایی داشته باشد و شکل پاسخ هیچ‌وقت از هم جدا نیفتد.
   */
  async readState(
    userId: string,
    sinceSeq: bigint,
    cursorParam?: string,
  ): Promise<Record<string, unknown>> {
    await this.assertSyncAllowed(userId);

    const pageAfter = decodeCursor(cursorParam);
    if (pageAfter === null) throw new AppError('cursor_expired');
    const from = sinceSeq > pageAfter ? sinceSeq : pageAfter;

    const where = { userId, seq: { gt: from } };
    const page = { where, orderBy: { seq: 'asc' as const }, take: PAGE_SIZE };

    const [accounts, categories, transactions, budgets, goals, recurrings, alertReads] =
      await Promise.all([
        this.prisma.account.findMany(page),
        this.prisma.category.findMany(page),
        this.prisma.transaction.findMany(page),
        this.prisma.budget.findMany(page),
        this.prisma.goal.findMany(page),
        this.prisma.recurring.findMany(page),
        this.prisma.alertRead.findMany({ ...page, where: { ...where, deletedAt: null } }),
      ]);

    const groups = [accounts, categories, transactions, budgets, goals, recurrings, alertReads];
    const hasMore = groups.some((g) => g.length === PAGE_SIZE);
    const maxSeq = groups
      .flat()
      .reduce<bigint>((acc, row) => ((row as { seq: bigint }).seq > acc ? (row as { seq: bigint }).seq : acc), from);

    return {
      sync_cursor: hasMore ? encodeCursor(maxSeq) : await this.currentCursor(userId),
      has_more: hasMore,
      accounts: accounts.map((a) => this.viewAccount(a)),
      categories: categories.map((c) => this.viewCategory(c)),
      transactions: transactions.map((t) => this.viewTransaction(t)),
      budgets: budgets.map((b) => this.viewBudget(b)),
      goals: goals.map((g) => this.viewGoal(g)),
      recurrings: recurrings.map((r) => this.viewRecurring(r)),
      alerts_read: alertReads.map((a) => (a as { alertId: string }).alertId),
    };
  }

  private viewAccount(a: any) {
    return {
      id: a.id,
      name: a.name,
      icon: a.icon,
      balance: a.balance,
      // حساب نقد کارت ندارد؛ دادن شمارهٔ کارت به پول نقد اطلاعات غلط است.
      card: a.cardLast4
        ? {
            bin: a.cardBin,
            last4: a.cardLast4,
            expiry: a.cardExpiry,
            bank: a.cardBank,
            tone: a.cardTone,
          }
        : null,
      updated_at: Number(a.clientUpdatedAt),
      deleted_at: a.deletedAt?.getTime() ?? null,
    };
  }

  private viewCategory(c: any) {
    return {
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      custom: c.custom,
      order: c.order,
      updated_at: Number(c.clientUpdatedAt),
      deleted_at: c.deletedAt?.getTime() ?? null,
    };
  }

  /** انتقال `category`/`account` ندارد و درآمد/هزینه `from`/`to` ندارد (BR-01). */
  private viewTransaction(t: any) {
    const base = {
      id: t.id,
      type: t.type,
      amount: t.amount,
      name: t.name,
      note: t.note,
      occurred_at: t.occurredAt.toISOString(),
      updated_at: Number(t.clientUpdatedAt),
      deleted_at: t.deletedAt?.getTime() ?? null,
    };
    if (t.type === 'transfer') {
      return { ...base, from: t.fromId, to: t.toId };
    }
    return { ...base, category: t.categoryId, account: t.accountId };
  }

  /** `spent` فرستاده نمی‌شود — مشتق است و کلاینت خودش می‌سازد (BR-02). */
  private viewBudget(b: any) {
    return {
      id: b.id,
      category: b.categoryId,
      limit: b.limit,
      updated_at: Number(b.clientUpdatedAt),
      deleted_at: b.deletedAt?.getTime() ?? null,
    };
  }

  /** `monthlyNeed` و `status` فرستاده نمی‌شوند — مشتق‌اند (BR-02). */
  private viewGoal(g: any) {
    return {
      id: g.id,
      name: g.name,
      target: g.target,
      current: g.current,
      months: g.months,
      deadline: g.deadline?.toISOString() ?? null,
      updated_at: Number(g.clientUpdatedAt),
      deleted_at: g.deletedAt?.getTime() ?? null,
    };
  }

  private viewRecurring(r: any) {
    return {
      id: r.id,
      type: r.type,
      amount: r.amount,
      name: r.name,
      category: r.categoryId,
      account: r.accountId,
      day_of_month: r.dayOfMonth,
      every_months: r.everyMonths,
      next_due_at: r.nextDueAt?.toISOString() ?? null,
      active: r.active,
      updated_at: Number(r.clientUpdatedAt),
      deleted_at: r.deletedAt?.getTime() ?? null,
    };
  }

  async snapshot(userId: string, cursor?: string): Promise<Record<string, unknown>> {
    return this.readState(userId, 0n, cursor);
  }

  /** دلتا. نشانگر نامعتبر → `cursor_expired` (۴۱۰) و کلاینت snapshot تازه می‌گیرد. */
  async pull(userId: string, cursor: string | undefined): Promise<Record<string, unknown>> {
    const since = decodeCursor(cursor);
    if (since === null) throw new AppError('cursor_expired');
    return this.readState(userId, since);
  }

  // ───────────────────────────── push ─────────────────────────────

  /**
   * اعمال دستهٔ تغییرات محلی.
   *
   * opها **به ترتیب آرایه** اجرا می‌شوند و هر کدام نتیجهٔ مستقل خودش را دارد.
   * هیچ op خرابی باعث ۴xx شدن کل درخواست نمی‌شود، چون کلاینت این پاسخ را در
   * پس‌زمینه می‌گیرد و هیچ خطایی نباید به کاربر برسد.
   */
  async push(
    userId: string,
    ops: SyncOpDto[],
  ): Promise<{ sync_cursor: string; results: OpResult[] }> {
    await this.assertSyncAllowed(userId);

    const results: OpResult[] = [];
    for (const op of ops) {
      results.push(await this.applyOne(userId, op));
    }

    return { sync_cursor: await this.currentCursor(userId), results };
  }

  private async applyOne(userId: string, op: SyncOpDto): Promise<OpResult> {
    // ۱. idempotency: همین op قبلاً دیده شده؟
    const seen = await this.prisma.syncOp.findUnique({
      where: { userId_opId: { userId, opId: op.op_id } },
    });
    if (seen) {
      return { op_id: op.op_id, status: 'duplicate' };
    }

    try {
      const result = await this.executeOp(userId, op);
      await this.recordOp(userId, op, result);
      return result;
    } catch (err) {
      if (err instanceof PayloadError) {
        const result: OpResult = {
          op_id: op.op_id,
          status: 'rejected',
          code: 'validation_failed',
          message: err.persian,
        };
        await this.recordOp(userId, op, result);
        return result;
      }
      if (err instanceof AppError) {
        const body = err.getResponse() as { code: string; message: string };
        const result: OpResult = {
          op_id: op.op_id,
          status: 'rejected',
          code: body.code,
          message: body.message,
        };
        await this.recordOp(userId, op, result);
        return result;
      }
      // خطای ناشناخته ثبت نمی‌شود تا کلاینت بتواند دوباره تلاش کند.
      this.logger.error(`اجرای عمل ${op.entity}/${op.action} ناموفق بود`, err as Error);
      return {
        op_id: op.op_id,
        status: 'rejected',
        code: 'server_error',
        message: 'ثبت این مورد روی سرور ناموفق بود. دوباره تلاش می‌شود.',
      };
    }
  }

  private async recordOp(userId: string, op: SyncOpDto, result: OpResult): Promise<void> {
    try {
      await this.prisma.syncOp.create({
        data: {
          userId,
          opId: op.op_id,
          entity: op.entity,
          action: op.action,
          status: result.status,
          result: result as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      // ارسال همزمان همان دسته — ردیف قبلاً ثبت شده.
    }
  }

  private delegateFor(entity: SyncEntity): Delegate {
    const map: Record<SyncEntity, unknown> = {
      transaction: this.prisma.transaction,
      account: this.prisma.account,
      category: this.prisma.category,
      budget: this.prisma.budget,
      goal: this.prisma.goal,
      recurring: this.prisma.recurring,
    };
    return map[entity] as Delegate;
  }

  private async executeOp(userId: string, op: SyncOpDto): Promise<OpResult> {
    if (op.action === 'delete') return this.executeDelete(userId, op);
    return this.executeWrite(userId, op);
  }

  /**
   * حذف نرم.
   *
   * **حذف همیشه برنده است** — بی‌توجه به `client_updated_at`. اگر یک دستگاه حذف
   * کرده و دستگاه دیگری بعداً ویرایش فرستاده، حذف باید بماند: برگرداندن چیزی که
   * کاربر عمداً حذف کرده بدترین شکل از دست رفتن اعتماد است.
   */
  private async executeDelete(userId: string, op: SyncOpDto): Promise<OpResult> {
    const { id } = normalizeDelete(op.payload);
    const delegate = this.delegateFor(op.entity);
    const now = this.clock.now();

    const existing = (await delegate.findUnique({
      where: { userId_id: { userId, id } },
    })) as { deletedAt: Date | null } | null;

    // حذف چیزی که هیچ‌وقت نرسیده: tombstone ساخته نمی‌شود، اما عمل موفق است تا
    // کلاینت آن را از صف بیرون بیندازد.
    if (!existing) return { op_id: op.op_id, status: 'applied' };
    if (existing.deletedAt !== null) return { op_id: op.op_id, status: 'applied' };

    const seq = await this.nextSeq(userId, op.entity, id, 'delete');
    await delegate.update({
      where: { userId_id: { userId, id } },
      data: { deletedAt: now, clientUpdatedAt: BigInt(op.client_updated_at), seq },
    });

    return { op_id: op.op_id, status: 'applied' };
  }

  private async executeWrite(userId: string, op: SyncOpDto): Promise<OpResult> {
    const normalize = NORMALIZERS[op.entity];
    const data = normalize(op.payload) as Record<string, unknown> & { id: string };
    const delegate = this.delegateFor(op.entity);

    const existing = (await delegate.findUnique({
      where: { userId_id: { userId, id: data.id } },
    })) as { clientUpdatedAt: bigint; deletedAt: Date | null } | null;

    if (existing) {
      // حذف برنده است: ویرایشِ یک رکورد حذف‌شده آن را زنده نمی‌کند.
      if (existing.deletedAt !== null) {
        return { op_id: op.op_id, status: 'applied' };
      }
      // last-write-wins: نسخهٔ تازه‌ترِ سرور با نوشتن کهنه‌تر عوض نمی‌شود.
      if (existing.clientUpdatedAt > BigInt(op.client_updated_at)) {
        return {
          op_id: op.op_id,
          status: 'conflict',
          server_version: await this.serverVersion(userId, op.entity, data.id),
        };
      }
    } else {
      // سقف پلن فقط روی **ساخت** مورد تازه اعمال می‌شود، نه روی ویرایش: کاربری
      // که پلنش تمام شده باید بتواند دادهٔ موجودش را ویرایش و حذف کند.
      const rejection = await this.checkPlanLimit(userId, op.entity);
      if (rejection) {
        return {
          op_id: op.op_id,
          status: 'rejected',
          code: 'plan_limit_reached',
          message: rejection,
        };
      }
      await this.assertReferencesExist(userId, op.entity, data);
    }

    const seq = await this.nextSeq(userId, op.entity, data.id, op.action);
    const { id, ...rest } = data;
    const row = {
      ...rest,
      clientUpdatedAt: BigInt(op.client_updated_at),
      seq,
      deletedAt: null,
    };

    await delegate.upsert({
      where: { userId_id: { userId, id } },
      create: { id, userId, ...row },
      update: row,
    });

    return { op_id: op.op_id, status: 'applied' };
  }

  /**
   * ارجاع‌های موجودیت باید وجود داشته باشند.
   *
   * بدون این، یک تراکنش با دستهٔ ناموجود ثبت می‌شد و کلاینت هنگام محاسبهٔ گزارش
   * به دستهٔ گم‌شده برمی‌خورد. عمداً فقط در **ساخت** بررسی می‌شود، چون opها به
   * ترتیب آرایه اجرا می‌شوند و کلاینت حساب را پیش از تراکنش می‌فرستد.
   */
  private async assertReferencesExist(
    userId: string,
    entity: SyncEntity,
    data: Record<string, unknown>,
  ): Promise<void> {
    const accountIds = [data.accountId, data.fromId, data.toId].filter(
      (v): v is string => typeof v === 'string',
    );
    for (const accountId of accountIds) {
      const account = await this.prisma.account.findUnique({
        where: { userId_id: { userId, id: accountId } },
      });
      if (!account || account.deletedAt !== null) {
        throw new AppError('validation_failed', { message: 'حساب انتخاب‌شده وجود ندارد.' });
      }
    }
    if (typeof data.categoryId === 'string') {
      const category = await this.prisma.category.findUnique({
        where: { userId_id: { userId, id: data.categoryId } },
      });
      if (!category || category.deletedAt !== null) {
        throw new AppError('validation_failed', { message: 'دستهٔ انتخاب‌شده وجود ندارد.' });
      }
    }
    if (entity === 'budget') {
      const existing = await this.prisma.budget.findFirst({
        where: { userId, categoryId: data.categoryId as string, deletedAt: null },
      });
      if (existing) {
        throw new AppError('validation_failed', {
          message: 'برای این دسته از قبل بودجه تعریف شده.',
        });
      }
    }
  }

  private async checkPlanLimit(userId: string, entity: SyncEntity): Promise<string | null> {
    const limitKey = LIMIT_KEY_BY_ENTITY[entity];
    if (!limitKey) return null;
    return this.entitlements.limitRejection(userId, limitKey);
  }

  /** نسخهٔ سرور برای آشتی دادن در حالت تعارض. */
  private async serverVersion(
    userId: string,
    entity: SyncEntity,
    id: string,
  ): Promise<unknown> {
    const delegate = this.delegateFor(entity);
    const row = await delegate.findUnique({ where: { userId_id: { userId, id } } });
    if (!row) return null;
    switch (entity) {
      case 'transaction':
        return this.viewTransaction(row);
      case 'account':
        return this.viewAccount(row);
      case 'category':
        return this.viewCategory(row);
      case 'budget':
        return this.viewBudget(row);
      case 'goal':
        return this.viewGoal(row);
      case 'recurring':
        return this.viewRecurring(row);
    }
  }

  /** یک ردیف در جریان تغییرات می‌سازد و `seq` آن را برمی‌گرداند. */
  private async nextSeq(
    userId: string,
    entity: string,
    entityId: string,
    action: SyncAction | string,
  ): Promise<bigint> {
    const change = await this.prisma.changeLog.create({
      data: { userId, entity, entityId, action },
      select: { seq: true },
    });
    return change.seq;
  }

  // ───────────────────────────── هشدارها ─────────────────────────────

  /** همگام کردن پرچم «خوانده شد». در صف کلاینت می‌نشیند، پس idempotent است. */
  async markAlertsRead(userId: string, ids: string[]): Promise<{ marked: number }> {
    const unique = [...new Set(ids)].filter((id) => typeof id === 'string' && id.length <= 200);
    let marked = 0;
    for (const alertId of unique) {
      const existing = await this.prisma.alertRead.findUnique({
        where: { userId_alertId: { userId, alertId } },
      });
      if (existing) continue;
      const seq = await this.nextSeq(userId, 'alert_read', alertId, 'create');
      await this.prisma.alertRead.create({ data: { userId, alertId, seq } });
      marked += 1;
    }
    return { marked };
  }

  /**
   * پاک کردن کل دادهٔ مالی کاربر از سرور.
   *
   * وقتی کاربر `localOnly` را روشن می‌کند صدا زده می‌شود: «داده‌ام از گوشی بیرون
   * نرود» با «داده‌ای که قبلاً رفته همان‌جا بماند» جمع نمی‌شود (§۶.۴).
   */
  async wipeServerData(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.transaction.deleteMany({ where: { userId } }),
      this.prisma.budget.deleteMany({ where: { userId } }),
      this.prisma.recurring.deleteMany({ where: { userId } }),
      this.prisma.goal.deleteMany({ where: { userId } }),
      this.prisma.category.deleteMany({ where: { userId } }),
      this.prisma.account.deleteMany({ where: { userId } }),
      this.prisma.alertRead.deleteMany({ where: { userId } }),
      this.prisma.syncOp.deleteMany({ where: { userId } }),
      this.prisma.changeLog.deleteMany({ where: { userId } }),
    ]);
    this.logger.log('دادهٔ مالی یک کاربر به‌خاطر روشن شدن localOnly از سرور پاک شد.');
  }
}
