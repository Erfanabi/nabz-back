import request from 'supertest';
import { CapturingSmsProvider, TestContext, cleanupPhone, createTestApp, uniquePhone } from './helpers';

/**
 * چک‌لیست پذیرش §۱۱ — بخش «ورود».
 * این تست‌ها همان بندهایی را می‌سنجند که سند شرط آماده بودن بک‌اند گذاشته.
 */
describe('احراز هویت (e2e)', () => {
  let ctx: TestContext;
  let sms: CapturingSmsProvider;
  const phones: string[] = [];

  const newPhone = (): string => {
    const phone = uniquePhone();
    phones.push(phone);
    return phone;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    sms = ctx.sms;
  });

  afterAll(async () => {
    for (const phone of phones) await cleanupPhone(ctx.prisma, phone);
    await ctx.app.close();
  });

  const http = () => request(ctx.app.getHttpServer());

  /**
   * IP یکتا برای هر درخواست OTP.
   *
   * سقف «۱۰ بار در ساعت بر IP» واقعی است و همهٔ تست‌ها از یک IP می‌آیند؛ بدون
   * این، سقف IP خودش تست‌های دیگر را می‌شکند. سقف IP در تست جداگانهٔ خودش سنجیده می‌شود.
   */
  let ipCounter = 0;
  const freshIp = (): string => `10.0.${Math.floor(ipCounter / 250) % 250}.${(ipCounter += 1) % 250}`;

  async function login(phone: string, deviceId = 'device-1') {
    await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', freshIp())
      .send({ phone, device_id: deviceId })
      .expect(200);
    const code = sms.lastCodeFor(phone);
    const res = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone, code, device_id: deviceId, device_name: 'دستگاه تست' })
      .expect(200);
    return res.body.data;
  }

  it('هر پاسخ موفق server_time دارد', async () => {
    const res = await http().get('/v1/config/app').expect(200);
    expect(res.body.server_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('شماره در هر قالبی پذیرفته و نرمال می‌شود', async () => {
    const phone = newPhone();
    const national = phone.slice(1); // 9xxxxxxxxx
    await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', freshIp())
      .send({ phone: `+98${national}` })
      .expect(200);
    const code = sms.lastCodeFor(phone);
    const res = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone: `0098${national}`, code })
      .expect(200);
    expect(res.body.data.user.phone).toBe(phone);
  });

  it('خط ثابت رد می‌شود چون پیامک به آن نمی‌رسد', async () => {
    const res = await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', freshIp())
      .send({ phone: '02112345678' })
      .expect(400);
    expect(res.body.error.code).toBe('phone_invalid');
    expect(res.body.error.message).toMatch(/[؀-ۿ]/);
  });

  it('پاسخ otp/request برای شمارهٔ موجود و جدید از هم قابل تشخیص نیست', async () => {
    const existing = newPhone();
    await login(existing);

    const fresh = newPhone();
    const [a, b] = await Promise.all([
      http().post('/v1/auth/otp/request').set('X-Forwarded-For', freshIp()).send({ phone: existing }),
      http().post('/v1/auth/otp/request').set('X-Forwarded-For', freshIp()).send({ phone: fresh }),
    ]);

    expect(a.status).toBe(b.status);
    expect(Object.keys(a.body.data).sort()).toEqual(Object.keys(b.body.data).sort());
    expect(a.body.data).toEqual(b.body.data);
    // هیچ نشانه‌ای از وجود حساب در پاسخ نیست.
    expect(JSON.stringify(a.body)).not.toMatch(/is_new|exists|registered/i);
  });

  it('is_new فقط بعد از تأیید موفق می‌آید', async () => {
    const phone = newPhone();
    const first = await login(phone);
    expect(first.user.is_new).toBe(true);
    const second = await login(phone, 'device-2');
    expect(second.user.is_new).toBe(false);
  });

  it('entitlements در همان پاسخ ورود می‌آید تا اپ فوراً آفلاین‌پذیر شود', async () => {
    const data = await login(newPhone());
    expect(data.entitlements.effective_plan).toBe('free');
    // نقطه در نام کلید است، نه مسیر تودرتو — پس با آرایه بررسی می‌شود.
    expect(data.entitlements.usage).toHaveProperty(['accounts.max'], 0);
    expect(data.entitlements.expires_at).toBeNull();
  });

  it('کد غلط «کد درست نبود» می‌دهد و ۵ تلاش بعد قفل ۱۵ دقیقه‌ای با retry_after', async () => {
    const phone = newPhone();
    await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', freshIp())
      .send({ phone })
      .expect(200);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await http().post('/v1/auth/otp/verify').send({ phone, code: '000000' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('otp_invalid');
      // پیام خطا هیچ‌وقت نمی‌گوید شماره ثبت بود یا نه.
      expect(res.body.error.message).toBe('کد وارد شده درست نیست.');
    }

    const locked = await http().post('/v1/auth/otp/verify').send({ phone, code: '000000' });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('otp_locked');
    expect(locked.body.error.retry_after).toBe(15 * 60);
    expect(locked.headers['retry-after']).toBe(String(15 * 60));

    // کد درست هم در دورهٔ قفل کار نمی‌کند.
    const afterLock = await http()
      .post('/v1/auth/otp/verify')
      .send({ phone, code: sms.lastCodeFor(phone) });
    expect(afterLock.status).toBe(423);
  });

  it('کد OTP خام در دیتابیس ذخیره نمی‌شود', async () => {
    const phone = newPhone();
    await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', freshIp())
      .send({ phone })
      .expect(200);
    const code = sms.lastCodeFor(phone);
    const challenge = await ctx.prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    expect(challenge?.codeHash).not.toBe(code);
    expect(challenge?.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('محدودیت نرخ روی شماره: ۳ درخواست در ۱۰ دقیقه', async () => {
    const phone = newPhone();
    // هر درخواست از IP تازه می‌آید، پس فقط سقف شماره می‌تواند مسدود کند.
    for (let i = 0; i < 3; i += 1) {
      await http()
        .post('/v1/auth/otp/request')
        .set('X-Forwarded-For', freshIp())
        .send({ phone })
        .expect(200);
    }
    const blocked = await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', freshIp())
      .send({ phone });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('rate_limited');
    expect(blocked.body.error.retry_after).toBeGreaterThan(0);
  });

  it('محدودیت نرخ روی IP: ۱۰ درخواست در ساعت، مستقل از شماره', async () => {
    const ip = `172.20.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
    // هر بار شمارهٔ تازه، پس سقف شماره هیچ‌وقت فعال نمی‌شود و فقط سقف IP می‌ماند.
    for (let i = 0; i < 10; i += 1) {
      await http()
        .post('/v1/auth/otp/request')
        .set('X-Forwarded-For', ip)
        .send({ phone: newPhone() })
        .expect(200);
    }
    const blocked = await http()
      .post('/v1/auth/otp/request')
      .set('X-Forwarded-For', ip)
      .send({ phone: newPhone() });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('rate_limited');
  });

  it('refresh چرخشی است و استفادهٔ دوبارهٔ توکن کهنه همهٔ جلسه‌ها را می‌بندد', async () => {
    const phone = newPhone();
    const first = await login(phone, 'device-a');
    const second = await login(phone, 'device-b');

    const rotated = await http()
      .post('/v1/auth/token/refresh')
      .send({ refresh_token: first.refresh_token })
      .expect(200);
    expect(rotated.body.data.refresh_token).not.toBe(first.refresh_token);

    // توکن مصرف‌شده دوباره آمد → تشخیص سرقت.
    const reuse = await http()
      .post('/v1/auth/token/refresh')
      .send({ refresh_token: first.refresh_token });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('token_revoked');

    // هر دو جلسه بسته شده‌اند، حتی جلسهٔ دستگاه دوم که دست‌کاری نشده بود.
    for (const token of [rotated.body.data.refresh_token, second.refresh_token]) {
      const res = await http().post('/v1/auth/token/refresh').send({ refresh_token: token });
      expect(res.status).toBe(401);
    }
    const withAccess = await http()
      .get('/v1/me')
      .set('Authorization', `Bearer ${second.access_token}`);
    expect(withAccess.status).toBe(401);
  });

  it('قطع جلسهٔ دستگاه دیگر فوراً اثر می‌کند', async () => {
    const phone = newPhone();
    const a = await login(phone, 'device-a');
    const b = await login(phone, 'device-b');

    const sessions = await http()
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${a.access_token}`)
      .expect(200);
    expect(sessions.body.data).toHaveLength(2);
    expect(sessions.body.data.filter((s: { is_current: boolean }) => s.is_current)).toHaveLength(1);

    const other = sessions.body.data.find((s: { is_current: boolean }) => !s.is_current);
    await http()
      .delete(`/v1/auth/sessions/${other.id}`)
      .set('Authorization', `Bearer ${a.access_token}`)
      .expect(204);

    // توکن دسترسی دستگاه قطع‌شده فوراً بی‌اثر است، نه بعد از انقضای JWT.
    const blocked = await http().get('/v1/me').set('Authorization', `Bearer ${b.access_token}`);
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe('token_revoked');

    // دستگاه خودش سالم مانده.
    await http().get('/v1/me').set('Authorization', `Bearer ${a.access_token}`).expect(200);
  });

  it('جلسهٔ کاربر دیگر قابل قطع کردن نیست', async () => {
    const victim = await login(newPhone(), 'victim');
    const attacker = await login(newPhone(), 'attacker');

    const sessions = await http()
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${victim.access_token}`)
      .expect(200);

    const res = await http()
      .delete(`/v1/auth/sessions/${sessions.body.data[0].id}`)
      .set('Authorization', `Bearer ${attacker.access_token}`);
    expect(res.status).toBe(404);

    await http().get('/v1/me').set('Authorization', `Bearer ${victim.access_token}`).expect(200);
  });

  it('خروج فقط همین جلسه را می‌بندد', async () => {
    const phone = newPhone();
    const a = await login(phone, 'device-a');
    const b = await login(phone, 'device-b');

    await http()
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${a.access_token}`)
      .send({ refresh_token: a.refresh_token })
      .expect(204);

    expect((await http().get('/v1/me').set('Authorization', `Bearer ${a.access_token}`)).status).toBe(401);
    await http().get('/v1/me').set('Authorization', `Bearer ${b.access_token}`).expect(200);
  });

  it('مسیر محافظت‌شده بدون توکن ۴۰۱ با پیام فارسی می‌دهد', async () => {
    const res = await http().get('/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
    expect(res.body.error.message).toMatch(/[؀-ۿ]/);
  });

  it('تغییر شماره موبایل از مسیر PATCH /me ممکن نیست', async () => {
    const phone = newPhone();
    const session = await login(phone);
    const res = await http()
      .patch('/v1/me')
      .set('Authorization', `Bearer ${session.access_token}`)
      .send({ display_name: 'سارا', phone: '09990000000' })
      .expect(200);
    expect(res.body.data.display_name).toBe('سارا');
    expect(res.body.data.phone).toBe(phone);
  });
});
