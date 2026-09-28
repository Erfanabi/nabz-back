import {
  PayloadError,
  normalizeAccount,
  normalizeBudget,
  normalizeCategory,
  normalizeGoal,
  normalizeTransaction,
} from './payload';

const TX_ID = '11111111-1111-4111-8111-111111111111';
const CAT_ID = '22222222-2222-4222-8222-222222222222';
const ACC_ID = '33333333-3333-4333-8333-333333333333';
const ACC2_ID = '44444444-4444-4444-8444-444444444444';

describe('normalizeTransaction — BR-01', () => {
  it('هزینه با دسته و حساب پذیرفته می‌شود', () => {
    const tx = normalizeTransaction({
      id: TX_ID,
      type: 'expense',
      amount: 185000,
      name: 'نان',
      category: CAT_ID,
      account: ACC_ID,
      occurred_at: '2026-09-25T09:10:00Z',
    });
    expect(tx.categoryId).toBe(CAT_ID);
    expect(tx.fromId).toBeNull();
    expect(tx.toId).toBeNull();
  });

  it('انتقال با مبدأ و مقصد پذیرفته می‌شود و دسته/حساب نمی‌گیرد', () => {
    const tx = normalizeTransaction({
      id: TX_ID,
      type: 'transfer',
      amount: 5000000,
      name: 'انتقال',
      from: ACC_ID,
      to: ACC2_ID,
      occurred_at: '2026-09-24T12:00:00Z',
    });
    expect(tx.categoryId).toBeNull();
    expect(tx.accountId).toBeNull();
    expect(tx.fromId).toBe(ACC_ID);
    expect(tx.toId).toBe(ACC2_ID);
  });

  it('انتقالِ دارای دسته رد می‌شود، نه اینکه دسته بی‌صدا حذف شود', () => {
    expect(() =>
      normalizeTransaction({
        id: TX_ID,
        type: 'transfer',
        amount: 100,
        name: 'x',
        category: CAT_ID,
        from: ACC_ID,
        to: ACC2_ID,
        occurred_at: '2026-09-24T12:00:00Z',
      }),
    ).toThrow(PayloadError);
  });

  it('هزینهٔ دارای from/to رد می‌شود', () => {
    expect(() =>
      normalizeTransaction({
        id: TX_ID,
        type: 'expense',
        amount: 100,
        name: 'x',
        category: CAT_ID,
        account: ACC_ID,
        from: ACC_ID,
        occurred_at: '2026-09-24T12:00:00Z',
      }),
    ).toThrow(/مبدأ و مقصد ندارند/);
  });

  it('انتقال به همان حساب رد می‌شود', () => {
    expect(() =>
      normalizeTransaction({
        id: TX_ID,
        type: 'transfer',
        amount: 100,
        name: 'x',
        from: ACC_ID,
        to: ACC_ID,
        occurred_at: '2026-09-24T12:00:00Z',
      }),
    ).toThrow(/نمی‌تواند یکی باشد/);
  });

  it('هزینهٔ بدون دسته یا بدون حساب رد می‌شود', () => {
    const base = {
      id: TX_ID,
      type: 'expense',
      amount: 100,
      name: 'x',
      occurred_at: '2026-09-24T12:00:00Z',
    };
    expect(() => normalizeTransaction({ ...base, account: ACC_ID })).toThrow(/دسته لازم است/);
    expect(() => normalizeTransaction({ ...base, category: CAT_ID })).toThrow(/حساب لازم است/);
  });
});

describe('اعتبارسنجی مبلغ — همیشه تومان و عدد صحیح', () => {
  const base = {
    id: TX_ID,
    type: 'expense' as const,
    name: 'x',
    category: CAT_ID,
    account: ACC_ID,
    occurred_at: '2026-09-24T12:00:00Z',
  };

  it('مبلغ اعشاری رد می‌شود تا خطای ممیز شناور وارد داده نشود', () => {
    expect(() => normalizeTransaction({ ...base, amount: 1000.5 })).toThrow(/عدد صحیح/);
  });

  it('مبلغ رشته‌ای رد می‌شود', () => {
    expect(() => normalizeTransaction({ ...base, amount: '1000' })).toThrow(/عدد صحیح/);
  });

  it('مبلغ منفی رد می‌شود', () => {
    expect(() => normalizeTransaction({ ...base, amount: -1 })).toThrow(/منفی/);
  });
});

