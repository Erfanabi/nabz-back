import request from 'supertest';
import { TestContext, cleanupPhone, createTestApp, uniquePhone, uuid } from './helpers';

/**
 * چک‌لیست پذیرش §۱۱ — بخش‌های «آفلاین»، «پلن و پرداخت» و «داده».
 */
describe('همگام‌سازی و پرداخت (e2e)', () => {
  let ctx: TestContext;
  const phones: string[] = [];
  let ipCounter = 0;

  const freshIp = (): string => `10.9.${Math.floor(ipCounter / 250) % 250}.${(ipCounter += 1) % 250}`;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    for (const phone of phones) await cleanupPhone(ctx.prisma, phone);
    await ctx.app.close();
  });

  /** یک کاربر تازه با توکن آماده. */
  async function newUser(): Promise<{ token: string; userId: string; auth: [string, string] }> {
    const phone = uniquePhone();
    phones.push(phone);
    await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', freshIp())
      .send({ phone })
      .expect(200);
    const code = ctx.sms.lastCodeFor(phone);
    const res = await http().post('/v1/auth/otp/verify').send({ phone, code }).expect(200);
    return {
      token: res.body.data.access_token,
      userId: res.body.data.user.id,
      auth: ['Authorization', `Bearer ${res.body.data.access_token}`],
    };
  }

  const now = () => Date.now();

  function op(entity: string, action: string, payload: Record<string, unknown>, at = now()) {
    return { op_id: uuid(), entity, action, client_updated_at: at, payload };
  }

  // ───────────────────────── sync/push ─────────────────────────

  it('بدنهٔ معتبر همیشه ۲۰۰ می‌گیرد، حتی وقتی بعضی opها رد می‌شوند (موفقیت جزئی)', async () => {
    const user = await newUser();
    const accountId = uuid();
    const categoryId = uuid();

    const res = await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({
        ops: [
          op('account', 'create', { id: accountId, name: 'بانک', balance: 1000 }),
          op('category', 'create', { id: categoryId, name: 'خوراک', custom: true }),
          // مبلغ اعشاری — رد می‌شود ولی دستهٔ قبلی و تراکنش بعدی سالم می‌مانند.
          op('transaction', 'create', {
            id: uuid(),
            type: 'expense',
            amount: 12.5,
            name: 'اعشاری',
            category: categoryId,
            account: accountId,
            occurred_at: '2026-09-25T09:00:00Z',
          }),
          op('transaction', 'create', {
            id: uuid(),
            type: 'expense',
            amount: 185000,
            name: 'نان',
            category: categoryId,
            account: accountId,
            occurred_at: '2026-09-25T09:10:00Z',
          }),
        ],
      })
      .expect(200);

    const statuses = res.body.data.results.map((r: { status: string }) => r.status);
    expect(statuses).toEqual(['applied', 'applied', 'rejected', 'applied']);
    expect(res.body.data.results[2].message).toMatch(/[؀-ۿ]/);
    expect(res.body.data.sync_cursor).toMatch(/^c_\d+$/);
  });

  it('ارسال دوبارهٔ همان دسته هیچ رکورد تکراری نمی‌سازد', async () => {
    const user = await newUser();
    const accountId = uuid();
    const body = { ops: [op('account', 'create', { id: accountId, name: 'بانک', balance: 5000 })] };

    const first = await http().post('/v1/sync/push').set(...user.auth).send(body).expect(200);
    expect(first.body.data.results[0].status).toBe('applied');

    for (let i = 0; i < 3; i += 1) {
      const again = await http().post('/v1/sync/push').set(...user.auth).send(body).expect(200);
      expect(again.body.data.results[0].status).toBe('duplicate');
    }

    const count = await ctx.prisma.account.count({ where: { userId: user.userId } });
    expect(count).toBe(1);
  });

  it('حل تعارض: نوشتن کهنه‌تر رد می‌شود و نسخهٔ سرور برمی‌گردد', async () => {
    const user = await newUser();
    const accountId = uuid();
    const t1 = now();

    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'create', { id: accountId, name: 'نسخهٔ تازه', balance: 100 }, t1)] })
      .expect(200);

    const stale = await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({
        ops: [op('account', 'update', { id: accountId, name: 'نسخهٔ کهنه', balance: 999 }, t1 - 60_000)],
      })
      .expect(200);

    const result = stale.body.data.results[0];
    expect(result.status).toBe('conflict');
    expect(result.server_version.name).toBe('نسخهٔ تازه');

    const row = await ctx.prisma.account.findFirst({ where: { userId: user.userId, id: accountId } });
    expect(row?.name).toBe('نسخهٔ تازه');
  });

  it('حذف همیشه برنده است: ویرایش تازه‌تر رکورد حذف‌شده را زنده نمی‌کند', async () => {
    const user = await newUser();
    const accountId = uuid();
    const t1 = now();

    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'create', { id: accountId, name: 'حساب', balance: 100 }, t1)] })
      .expect(200);

    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'delete', { id: accountId }, t1 + 1000)] })
      .expect(200);

    // ویرایش با زمان تازه‌تر از حذف — باید بی‌اثر باشد.
    const revive = await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'update', { id: accountId, name: 'برگشته', balance: 7 }, t1 + 99_000)] })
      .expect(200);
    expect(revive.body.data.results[0].status).toBe('applied');

    const row = await ctx.prisma.account.findFirst({ where: { userId: user.userId, id: accountId } });
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.name).toBe('حساب');
  });

  it('BR-01: انتقال دسته و حساب نمی‌گیرد و درآمد/هزینه from/to نمی‌گیرد', async () => {
    const user = await newUser();
    const acc1 = uuid();
    const acc2 = uuid();
    const cat = uuid();

    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({
        ops: [
          op('account', 'create', { id: acc1, name: 'ملت', balance: 1000 }),
          op('account', 'create', { id: acc2, name: 'نقد', balance: 0, card: null }),
          op('category', 'create', { id: cat, name: 'خوراک', custom: true }),
        ],
      })
      .expect(200);

    const res = await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({
        ops: [
          op('transaction', 'create', {
            id: uuid(), type: 'transfer', amount: 500, name: 'انتقال با دسته',
            category: cat, from: acc1, to: acc2, occurred_at: '2026-09-25T09:00:00Z',
          }),
          op('transaction', 'create', {
            id: uuid(), type: 'expense', amount: 500, name: 'هزینه با مبدأ',
            category: cat, account: acc1, from: acc1, occurred_at: '2026-09-25T09:00:00Z',
          }),
          op('transaction', 'create', {
            id: uuid(), type: 'transfer', amount: 500, name: 'انتقال درست',
            from: acc1, to: acc2, occurred_at: '2026-09-25T09:00:00Z',
          }),
        ],
      })
      .expect(200);

    const results = res.body.data.results;
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('applied');
  });

  it('snapshot هیچ فیلد مشتقی نمی‌فرستد و شکل انتقال را رعایت می‌کند', async () => {
    const user = await newUser();
    const acc1 = uuid();
    const acc2 = uuid();
    const cat = uuid();

    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({
        ops: [
          op('account', 'create', { id: acc1, name: 'ملت', balance: 42_500_000,
            card: { bin: '610433', last4: '1234', expiry: '07/29', bank: 'ملت', tone: 'rose' } }),
          op('account', 'create', { id: acc2, name: 'نقد', balance: 500_000, card: null }),
          op('category', 'create', { id: cat, name: 'خوراک', custom: true, order: 1 }),
          op('budget', 'create', { id: uuid(), category: cat, limit: 4_000_000 }),
          op('goal', 'create', { id: uuid(), name: 'سفر', target: 80_000_000, current: 32_000_000, months: 6 }),
          op('transaction', 'create', { id: uuid(), type: 'expense', amount: 185_000, name: 'نان',
            category: cat, account: acc1, occurred_at: '2026-09-25T09:10:00Z' }),
          op('transaction', 'create', { id: uuid(), type: 'transfer', amount: 5_000_000, name: 'انتقال',
            from: acc1, to: acc2, occurred_at: '2026-09-24T12:00:00Z' }),
        ],
      })
      .expect(200);

    const snap = (await http().get('/v1/sync/snapshot').set(...user.auth).expect(200)).body.data;

    expect(snap.accounts).toHaveLength(2);
    // حساب نقد کارت ندارد.
    expect(snap.accounts.find((a: { name: string }) => a.name === 'نقد').card).toBeNull();
    // فقط چهار رقم آخر کارت.
    expect(snap.accounts.find((a: { name: string }) => a.name === 'ملت').card.last4).toBe('1234');

    // spent ذخیره و ارسال نمی‌شود.
    expect(snap.budgets[0]).not.toHaveProperty('spent');
    // monthlyNeed و status مشتق‌اند.
    expect(snap.goals[0]).not.toHaveProperty('monthlyNeed');
    expect(snap.goals[0]).not.toHaveProperty('status');
    // هیچ summary در پاسخ نیست.
    expect(snap).not.toHaveProperty('summary');

    const transfer = snap.transactions.find((t: { type: string }) => t.type === 'transfer');
    expect(Object.keys(transfer)).toContain('from');
    expect(Object.keys(transfer)).not.toContain('category');
    const expense = snap.transactions.find((t: { type: string }) => t.type === 'expense');
    expect(Object.keys(expense)).toContain('category');
    expect(Object.keys(expense)).not.toContain('from');
    // تاریخ ISO با timezone، هیچ رشتهٔ جلالی.
    expect(expense.occurred_at).toBe('2026-09-25T09:10:00.000Z');
  });

  it('pull فقط دلتا می‌دهد و نشانگر نامعتبر ۴۱۰ با cursor_expired است', async () => {
    const user = await newUser();
    const accId = uuid();
    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'create', { id: accId, name: 'اول', balance: 1 })] })
      .expect(200);

    const cursor = (await http().get('/v1/sync/snapshot').set(...user.auth).expect(200)).body.data
      .sync_cursor;

    const empty = (await http().get(`/v1/sync/pull?cursor=${cursor}`).set(...user.auth).expect(200))
      .body.data;
    expect(empty.accounts).toHaveLength(0);

    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'create', { id: uuid(), name: 'دوم', balance: 2 })] })
      .expect(200);

    const delta = (await http().get(`/v1/sync/pull?cursor=${cursor}`).set(...user.auth).expect(200))
      .body.data;
    expect(delta.accounts).toHaveLength(1);
    expect(delta.accounts[0].name).toBe('دوم');

    const bad = await http().get('/v1/sync/pull?cursor=not-a-cursor').set(...user.auth);
    expect(bad.status).toBe(410);
    expect(bad.body.error.code).toBe('cursor_expired');
  });

  it('سقف پلن روی ساخت اعمال می‌شود ولی ویرایش و حذف را نمی‌بندد', async () => {
    const user = await newUser();
    const first = uuid();

    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({
        ops: [
          op('account', 'create', { id: first, name: 'یک', balance: 1 }),
          op('account', 'create', { id: uuid(), name: 'دو', balance: 2 }),
        ],
      })
      .expect(200);

    // سقف پلن رایگان ۲ حساب است.
    const third = await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'create', { id: uuid(), name: 'سه', balance: 3 })] })
      .expect(200);
    expect(third.body.data.results[0].status).toBe('rejected');
    expect(third.body.data.results[0].code).toBe('plan_limit_reached');
    expect(third.body.data.results[0].message).toMatch(/[؀-ۿ]/);

    // ویرایش حساب موجود همچنان کار می‌کند.
    const edit = await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'update', { id: first, name: 'یک ویرایش‌شده', balance: 10 })] })
      .expect(200);
    expect(edit.body.data.results[0].status).toBe('applied');
  });

  it('تراکنش با حساب یا دستهٔ ناموجود رد می‌شود', async () => {
    const user = await newUser();
    const res = await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({
        ops: [
          op('transaction', 'create', { id: uuid(), type: 'expense', amount: 100, name: 'x',
            category: uuid(), account: uuid(), occurred_at: '2026-09-25T09:00:00Z' }),
        ],
      })
      .expect(200);
    expect(res.body.data.results[0].status).toBe('rejected');
    expect(res.body.data.results[0].message).toMatch(/وجود ندارد/);
  });

  it('دستهٔ کاربر دیگر قابل استفاده نیست (جداسازی داده)', async () => {
    const a = await newUser();
    const b = await newUser();
    const accA = uuid();
    const catA = uuid();

    await http()
      .post('/v1/sync/push')
      .set(...a.auth)
      .send({
        ops: [
          op('account', 'create', { id: accA, name: 'حساب الف', balance: 100 }),
          op('category', 'create', { id: catA, name: 'دستهٔ الف', custom: true }),
        ],
      })
      .expect(200);

    const res = await http()
      .post('/v1/sync/push')
      .set(...b.auth)
      .send({
        ops: [
          op('transaction', 'create', { id: uuid(), type: 'expense', amount: 100, name: 'دزدی',
            category: catA, account: accA, occurred_at: '2026-09-25T09:00:00Z' }),
        ],
      })
      .expect(200);
    expect(res.body.data.results[0].status).toBe('rejected');

    const snapB = (await http().get('/v1/sync/snapshot').set(...b.auth).expect(200)).body.data;
    expect(snapB.accounts).toHaveLength(0);
    expect(snapB.transactions).toHaveLength(0);
  });

  it('دستهٔ بیش از ۵۰۰ op رد می‌شود', async () => {
    const user = await newUser();
    const ops = Array.from({ length: 501 }, () =>
      op('account', 'create', { id: uuid(), name: 'x', balance: 0 }),
    );
    const res = await http().post('/v1/sync/push').set(...user.auth).send({ ops });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.fields.ops).toMatch(/۵۰۰|500/);
  });

  // ───────────────────────── billing ─────────────────────────

  it('کاتالوگ بدون توکن و با ETag می‌آید و هیچ قیمتی در کلاینت لازم نیست', async () => {
    const res = await http().get('/v1/billing/plans').expect(200);
    expect(res.headers.etag).toBeDefined();
    expect(res.body.data.prices.plus['90']).toBe(129_000);
    expect(res.body.data.limits['accounts.max'].pro).toBeNull(); // null = نامحدود
    expect(res.body.data.features).toHaveLength(28);
    expect(res.body.data.plans.find((p: { key: string }) => p.key === 'pro').is_purchasable).toBe(false);

    const cached = await http().get('/v1/billing/plans').set('If-None-Match', res.headers.etag);
    expect(cached.status).toBe(304);
  });

  it('Idempotency-Key تکراری همان درخواست را با ۲۰۰ برمی‌گرداند', async () => {
    const user = await newUser();
    const key = uuid();
    const body = { plan_key: 'plus', duration_days: 90 };

    const first = await http()
      .post('/v1/billing/payment-requests')
      .set(...user.auth)
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);
    expect(first.body.data.ref_code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(first.body.data.ref_code).not.toMatch(/[0O1IL]/);

    const second = await http()
      .post('/v1/billing/payment-requests')
      .set(...user.auth)
      .set('Idempotency-Key', key)
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.ref_code).toBe(first.body.data.ref_code);

    const count = await ctx.prisma.paymentRequest.count({ where: { userId: user.userId } });
    expect(count).toBe(1);
  });

  it('درخواست pending تکراری برای همان پلن و مدت، همان قبلی را می‌دهد', async () => {
    const user = await newUser();
    const body = { plan_key: 'plus', duration_days: 30 };

    const first = await http().post('/v1/billing/payment-requests').set(...user.auth).send(body);
    expect(first.status).toBe(201);

    const second = await http().post('/v1/billing/payment-requests').set(...user.auth).send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);

    // مدت متفاوت درخواست تازهٔ خودش را دارد.
    const other = await http()
      .post('/v1/billing/payment-requests')
      .set(...user.auth)
      .send({ plan_key: 'plus', duration_days: 90 });
    expect(other.status).toBe(201);
    expect(other.body.data.id).not.toBe(first.body.data.id);
  });

  it('مبلغ از کاتالوگ سرور می‌آید و مبلغ فرستادهٔ کلاینت نادیده گرفته می‌شود', async () => {
    const user = await newUser();
    const res = await http()
      .post('/v1/billing/payment-requests')
      .set(...user.auth)
      .send({ plan_key: 'plus', duration_days: 30, amount_toman: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.amount_toman).toBe(49_000);
  });

  it('پلن غیرفروختنی رد می‌شود', async () => {
    const user = await newUser();
    const res = await http()
      .post('/v1/billing/payment-requests')
      .set(...user.auth)
      .send({ plan_key: 'pro', duration_days: 30 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    expect(res.body.error.message).toMatch(/[؀-ۿ]/);
  });

  it('شمارهٔ کامل کارت در متن رسید ماسک می‌شود', async () => {
    const user = await newUser();
    const pr = await http()
      .post('/v1/billing/payment-requests')
      .set(...user.auth)
      .send({ plan_key: 'plus', duration_days: 30 });

    await http()
      .post(`/v1/billing/payment-requests/${pr.body.data.id}/receipt`)
      .set(...user.auth)
      .send({ channel: 'telegram', note: 'واریز از کارت 6037997512345678 ساعت ۱۴:۳۰' })
      .expect(200);

    const receipt = await ctx.prisma.paymentReceipt.findFirst({
      where: { requestId: pr.body.data.id },
    });
    expect(receipt?.note).not.toMatch(/6037997512345678/);
    expect(receipt?.note).toContain('5678');
  });

  it('درخواست پرداخت کاربر دیگر قابل دیدن یا لغو نیست', async () => {
    const a = await newUser();
    const b = await newUser();
    const pr = await http()
      .post('/v1/billing/payment-requests')
      .set(...a.auth)
      .send({ plan_key: 'plus', duration_days: 30 });

    expect((await http().get(`/v1/billing/payment-requests/${pr.body.data.id}`).set(...b.auth)).status).toBe(404);
    expect((await http().post(`/v1/billing/payment-requests/${pr.body.data.id}/cancel`).set(...b.auth)).status).toBe(404);
  });

  it('لغو روی pending اثر دارد و روی بقیه no-op با ۲۰۰ است', async () => {
    const user = await newUser();
    const pr = await http()
      .post('/v1/billing/payment-requests')
      .set(...user.auth)
      .send({ plan_key: 'plus', duration_days: 30 });

    const cancelled = await http()
      .post(`/v1/billing/payment-requests/${pr.body.data.id}/cancel`)
      .set(...user.auth)
      .expect(200);
    expect(cancelled.body.data.status).toBe('cancelled');

    const again = await http()
      .post(`/v1/billing/payment-requests/${pr.body.data.id}/cancel`)
      .set(...user.auth)
      .expect(200);
    expect(again.body.data.status).toBe('cancelled');
  });

  it('دورهٔ آزمایشی یک‌بار پرو می‌دهد و بار دوم trial_already_used', async () => {
    const user = await newUser();
    const first = await http().post('/v1/billing/trial').set(...user.auth).expect(200);
    expect(first.body.data.effective_plan).toBe('pro');
    expect(first.body.data.source).toBe('trial');
    expect(first.body.data.trial_used).toBe(true);

    const second = await http()
      .post('/v1/billing/trial')
      .set(...user.auth)
      .set('Idempotency-Key', uuid());
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('trial_already_used');
  });

  it('سقف نامحدود پرو، سقف حساب رایگان را باز می‌کند', async () => {
    const user = await newUser();
    await http().post('/v1/billing/trial').set(...user.auth).expect(200); // پرو

    const ops = Array.from({ length: 5 }, (_, i) =>
      op('account', 'create', { id: uuid(), name: `حساب ${i}`, balance: 0 }),
    );
    const res = await http().post('/v1/sync/push').set(...user.auth).send({ ops }).expect(200);
    expect(res.body.data.results.every((r: { status: string }) => r.status === 'applied')).toBe(true);
  });

  it('localOnly همگام‌سازی را می‌بندد و دادهٔ سرور را پاک می‌کند', async () => {
    const user = await newUser();
    await http()
      .post('/v1/sync/push')
      .set(...user.auth)
      .send({ ops: [op('account', 'create', { id: uuid(), name: 'حساب', balance: 100 })] })
      .expect(200);
    expect(await ctx.prisma.account.count({ where: { userId: user.userId } })).toBe(1);

    await http().put('/v1/settings').set(...user.auth).send({ localOnly: true }).expect(200);

    // هر درخواست جداگانه ساخته و await می‌شود: supertest برای هر درخواست یک سرور
    // موقت باز می‌کند، و ساختن هر سه پیش از await اتصال آخری‌ها را می‌بندد.
    const blockedCalls = [
      () => http().get('/v1/sync/snapshot').set(...user.auth),
      () => http().get('/v1/sync/pull').set(...user.auth),
      () => http().post('/v1/sync/push').set(...user.auth).send({ ops: [] }),
    ];
    for (const call of blockedCalls) {
      const res = await call();
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
      expect(res.body.error.message).toMatch(/[؀-ۿ]/);
    }

    expect(await ctx.prisma.account.count({ where: { userId: user.userId } })).toBe(0);
  });

  it('تنظیمات فرستاده‌نشده تغییر نمی‌کنند و appLock همگام نمی‌شود', async () => {
    const user = await newUser();
    const before = (await http().get('/v1/settings').set(...user.auth).expect(200)).body.data;
    expect(before.benchmarking).toBe(false); // پیش‌فرض محافظه‌کارانه
    expect(before).not.toHaveProperty('appLock');
    expect(before).not.toHaveProperty('biometric');

    const after = (
      await http()
        .put('/v1/settings')
        .set(...user.auth)
        .send({ digits: 'latin', appLock: true, biometric: true, alerts: { savingRateDown: true } })
        .expect(200)
    ).body.data;

    expect(after.digits).toBe('latin');
    expect(after.calendar).toBe(before.calendar);
    expect(after).not.toHaveProperty('appLock');
    // ادغام هشدارها ترجیح‌های قبلی را پاک نمی‌کند.
    expect(after.alerts).toEqual({ ...before.alerts, savingRateDown: true });
  });

  it('حذف حساب ۲۰۲ با مهلت می‌دهد و ورود بعدی آن را لغو می‌کند', async () => {
    const phone = uniquePhone();
    phones.push(phone);
    await http().post('/v1/auth/otp/request').set('X-Forwarded-For', freshIp()).send({ phone }).expect(200);
    const login1 = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone, code: ctx.sms.lastCodeFor(phone) })
      .expect(200);
    const auth: [string, string] = ['Authorization', `Bearer ${login1.body.data.access_token}`];

    const res = await http().delete('/v1/me').set(...auth).send({ confirm: true }).expect(202);
    expect(res.body.data.deletion_scheduled_at).toBeDefined();
    expect(res.body.data.grace_days).toBe(7);

    await http().post('/v1/auth/otp/request').set('X-Forwarded-For', freshIp()).send({ phone }).expect(200);
    await http()
      .post('/v1/auth/otp/verify')
      .send({ phone, code: ctx.sms.lastCodeFor(phone) })
      .expect(200);

    const user = await ctx.prisma.user.findUnique({ where: { phone } });
    expect(user?.deletionScheduledAt).toBeNull();
  });

  it('حذف بدون تأیید صریح رد می‌شود', async () => {
    const user = await newUser();
    const res = await http().delete('/v1/me').set(...user.auth).send({ confirm: false });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.confirm).toMatch(/[؀-ۿ]/);
  });

  it('خروجی CSV برای پلن رایگان باز است و اکسل نیست', async () => {
    const user = await newUser();
    const csv = await http()
      .post('/v1/export')
      .set(...user.auth)
      .send({ format: 'csv', include: ['transactions'] })
      .expect(200);
    expect(csv.body.data.url).toContain('/v1/files?');

    const xlsx = await http()
      .post('/v1/export')
      .set(...user.auth)
      .send({ format: 'xlsx', include: ['transactions'] });
    expect(xlsx.status).toBe(403);
    expect(xlsx.body.error.code).toBe('feature_not_available');
  });

  it('فایل خروجی فقط با امضای درست تحویل می‌شود', async () => {
    const user = await newUser();
    const csv = await http()
      .post('/v1/export')
      .set(...user.auth)
      .send({ format: 'csv', include: ['transactions'] })
      .expect(200);

    const url = new URL(csv.body.data.url);
    const path = `${url.pathname}${url.search}`;
    await http().get(path).expect(200);

    // امضای دست‌کاری‌شده → ۴۰۴، بدون افشای وجود فایل.
    const tampered = path.replace(/sig=[0-9a-f]+/, 'sig=' + 'f'.repeat(64));
    expect((await http().get(tampered)).status).toBe(404);
  });
});
