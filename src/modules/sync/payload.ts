import { SyncEntity } from './dto/sync.dto';

/**
 * اعتبارسنجی و نرمال‌سازی محتوای هر عمل همگام‌سازی — توابع خالص و تست‌پذیر.
 *
 * چون محتوا چندشکلی است (تراکنش با انتقال یکی نیست)، اعتبارسنجی اینجا دستی
 * انجام می‌شود تا هر خطا **پیام فارسی مشخص خودش** را داشته باشد. خطاها به کاربر
 * نشان داده می‌شوند، پس «field required» قابل قبول نیست.
 */

export class PayloadError extends Error {
  constructor(readonly persian: string) {
    super(persian);
  }
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function fail(message: string): never {
  throw new PayloadError(message);
}

function requireId(payload: Record<string, unknown>): string {
  const id = payload.id;
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    fail('شناسهٔ این مورد معتبر نیست.');
  }
  return id.toLowerCase();
}

function optionalId(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !UUID_RE.test(value)) fail(`${label} معتبر نیست.`);
  return value.toLowerCase();
}

/**
 * مبلغ: تومان و **عدد صحیح**. اعشار و رشته رد می‌شوند تا خطای گردکردن ممیز شناور
 * هیچ‌وقت وارد دادهٔ مالی نشود (TECH_STACK §۳).
 */
function requireAmount(value: unknown, label = 'مبلغ'): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`${label} باید عدد صحیح به تومان باشد.`);
  }
  if (value < 0) fail(`${label} نمی‌تواند منفی باشد.`);
  if (value > Number.MAX_SAFE_INTEGER) fail(`${label} بیش از حد بزرگ است.`);
  return value;
}

