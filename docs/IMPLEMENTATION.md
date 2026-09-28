# پوشش سند — چه چیزی کجا پیاده شده

جدول تطبیق بین [`API-SPEC.md`](API-SPEC.md) / [`BACKEND-SPEC.md`](BACKEND-SPEC.md) و کد.

---

## ۱. اندپوینت‌ها (§۱ سند وب‌سرویس)

| # | مسیر | فایل | وضعیت |
|---|---|---|---|
| ۱ | `POST /v1/auth/otp/request` | `modules/auth/auth.controller.ts` | ✅ |
| ۲ | `POST /v1/auth/otp/verify` | `modules/auth/auth.controller.ts` | ✅ |
| ۳ | `POST /v1/auth/token/refresh` | `modules/auth/auth.controller.ts` | ✅ چرخشی |
| ۴ | `POST /v1/auth/logout` | `modules/auth/auth.controller.ts` | ✅ ۲۰۴ |
| ۵ | `GET /v1/auth/sessions` | `modules/auth/auth.controller.ts` | ✅ |
| ۶ | `DELETE /v1/auth/sessions/{id}` | `modules/auth/auth.controller.ts` | ✅ ۲۰۴، اثر فوری |
| ۷ | `GET /v1/me` | `modules/users/users.controller.ts` | ✅ |
| ۸ | `PATCH /v1/me` | `modules/users/users.controller.ts` | ✅ شماره عوض نمی‌شود |
| ۹ | `DELETE /v1/me` | `modules/users/users.controller.ts` | ✅ ۲۰۲ + مهلت ۷ روزه |
| ۱۰ | `GET /v1/billing/plans` | `modules/billing/billing.controller.ts` | ✅ بدون توکن، ETag |
| ۱۱ | `GET /v1/billing/config` | `modules/billing/billing.controller.ts` | ✅ |
| ۱۲ | `GET /v1/me/entitlements` | `modules/billing/billing.controller.ts` | ✅ با `usage` زنده |
| ۱۳ | `POST /v1/billing/trial` | `modules/billing/billing.controller.ts` | ✅ |
| ۱۴ | `POST /v1/billing/payment-requests` | `modules/billing/billing.controller.ts` | ✅ ۲۰۱/۲۰۰ |
| ۱۵ | `GET /v1/billing/payment-requests` | `modules/billing/billing.controller.ts` | ✅ صفحه‌بندی |
| ۱۶ | `GET /v1/billing/payment-requests/{id}` | `modules/billing/billing.controller.ts` | ✅ |
| ۱۷ | `POST …/{id}/receipt` | `modules/billing/billing.controller.ts` | ✅ JSON و multipart |
| ۱۸ | `POST …/{id}/cancel` | `modules/billing/billing.controller.ts` | ✅ no-op با ۲۰۰ |
| ۱۹ | `GET /v1/sync/snapshot` | `modules/sync/sync.controller.ts` | ✅ |
| ۲۰ | `POST /v1/sync/push` | `modules/sync/sync.controller.ts` | ✅ موفقیت جزئی |
| ۲۱ | `GET /v1/sync/pull` | `modules/sync/sync.controller.ts` | ✅ ۴۱۰ روی نشانگر کهنه |
| ۲۲ | `GET /v1/settings` | `modules/settings/settings.controller.ts` | ✅ |
| ۲۳ | `PUT /v1/settings` | `modules/settings/settings.controller.ts` | ✅ |
| ۲۴ | `POST /v1/devices/push-token` | `modules/devices/devices.controller.ts` | ✅ |
| ۲۵ | `POST /v1/alerts/read` | `modules/devices/devices.controller.ts` | ✅ |
| ۲۶ | `POST /v1/export` | `modules/export/export.controller.ts` | ✅ csv و xlsx |
| ۲۷ | `GET /v1/config/app` | `modules/config/config.controller.ts` | ✅ بدون توکن |

### پنل ادمین

| مسیر | وضعیت |
|---|---|
| `POST /v1/admin/auth/login` | ✅ ایمیل/رمز، JWT جدا (افزودهٔ لازم) |
| `POST /v1/admin/admins` | ✅ ساخت ادمین (افزودهٔ لازم) |
| `GET /v1/admin/payment-requests?status=pending` | ✅ با رسید و شمارهٔ ماسک‌شده |
| `POST /v1/admin/payment-requests/{id}/approve` | ✅ موتور §۵.۱۰ + اعلان |
| `POST /v1/admin/payment-requests/{id}/reject` | ✅ دلیل اجباری |
| `POST /v1/admin/users/{id}/grant` | ✅ `source: admin_grant` |
| `GET /v1/admin/users` | ✅ جستجو (افزودهٔ لازم برای grant) |
| `PUT /v1/admin/billing/catalog` | ✅ `catalog_version` بالا می‌رود |

### افزوده‌های فراتر از سند