describe('اعتبارسنجی تاریخ', () => {
  const base = {
    id: TX_ID,
    type: 'expense' as const,
    amount: 100,
    name: 'x',
    category: CAT_ID,
    account: ACC_ID,
  };

  it('ISO 8601 و epoch ms پذیرفته می‌شوند', () => {
    expect(
      normalizeTransaction({ ...base, occurred_at: '2026-09-25T09:10:00Z' }).occurredAt.toISOString(),
    ).toBe('2026-09-25T09:10:00.000Z');
    expect(normalizeTransaction({ ...base, occurred_at: 1735000000000 }).occurredAt.getTime()).toBe(
      1735000000000,
    );
  });

  it('تاریخ جلالیِ رشته‌ای صریحاً رد می‌شود', () => {
    expect(() => normalizeTransaction({ ...base, occurred_at: '1405-07-03' })).toThrow(/میلادی/);
    expect(() => normalizeTransaction({ ...base, occurred_at: '1399/01/01' })).toThrow(/میلادی/);
  });
});

describe('normalizeAccount — فقط چهار رقم آخر کارت', () => {
  it('کارت درست پذیرفته می‌شود', () => {
    const acc = normalizeAccount({
      id: ACC_ID,
      name: 'بانک ملت',
      balance: 42500000,
      card: { bin: '610433', last4: '1234', expiry: '07/29', bank: 'ملت', tone: 'rose' },
    });
    expect(acc.cardLast4).toBe('1234');
    expect(acc.cardBin).toBe('610433');
  });

  it('حساب نقد کارت ندارد', () => {
    const acc = normalizeAccount({ id: ACC_ID, name: 'نقد', balance: 500000, card: null });
    expect(acc.cardLast4).toBeNull();
  });

  it('شمارهٔ کامل کارت در جای چهار رقم آخر رد می‌شود', () => {
    expect(() =>
      normalizeAccount({
        id: ACC_ID,
        name: 'بانک',
        balance: 0,
        card: { last4: '6037997512345678' },
      }),
    ).toThrow(/چهار رقم آخر/);
  });

  it('bin غیرشش‌رقمی رد می‌شود', () => {
    expect(() =>
      normalizeAccount({ id: ACC_ID, name: 'بانک', balance: 0, card: { bin: '6037997512345678' } }),
    ).toThrow(/شش رقم اول/);
  });
});

describe('بودجه، دسته و هدف', () => {
  it('بودجه به دسته گره خورده است', () => {
    expect(normalizeBudget({ id: TX_ID, category: CAT_ID, limit: 4000000 }).categoryId).toBe(CAT_ID);
    expect(() => normalizeBudget({ id: TX_ID, limit: 100 })).toThrow(/دستهٔ بودجه/);
  });

  it('دستهٔ بدون پرچم custom، دستهٔ پایه حساب می‌شود', () => {
    expect(normalizeCategory({ id: CAT_ID, name: 'خوراک' }).custom).toBe(false);
    expect(normalizeCategory({ id: CAT_ID, name: 'خوراک', custom: true }).custom).toBe(true);
  });

  it('هدف با مبلغ صفر رد می‌شود', () => {
    expect(() => normalizeGoal({ id: TX_ID, name: 'سفر', target: 0 })).toThrow(/بیشتر از صفر/);
  });

  it('شناسهٔ غیر-UUID رد می‌شود چون شناسه را کلاینت می‌سازد', () => {
    expect(() => normalizeCategory({ id: 'cat-1', name: 'خوراک' })).toThrow(/شناسه/);
  });
});