function requireText(value: unknown, label: string, maxLength = 200): string {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} لازم است.`);
  if (value.length > maxLength) fail(`${label} بیش از حد بلند است.`);
  return value.trim();
}

function optionalText(value: unknown, label: string, maxLength = 500): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') fail(`${label} باید متن باشد.`);
  if (value.length > maxLength) fail(`${label} بیش از حد بلند است.`);
  return value;
}

function optionalInt(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`${label} باید عدد صحیح باشد.`);
  }
  return value;
}

/** تاریخ فقط ISO 8601 یا epoch ms. **هیچ تاریخ جلالیِ رشته‌ای پذیرفته نمی‌شود.** */
function requireDate(value: unknown, label: string): Date {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fromEpoch = new Date(value);
    if (Number.isNaN(fromEpoch.getTime())) fail(`${label} معتبر نیست.`);
    return fromEpoch;
  }
  if (typeof value === 'string') {
    // قالب جلالی (سال ۱۳xx یا ۱۴xx) صریحاً رد می‌شود تا سهواً به میلادی تفسیر نشود.
    if (/^1[34]\d{2}[-/]/.test(value)) {
      fail(`${label} باید میلادی و به قالب ISO 8601 باشد.`);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  fail(`${label} باید به قالب ISO 8601 باشد.`);
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  return requireDate(value, label);
}

/** فقط چهار رقم آخر کارت ذخیره می‌شود؛ هر ورودی بلندتر رد می‌شود (NFR-10). */
function normalizeCard(raw: unknown): {
  cardBin: string | null;
  cardLast4: string | null;
  cardExpiry: string | null;
  cardBank: string | null;
  cardTone: string | null;
} {
  const empty = {
    cardBin: null,
    cardLast4: null,
    cardExpiry: null,
    cardBank: null,
    cardTone: null,
  };
  if (raw === undefined || raw === null) return empty;
  if (typeof raw !== 'object') fail('اطلاعات کارت معتبر نیست.');

  const card = raw as Record<string, unknown>;

  const last4 = card.last4;
  if (last4 !== undefined && last4 !== null) {
    if (typeof last4 !== 'string' || !/^\d{4}$/.test(last4)) {
      fail('چهار رقم آخر کارت معتبر نیست.');
    }
  }
  const bin = card.bin;
  if (bin !== undefined && bin !== null) {
    if (typeof bin !== 'string' || !/^\d{6}$/.test(bin)) {
      fail('شش رقم اول کارت معتبر نیست.');
    }
  }
  const expiry = card.expiry;
  if (expiry !== undefined && expiry !== null) {
    if (typeof expiry !== 'string' || !/^\d{2}\/\d{2}$/.test(expiry)) {
      fail('تاریخ انقضای کارت باید به قالب MM/YY باشد.');
    }
  }

  return {
    cardBin: (bin as string | undefined) ?? null,
    cardLast4: (last4 as string | undefined) ?? null,
    cardExpiry: (expiry as string | undefined) ?? null,
    cardBank: optionalText(card.bank, 'نام بانک', 60),
    cardTone: optionalText(card.tone, 'رنگ کارت', 30),
  };
}

export interface NormalizedTransaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  name: string;
  note: string | null;
  categoryId: string | null;
  accountId: string | null;
  fromId: string | null;
  toId: string | null;
  occurredAt: Date;
}

/**
 * تراکنش.
 *
 * **BR-01 در همین‌جا اجبار می‌شود**: انتقال `category`/`account` ندارد و
 * درآمد/هزینه `from`/`to` ندارد. اگر کلاینت هر دو را بفرستد، عمل رد می‌شود —
 * نه اینکه فیلد اضافی بی‌صدا نادیده گرفته شود، چون آن‌وقت دو منبع حقیقت می‌شود.
 */
export function normalizeTransaction(payload: Record<string, unknown>): NormalizedTransaction {
  const id = requireId(payload);
  const type = payload.type;
  if (type !== 'expense' && type !== 'income' && type !== 'transfer') {
    fail('نوع تراکنش باید هزینه، درآمد یا انتقال باشد.');
  }

  const amount = requireAmount(payload.amount);
  const name = requireText(payload.name, 'نام تراکنش');
  const note = optionalText(payload.note, 'توضیح');
  const occurredAt = requireDate(payload.occurred_at ?? payload.occurredAt, 'تاریخ تراکنش');

  if (type === 'transfer') {
    if (payload.category !== undefined && payload.category !== null) {
      fail('انتقال بین حساب‌ها دسته ندارد.');
    }
    if (payload.account !== undefined && payload.account !== null) {
      fail('انتقال بین حساب‌ها حساب واحد ندارد؛ باید مبدأ و مقصد داشته باشد.');
    }
    const fromId = optionalId(payload.from, 'حساب مبدأ');
    const toId = optionalId(payload.to, 'حساب مقصد');
    if (!fromId) fail('حساب مبدأ لازم است.');
    if (!toId) fail('حساب مقصد لازم است.');
    if (fromId === toId) fail('مبدأ و مقصد انتقال نمی‌تواند یکی باشد.');
    return {
      id,
      type,
      amount,
      name,
      note,
      categoryId: null,
      accountId: null,
      fromId,
      toId,
      occurredAt,
    };
  }

  if (payload.from !== undefined && payload.from !== null) {
    fail('هزینه و درآمد حساب مبدأ و مقصد ندارند.');
  }
  if (payload.to !== undefined && payload.to !== null) {
    fail('هزینه و درآمد حساب مبدأ و مقصد ندارند.');
  }
  const categoryId = optionalId(payload.category, 'دسته');
  const accountId = optionalId(payload.account, 'حساب');
  if (!categoryId) fail('دسته لازم است.');
  if (!accountId) fail('حساب لازم است.');

  return {
    id,
    type,
    amount,
    name,
    note,
    categoryId,
    accountId,
    fromId: null,
    toId: null,
    occurredAt,
  };
}

export function normalizeAccount(payload: Record<string, unknown>) {
  return {
    id: requireId(payload),
    name: requireText(payload.name, 'نام حساب', 80),
    icon: optionalText(payload.icon, 'آیکن', 40),
    balance: requireAmount(payload.balance ?? 0, 'موجودی'),
    ...normalizeCard(payload.card),
  };
}

export function normalizeCategory(payload: Record<string, unknown>) {
  return {
    id: requireId(payload),
    name: requireText(payload.name, 'نام دسته', 60),
    icon: optionalText(payload.icon, 'آیکن', 40),
    color: optionalText(payload.color, 'رنگ', 30),
    custom: payload.custom === true,
    order: optionalInt(payload.order, 'ترتیب') ?? 0,
  };
}

export function normalizeBudget(payload: Record<string, unknown>) {
  const categoryId = optionalId(payload.category, 'دسته');
  if (!categoryId) fail('دستهٔ بودجه لازم است.');
  return {
    id: requireId(payload),
    categoryId,
    limit: requireAmount(payload.limit, 'سقف بودجه'),
  };
}

export function normalizeGoal(payload: Record<string, unknown>) {
  const target = requireAmount(payload.target, 'مبلغ هدف');
  if (target === 0) fail('مبلغ هدف باید بیشتر از صفر باشد.');
  return {
    id: requireId(payload),
    name: requireText(payload.name, 'نام هدف', 80),
    target,
    current: requireAmount(payload.current ?? 0, 'مبلغ پس‌انداز شده'),
    months: optionalInt(payload.months, 'تعداد ماه'),
    deadline: optionalDate(payload.deadline, 'مهلت هدف'),
  };
}

export function normalizeRecurring(payload: Record<string, unknown>) {
  const type = payload.type;
  if (type !== 'expense' && type !== 'income') {
    fail('تراکنش تکرارشونده باید هزینه یا درآمد باشد.');
  }
  return {
    id: requireId(payload),
    type,
    amount: requireAmount(payload.amount),
    name: requireText(payload.name, 'نام تراکنش تکرارشونده'),
    categoryId: optionalId(payload.category, 'دسته'),
    accountId: optionalId(payload.account, 'حساب'),
    dayOfMonth: optionalInt(payload.day_of_month ?? payload.dayOfMonth, 'روز ماه'),
    everyMonths: optionalInt(payload.every_months ?? payload.everyMonths, 'هر چند ماه'),
    nextDueAt: optionalDate(payload.next_due_at ?? payload.nextDueAt, 'تاریخ سررسید بعدی'),
    active: payload.active !== false,
  };
}

/** برای عمل `delete` فقط شناسه لازم است. */
export function normalizeDelete(payload: Record<string, unknown>): { id: string } {
  return { id: requireId(payload) };
}

export const NORMALIZERS: Record<SyncEntity, (p: Record<string, unknown>) => { id: string }> = {
  transaction: normalizeTransaction,
  account: normalizeAccount,
  category: normalizeCategory,
  budget: normalizeBudget,
  goal: normalizeGoal,
  recurring: normalizeRecurring,
};