`GET /v1/files` — تحویل فایل خصوصی با URL امضاشده. سند §۵.۸ و §۹.۱ «URL امضاشدهٔ کوتاه‌عمر» می‌خواهد ولی مسیر تحویلش را نام نمی‌برد.

---

## ۲. چک‌لیست پذیرش §۱۱ — بند به بند

### ورود

| بند | کجا سنجیده شده |
|---|---|
| ورود با شماره در هر قالبی | `common/phone.spec.ts` (۱۱ تست) · `auth.e2e-spec.ts` |
| پاسخ `otp/request` برای موجود و جدید قابل تشخیص نیست | `auth.e2e-spec.ts` — شکل، وضعیت و کلیدهای بدنه مقایسه می‌شوند |
| ۵ تلاش غلط → قفل ۱۵ دقیقه با `retry_after` | `auth.e2e-spec.ts` |
| refresh چرخشی؛ توکن کهنه همهٔ جلسه‌ها را می‌بندد | `auth.e2e-spec.ts` |
| قطع جلسهٔ دستگاه دیگر فوراً اثر می‌کند | `auth.e2e-spec.ts` |

### آفلاین

| بند | کجا |
|---|---|
| هیچ اندپوینتی در مسیر رندر نیست | همهٔ مسیرها `کش`/`نرم`/`صف`؛ ETag روی کاتالوگ |
| ارسال دوبارهٔ همان دسته رکورد تکراری نمی‌سازد | `sync-billing.e2e-spec.ts` — ۴ بار ارسال، یک ردیف |
| `Idempotency-Key` تکراری همان نتیجه با ۲۰۰ | `sync-billing.e2e-spec.ts` |
| entitlement کش‌شده در آفلاین معتبر است | `entitlement_grace_days` در `/config/app`؛ منطق مهلت لطف کار کلاینت است |
| `401` واقعی تنها دلیل بیرون کردن کاربر | فقط `token_expired`/`token_revoked` ۴۰۱ می‌دهند؛ خطای شبکه هیچ‌وقت ۴۰۱ نمی‌شود |

> **نکته**: بند «با خاموش کردن کامل شبکه هر ۲۷ صفحه کار می‌کند» رفتار **کلاینت** است و روی اپ آزمایش می‌شود. سمت سرور، شرط لازمش این است که هیچ مسیری در مسیر حیاتی رندر نباشد و همهٔ نوشتن‌ها idempotent باشند — که هست.

### پلن و پرداخت

| بند | کجا |
|---|---|
| هیچ قیمت/سقف/قابلیتی در کلاینت نیست | کاتالوگ کامل از دیتابیس؛ `prisma/seed.ts` |
| درخواست pending تکراری ساخته نمی‌شود | `sync-billing.e2e-spec.ts` |
| `ref_code` هیچ `0/O/1/I/L` ندارد | `billing.spec.ts` (۱۰۰۰ تولید) + `CHECK` در دیتابیس |
| ارتقا فوری، تمدید/تنزل صف‌شده | `billing.spec.ts` (۶ تست مرزی) · `scripts/smoke.sh` مرحلهٔ ۱۹–۲۰ |
| صفحهٔ وضعیت فرقشان را می‌گوید | `queued`/`starts_at`/`ends_at` روی خود درخواست ذخیره می‌شود |
| دورهٔ آزمایشی دوبار داده نمی‌شود | `sync-billing.e2e-spec.ts` |
| عوض کردن تاریخ گوشی دوره را کِش نمی‌دهد | `ClockService` تنها منبع زمان؛ `server_time` در هر پاسخ |

### داده

| بند | کجا |
|---|---|
| انتقال در هیچ aggregate سروری شمرده نمی‌شود | `CHECK` دیتابیس · `payload.spec.ts` · `export.service.ts` فقط `type: expense` |
| هیچ جمع مشتقی ذخیره یا ارسال نمی‌شود | ستون‌ها وجود ندارند · `sync-billing.e2e-spec.ts` غیبتشان را می‌سنجد |
| هیچ PAN کاملی در دیتابیس و لاگ نیست | `CHECK` روی `card_last4`/`card_bin` · ماسک در متن رسید · لاگ بدون بدنه |
| `localOnly` روشن → هیچ دادهٔ مالی در سرور | `sync-billing.e2e-spec.ts` — سه مسیر ۴۰۳ و ردیف‌ها صفر |
| همهٔ `message`های خطا فارسی و قابل نمایش | `common/errors.ts` · `validation.pipe.ts` · تست‌ها الگوی فارسی را می‌سنجند |

---

## ۳. الزامات امنیتی §۱۰

