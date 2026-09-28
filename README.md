# نبض — بک‌اند

سرور اپ مدیریت مالی شخصی **نبض**. NestJS (مونولیت ماژولار) + PostgreSQL + Prisma.

مرجع پیاده‌سازی: [`docs/API-SPEC.md`](docs/API-SPEC.md) و [`docs/BACKEND-SPEC.md`](docs/BACKEND-SPEC.md).
پوشش بند‌به‌بند چک‌لیست پذیرش: [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md).

---

## سه قاعده‌ای که همه‌جا برقرارند

| کد | قاعده | جای اجبار |
|---|---|---|
| **BR-01** | انتقال بین حساب‌ها در هیچ جمعی شمرده نمی‌شود، و شکل تراکنش با نوعش می‌خواند | `CHECK` در دیتابیس + `src/modules/sync/payload.ts` |
| **BR-02 / P6** | هیچ عدد مشتقی (`spent`، `summary`، `goal.status`، `monthlyNeed`) ستون ندارد و ارسال نمی‌شود | اسکیما ستونش را ندارد |
| **Offline-first** | هیچ اندپوینتی در مسیر رندر صفحه نیست؛ همهٔ نوشتن‌ها idempotent | `Idempotency-Key` + `op_id` |

پول همه‌جا **تومان و عدد صحیح**. تاریخ همه‌جا **ISO 8601 یا epoch ms** — هیچ رشتهٔ جلالی در API نیست.
هر پاسخ موفق `server_time` دارد.

---

## راه‌اندازی

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npx prisma migrate deploy
npm run seed
npm run start:dev
```

* API روی `http://localhost:3000/v1`
* مستندات تعاملی روی `http://localhost:3000/docs`
* درایور پیش‌فرض پیامک `log` است: **کد OTP در لاگ سرور چاپ می‌شود**.

### اجرای کامل با Docker

```bash
docker compose --profile full up -d
```

### آزمون دود (کل مسیر محصول)

```bash
SERVER_LOG=/path/to/server.log bash scripts/smoke.sh
```

۲۵ مرحله: ورود ← entitlements ← sync ← سقف پلن ← پرداخت ← تأیید ادمین ← صف‌شدن ← خروجی ← localOnly.

### تست

```bash
npm test                 # واحد — موتور اشتراک، نرمال‌سازی شماره، BR-01، ساعت آرام، نشانگر
npm run test:e2e         # سرتاسری — نیازمند Postgres بالا
```

---

## ساختار

```
prisma/schema.prisma          اسکیما + CHECK constraintهای BR-01
prisma/seed.ts               ۳ پلن، ۶ قیمت، ۷ سقف، ۲۸ قابلیت، ادمین اول
src/common/
  errors.ts                  ۱۷ کد خطا با پیام فارسیِ قابل نمایش مستقیم
  clock.service.ts           تنها منبع زمان سرور
  envelope.interceptor.ts    { data, server_time } روی هر پاسخ
  idempotency/               Idempotency-Key → همان پاسخ با ۲۰۰ نه ۲۰۱
  rate-limit/                محدودیت نرخ روی Postgres (بدون Redis)
  phone.ts                   نرمال‌سازی شماره + ماسک برای لاگ
src/modules/
  auth/        OTP، جلسه، refresh چرخشی
  users/       حساب کاربری و حذف با مهلت ۷ روزه
  billing/     کاتالوگ، entitlements، پرداخت کارت‌به‌کارت
    domain/    موتور خالص «ارتقا فوری، تمدید/تنزل صف‌شده»
  sync/        snapshot، push (موفقیت جزئی)، pull (دلتا)
  settings/    آینهٔ تنظیمات + احترام به localOnly
  devices/     توکن اعلان و پرچم خوانده‌شدن هشدار
  notifications/ Expo push با ساعت آرام و بدون مبلغ در متن
  export/      CSV و اکسل با URL امضاشدهٔ کوتاه‌عمر
  admin/       ورود جدا، تأیید/رد پرداخت، اعطای پلن، ویرایش کاتالوگ
  maintenance/ کارهای دوره‌ای با قفل دیتابیسی
  files/       استوریج خصوصی + امضای URL
```