| # | الزام | پیاده‌سازی |
|---|---|---|
| ۱ | TLS 1.2+ و HSTS | HSTS با `helmet` در `main.ts`؛ TLS در لایهٔ پروکسی |
| ۲ | OTP هش‌شده، مقایسه زمان‌ثابت | `otp.service.ts` — sha256 با نمک مخفی، `timingSafeEqual` |
| ۳ | refresh چرخشی، استفادهٔ دوباره ⇒ باطل کردن همه | `token.service.ts` |
| ۴ | PAN کامل هیچ‌جا | `CHECK` دیتابیس + ماسک `PAN_LIKE` در `payment-requests.service.ts` |
| ۵ | پاسخ OTP enumeration-resistant | شکل، وضعیت و **زمان** یکسان؛ کاربر در `request` ساخته نمی‌شود |
| ۶ | rate limit روی شماره **و** IP | `rate-limit/` روی Postgres؛ هر دو سطل در `otp.service.ts` |
| ۷ | لاگ بدون دادهٔ مالی | `request-log.interceptor.ts` فقط متد/مسیر/وضعیت/مدت؛ `maskPhone` |
| ۸ | مجوزدهی بر مبنای مالکیت | `findOwned` در پرداخت؛ کلید مرکب `(userId, id)` در کل دادهٔ مالی |
| ۹ | تأیید پرداخت فقط سرور، فقط ادمین | `AdminGuard` با امضای JWT جداگانه؛ هیچ مسیر کاربری entitlement را عوض نمی‌کند |
| ۱۰ | رسید در استوریج خصوصی با URL امضاشده | `files/storage.service.ts` — HMAC، عمر ۱۵ دقیقه، مقایسهٔ زمان‌ثابت |
| ۱۱ | `localOnly` و `benchmarking` محترم و محافظه‌کارانه | پیش‌فرض `false`؛ `localOnly` دادهٔ سرور را پاک می‌کند |
| ۱۲ | حذف حساب کامل بعد از مهلت | `users.service.ts` + کار ساعتی `maintenance/` — فایل رسید هم پاک می‌شود |

---

## ۴. تصمیم‌های پیاده‌سازی که سند باز گذاشته بود

| موضوع | تصمیم | دلیل |
|---|---|---|
| کش و قفل | **بدون Redis**، همه روی Postgres | یک وابستگی کمتر در استقرار محلی؛ `INSERT … ON CONFLICT` برای چنداینستنسی کافی است |
| شناسهٔ ردیف‌های مالی | کلید مرکب `(user_id, id)` | شناسه را کلاینت می‌سازد و یکتایی فقط در دامنهٔ همان کاربر معنا دارد؛ جداسازی داده را هم در سطح کلید اجبار می‌کند |
| `sync_cursor` | `seq` از جدول `change_log` با قالب `c_NNNNNN` | برای کلاینت مات است، پس پیاده‌سازی بعداً بدون شکستن اپ منتشرشده عوض می‌شود |
| سقف پلن | فقط روی **ساخت**، نه ویرایش/حذف | کاربری که پلنش تمام شده باید بتواند دادهٔ موجودش را ویرایش و حذف کند |
| هش OTP | sha256 با نمک مخفی، نه bcrypt | bcrypt زمان اجرای متغیر دارد و همان کانال جانبی‌ای را باز می‌کند که §۱۰ بند ۲ می‌خواهد ببندد؛ کد ۱۲۰ ثانیه عمر دارد |
| ورود ادمین | ایمیل/رمز با امضای JWT جدا | اگر نقش ادمین روی جریان OTP می‌نشست، دسترسی به یک سیم‌کارت برای عوض کردن entitlement همه کافی بود |
| `recurring` در sync | موجودیت همگام‌شو اضافه شد | سند سقف `recurring.max` دارد، پس سرور باید بتواند بشمارد |
| خروجی PDF | `feature_not_available` با پیام «به‌زودی» | کلید `export.pro_formats` باز است ولی تولیدکنندهٔ PDF فارسی/RTL ساخته نشده؛ پیام صریح بهتر از فایل خرابِ بدون شکل حروف است |

---

## ۵. آنچه هنوز نیست

| مورد | وضعیت |
|---|---|
| **موتور ارزیابی هشدار سمت سرور** | `NotificationsService.sendAlert` کامل است (احترام به `settings.alerts`، ساعت آرام، حذف مبلغ از متن) و تصمیم ادمین روی پرداخت push می‌فرستد. اما سند هیچ اندپوینت یا زمان‌بندی‌ای برای **تولید** هشدار تعریف نکرده — چون «تولید بینش و هشدار محلی است» (§۴.۶). قدم بعدی طبیعی: یک کار زمان‌بندی‌شده که `budgetNear`/`budgetOver`/`recurringDue` را از دادهٔ همگام‌شده بسنجد. |
| **خروجی PDF** | بالا توضیح داده شد. |
| **قابلیت‌های `soon`** | AI، OCR، خانوادگی، پیش‌بینی — در ماتریس ثبت شده‌اند با `soon: true` تا UI برچسب «به‌زودی» بزند و **پنهان نکند**. فاز ۵. |
| **`benchmarking` تجمیعی** | پرچمش ذخیره و محترم شمرده می‌شود؛ خط لولهٔ تجمیع بی‌نام هنوز مصرف‌کننده‌ای ندارد. |