---

## نکته‌های امنیتی که در کد اجبار شده‌اند

* **enumeration resistance** — پاسخ `otp/request` برای شمارهٔ موجود و جدید یکی است؛ حتی **زمان پاسخ** با `OTP_REQUEST_MIN_MS` یکنواخت می‌شود و کاربر در این مرحله ساخته نمی‌شود.
* **OTP هش‌شده** با نمک مخفی سرور، مقایسهٔ **زمان‌ثابت** (`timingSafeEqual`).
* **refresh چرخشی** — استفادهٔ دوبارهٔ توکن مصرف‌شده = سرقت ⇒ باطل شدن **همهٔ** جلسه‌ها.
* **قطع جلسه فوری است** — گارد توکن در هر درخواست باطل نبودن جلسه را می‌بیند.
* **PAN کامل هیچ‌جا** — فقط ۶ رقم اول و ۴ رقم آخر، با `CHECK` در دیتابیس؛ شمارهٔ کارت در متن رسید ماسک می‌شود.
* **مالکیت در هر مسیر** — هیچ ID از URL بدون بررسی مالک پذیرفته نمی‌شود.
* **پنل ادمین کاملاً جدا** — امضای JWT جداگانه؛ توکن کاربر هیچ‌وقت مسیر ادمین را باز نمی‌کند.
* **لاگ بدون دادهٔ مالی** — فقط متد، مسیر، وضعیت و مدت؛ شماره ماسک، هیچ مبلغ و توکنی.
* **رسید در استوریج خصوصی** با URL امضاشدهٔ HMAC و کوتاه‌عمر.
* **`localOnly`** — همگام‌سازی بسته می‌شود و دادهٔ مالی موجود از سرور **پاک** می‌شود.
* **`benchmarking`** پیش‌فرض خاموش؛ سرور پیش‌فرض را عوض نمی‌کند.
* **مبلغ در متن اعلان نمی‌آید** (روی صفحهٔ قفل دیده می‌شود)، و یک فیلتر پشتیبان هر عدد پول‌مانند را حذف می‌کند.

### پیش از استقرار در تولید

1. هر چهار مقدار `JWT_*_SECRET` و `FILE_URL_SECRET` را با مقدار تصادفی ۳۲+ کاراکتری عوض کنید.
2. `SMS_DRIVER` را روی `kavenegar` یا `smsir` بگذارید — درایور `log` هیچ پیامکی نمی‌فرستد.
3. رمز ادمین seed را بعد از اولین ورود عوض کنید.
4. `SWAGGER_ENABLED=false` و `TRUST_PROXY=true` (پشت پروکسی).
5. TLS در لایهٔ پروکسی؛ HSTS از سرور اعلام می‌شود.

---

## متغیرهای محیطی

همه در [`.env.example`](.env.example) با توضیح. مهم‌ترین‌ها:

| متغیر | کار |
|---|---|
| `DATABASE_URL` | اتصال PostgreSQL |
| `SMS_DRIVER` | `log` (توسعه) · `kavenegar` · `smsir` |
| `OTP_*` | طول، اعتبار، مهلت ارسال دوباره، سقف تلاش، مدت قفل |
| `BILLING_CARD_*` | شماره کارت و نام صاحب حساب (هرگز در کد اپ) |
| `BILLING_REQUEST_TTL_HOURS` | مهلت درخواست پرداخت (۷۲) |
| `ENTITLEMENT_GRACE_DAYS` | مهلت لطف آفلاین که در `/config/app` به کلاینت گفته می‌شود (۷) |
| `PUSH_ENABLED` · `EXPO_*` | اعلان |
| `STORAGE_DIR` · `FILE_URL_SECRET` | استوریج خصوصی و امضای URL |
