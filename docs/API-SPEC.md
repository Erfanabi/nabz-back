# نبض — سند وب‌سرویس‌ها

> فهرست کامل endpointهای مورد نیاز اپ.
> بافت محصول و قواعد کسب‌وکار در [`BACKEND-SPEC.md`](BACKEND-SPEC.md).

---

## ۱. فهرست سریع

| # | متد | مسیر | نیاز به توکن | آفلاین؟ |
|---|---|---|---|---|
| ۱ | `POST` | `/v1/auth/otp/request` | ❌ | ✅ اینترنت لازم |
| ۲ | `POST` | `/v1/auth/otp/verify` | ❌ | ✅ اینترنت لازم |
| ۳ | `POST` | `/v1/auth/token/refresh` | refresh | نرم |
| ۴ | `POST` | `/v1/auth/logout` | ✅ | نرم |
| ۵ | `GET` | `/v1/auth/sessions` | ✅ | نرم |
| ۶ | `DELETE` | `/v1/auth/sessions/{id}` | ✅ | نرم |
| ۷ | `GET` | `/v1/me` | ✅ | کش |
| ۸ | `PATCH` | `/v1/me` | ✅ | نرم |
| ۹ | `DELETE` | `/v1/me` | ✅ | — |
| ۱۰ | `GET` | `/v1/billing/plans` | اختیاری | کش |
| ۱۱ | `GET` | `/v1/billing/config` | ✅ | کش |
| ۱۲ | `GET` | `/v1/me/entitlements` | ✅ | کش + grace |
| ۱۳ | `POST` | `/v1/billing/trial` | ✅ | نرم |
| ۱۴ | `POST` | `/v1/billing/payment-requests` | ✅ | نرم (idempotent) |
| ۱۵ | `GET` | `/v1/billing/payment-requests` | ✅ | کش |
| ۱۶ | `GET` | `/v1/billing/payment-requests/{id}` | ✅ | کش |
| ۱۷ | `POST` | `/v1/billing/payment-requests/{id}/receipt` | ✅ | نرم |
| ۱۸ | `POST` | `/v1/billing/payment-requests/{id}/cancel` | ✅ | نرم |
| ۱۹ | `GET` | `/v1/sync/snapshot` | ✅ | — |
| ۲۰ | `POST` | `/v1/sync/push` | ✅ | صف |
| ۲۱ | `GET` | `/v1/sync/pull` | ✅ | نرم |
| ۲۲ | `GET` | `/v1/settings` | ✅ | کش |
| ۲۳ | `PUT` | `/v1/settings` | ✅ | نرم |
| ۲۴ | `POST` | `/v1/devices/push-token` | ✅ | نرم |
| ۲۵ | `POST` | `/v1/alerts/read` | ✅ | صف |
| ۲۶ | `POST` | `/v1/export` | ✅ | — |
| ۲۷ | `GET` | `/v1/config/app` | ❌ | کش |

**راهنمای ستون «آفلاین»**

* `اینترنت لازم` — تنها موردی که بدون شبکه کار نمی‌کند (ورود).
* `نرم` — اگر شبکه نبود، فراخوانی بی‌صدا رد می‌شود یا در صف می‌ماند. **هیچ خطایی به کاربر نشان داده نمی‌شود.**
* `کش` — آخرین پاسخ موفق در حالت آفلاین استفاده می‌شود.
* `صف` — در صف idempotent می‌نشیند و بعداً ارسال می‌شود.

### endpointهای پنل ادمین (جدا)

| متد | مسیر | کار |
|---|---|---|
| `GET` | `/v1/admin/payment-requests?status=pending` | فهرست درخواست‌های در انتظار |
| `POST` | `/v1/admin/payment-requests/{id}/approve` | تأیید واریزی |
| `POST` | `/v1/admin/payment-requests/{id}/reject` | رد با دلیل |
| `POST` | `/v1/admin/users/{id}/grant` | اعطای دستی پلن (`source: admin_grant`) |
| `PUT` | `/v1/admin/billing/catalog` | ویرایش پلن، قیمت، سقف و ماتریس قابلیت |

---

## ۲. قواعد عمومی

### ۲.۱ Base URL و نسخه

```
https://api.nabz.ir/v1
```

نسخه در مسیر. تغییر شکسته = `/v2`. اپ منتشرشده هرگز نباید با تغییر سرور بشکند.

### ۲.۲ هدرها

**درخواست:**

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept-Language: fa-IR
X-Client: nabz-app/1.0.0 (android 14)
X-Device-Id: <شناسهٔ پایدار دستگاه، تولید کلاینت>
X-Request-Id: <uuid، برای پیگیری در لاگ>
Idempotency-Key: <uuid>        # فقط روی POSTهای نوشتنی
```

**پاسخ:** هر پاسخ موفق باید `server_time` داشته باشد.

```json
{ "data": { }, "server_time": "2026-09-25T10:00:00Z" }
```

`server_time` اجباری است — کلاینت اختلاف ساعت را یک‌بار حساب می‌کند و همهٔ
محاسبه‌های «روزهای باقی‌مانده» از آن می‌گذرد. بدون این، کاربر با عوض کردن
تاریخ گوشی می‌تواند دوره را کِش بدهد.

### ۲.۳ قواعد نوع داده

| چیز | قاعده |
|---|---|
| پول | تومان، **integer**. بدون اعشار، بدون رشته. |
| تاریخ | ISO 8601 با timezone، یا epoch milliseconds. **هرگز رشتهٔ جلالی.** |
| ارقام | همیشه لاتین. تبدیل فارسی کار کلاینت است. |
| شناسه | UUID v4، **تولید کلاینت** برای موجودیت‌های مالی. |
| شماره موبایل | نرمال‌شده: `09xxxxxxxxx` |
| `null` vs غایب | `null` = «مقدار ندارد» (مثلاً سقف نامحدود). فیلد غایب = تغییر نکرده. |

### ۲.۴ ساختار خطا

```json
{
  "error": {
    "code": "otp_invalid",
    "message": "کد وارد شده درست نیست.",
    "message_en": "Invalid code.",
    "fields": { "code": "کد ۶ رقمی است." },
    "retry_after": 45
  },
  "server_time": "2026-09-25T10:00:00Z"
}
```

* `message` **فارسی، انسانی و قابل نمایش مستقیم** است. اپ آن را همان‌طور نشان
  می‌دهد، پس `field required` قابل قبول نیست.
* `code` ماشین‌خوان و ثابت است؛ کلاینت روی آن شرط می‌گذارد نه روی `message`.
* `retry_after` ثانیه، روی ۴۲۹ و روی قفل OTP.

**کدهای خطای لازم:**

`otp_invalid` · `otp_expired` · `otp_locked` · `phone_invalid` ·
`rate_limited` · `token_expired` · `token_revoked` · `unauthorized` ·
`forbidden` · `not_found` · `validation_failed` · `plan_limit_reached` ·
`feature_not_available` · `payment_request_expired` · `trial_already_used` ·
`sync_conflict` · `server_error`

### ۲.۵ محدودیت نرخ (Rate limit)

| مسیر | سقف |
|---|---|
| `/auth/otp/request` | ۳ بار در ۱۰ دقیقه بر شماره، ۱۰ بار در ساعت بر IP |
| `/auth/otp/verify` | ۵ تلاش، بعد قفل ۱۵ دقیقه |
| `/sync/push` | ۶۰ بار در دقیقه بر کاربر |
| بقیه | ۱۲۰ بار در دقیقه بر کاربر |

پاسخ ۴۲۹ با `retry_after`.

### ۲.۶ الزام آفلاین برای همهٔ endpointها

> **هیچ endpointی نباید در مسیر رندر یک صفحه باشد.**
> کلاینت با timeout کوتاه (۸ ثانیه) صدا می‌زند و اگر نرسید، بی‌صدا از کش یا
> از حالت محلی ادامه می‌دهد. خطای شبکه هرگز به کاربر نشان داده نمی‌شود.

پیامد: همهٔ `POST`های نوشتنی باید **idempotent** باشند و `Idempotency-Key`
را محترم بدارند — تکرار همان کلید نباید عمل را دوباره اجرا کند، باید همان
نتیجهٔ قبلی را برگرداند (با `200` نه `201`).

---

## ۳. احراز هویت

### ۳.۱ `POST /v1/auth/otp/request`

```json
// درخواست
{ "phone": "09121234567", "device_id": "..." }

// پاسخ 200 — برای شمارهٔ موجود و جدید یکسان
{
  "data": {
    "sent": true,
    "otp_length": 6,
    "expires_in": 120,
    "resend_after": 60,
    "attempts_allowed": 5
  },
  "server_time": "..."
}
```

> ⚠ **enumeration resistance**: پاسخ نباید هیچ نشانه‌ای از وجود یا نبود حساب
> بدهد — نه فیلد `is_new_user`، نه کد وضعیت متفاوت، نه زمان پاسخ متفاوت.

> پارامترهای `otp_length`، `expires_in`، `resend_after` از سرور می‌آیند تا
> بعداً بدون انتشار نسخهٔ جدید اپ قابل تغییر باشند.

### ۳.۲ `POST /v1/auth/otp/verify`

```json
// درخواست
{ "phone": "09121234567", "code": "123456", "device_id": "...",
  "device_name": "Pixel 8" }

// پاسخ 200
{
  "data": {
    "access_token": "...",
    "access_expires_in": 900,
    "refresh_token": "...",
    "refresh_expires_in": 2592000,
    "user": { "id": "...", "phone": "09121234567",
              "created_at": "...", "is_new": true },
    "entitlements": { }
  },
  "server_time": "..."
}
```

`is_new` فقط برای نمایش آنبوردینگ است و **بعد از** تأیید موفق می‌آید،
پس enumeration نمی‌سازد.

`entitlements` همین‌جا برگردد تا اپ یک round-trip کمتر بزند و بلافاصله
آفلاین‌پذیر شود.

**خطاها:** `otp_invalid` (۴۰۱) · `otp_expired` (۴۱۰) · `otp_locked` (۴۲۳ با
`retry_after`) — هیچ‌کدام نباید بگویند شماره ثبت بود یا نه.

> مقایسهٔ کد **زمان‌ثابت**. OTP در دیتابیس **هش‌شده** نگه داشته می‌شود، نه خام.

### ۳.۳ `POST /v1/auth/token/refresh`

```json
{ "refresh_token": "..." }
```

**refresh token چرخشی است**: هر بار refresh، توکن قبلی باطل و توکن تازه صادر
می‌شود. اگر یک توکن باطل‌شده دوباره استفاده شد → **همهٔ جلسه‌های آن کاربر باطل
می‌شوند** (تشخیص سرقت توکن).

خطا: `token_expired` / `token_revoked` (۴۰۱) → کلاینت کاربر را به صفحهٔ ورود
می‌برد. این تنها حالتی است که کلاینت به‌خاطر شبکه کاربر را بیرون می‌کند، و شرطش
**پاسخ صریح ۴۰۱ از سرور** است — نه timeout، نه قطع اتصال.

### ۳.۴ `POST /v1/auth/logout`

`{ "refresh_token": "..." }` → ۲۰۴. فقط همین جلسه.
دادهٔ محلی پاک نمی‌شود (کار کلاینت است و به کاربر گفته می‌شود).

### ۳.۵ `GET /v1/auth/sessions`

```json
{
  "data": [
    { "id": "s_1", "device_name": "همین دستگاه", "platform": "android",
      "city": "تهران", "last_active_at": "...", "created_at": "...",
      "is_current": true }
  ]
}
```

### ۳.۶ `DELETE /v1/auth/sessions/{id}`

۲۰۴. جلسهٔ آن دستگاه فوراً باطل می‌شود (refresh آن دستگاه از این به بعد ۴۰۱).
حذف جلسهٔ جاری = logout.

---

## ۴. حساب کاربری

### ۴.۱ `GET /v1/me`

```json
{ "data": { "id": "...", "phone": "09121234567",
            "display_name": null, "created_at": "..." } }
```

### ۴.۲ `PATCH /v1/me`

`{ "display_name": "سارا" }` — فقط فیلدهای فرستاده‌شده تغییر می‌کنند.
تغییر شماره موبایل از این مسیر **ممنوع** است؛ اگر لازم شد، جریان OTP جداگانه.

### ۴.۳ `DELETE /v1/me`

حذف حساب. `{ "confirm": true }`.
پاسخ ۲۰۲ با `deletion_scheduled_at` (مهلت ۷ روزه برای پشیمانی).
بعد از مهلت، حذف **کامل و برگشت‌ناپذیر** داده.

---

## ۵. پلن و پرداخت

### ۵.۱ `GET /v1/billing/plans`

**کل کاتالوگ** در یک پاسخ. کلاینت هیچ قیمت، سقف یا قابلیتی hard-code نمی‌کند.

```json
{
  "data": {
    "catalog_version": 7,
    "plans": [
      { "key": "free", "title": "رایگان", "tier": 0,
        "is_purchasable": false, "pitch": "هستهٔ نبض، برای شروع",
        "highlights": ["ثبت نامحدود تراکنش", "داشبورد و گزارش ماهانه", "خروجی CSV"] },
      { "key": "plus", "title": "پلاس", "tier": 1, "is_purchasable": true,
        "pitch": "سقف‌های بازتر، گزارش و تحلیل کامل",
        "highlights": ["گزارش سالانه و مقایسهٔ دوره", "همهٔ هشدارها و بینش‌ها", "خروجی اکسل و PDF"] },
      { "key": "pro", "title": "پرو", "tier": 2, "is_purchasable": false,
        "pitch": "همه‌چیز، بدون سقف، به‌علاوهٔ هوش مصنوعی",
        "highlights": ["بدون هیچ سقفی", "پیش‌بینی و تحلیل الگو", "دستیار هوشمند و اسکن رسید"] }
    ],
    "durations": [30, 90, 365],
    "prices": {
      "plus": { "30": 49000, "90": 129000, "365": 449000 },
      "pro":  { "30": 99000, "90": 259000, "365": 899000 }
    },
    "limits": {
      "accounts.max": { "label": "حساب و کیف پول", "free": 2, "plus": 5, "pro": null },
      "categories.custom.max": { "label": "دستهٔ اختصاصی", "free": 3, "plus": 15, "pro": null },
      "budgets.max": { "label": "بودجهٔ فعال", "free": 3, "plus": null, "pro": null },
      "goals.max": { "label": "هدف فعال", "free": 1, "plus": 5, "pro": null },
      "recurring.max": { "label": "تراکنش تکرارشونده", "free": 3, "plus": 15, "pro": null },
      "ai.messages_per_month": { "label": "پیام دستیار هوشمند", "free": 0, "plus": 0, "pro": 150, "soon": true },
      "ai.ocr_per_month": { "label": "اسکن رسید", "free": 0, "plus": 0, "pro": 30, "soon": true }
    },
    "features": [
      { "key": "tx.entry", "label": "ثبت هزینه، درآمد و انتقال", "free": 1, "plus": 1, "pro": 1 },
      { "key": "reports.yearly", "label": "گزارش سالانه", "free": 0, "plus": 1, "pro": 1 },
      { "key": "forecasting", "label": "پیش‌بینی مالی", "free": 0, "plus": 0, "pro": 1, "soon": true }
    ]
  }
}
```

* `null` در سقف = **نامحدود**. صفر = بسته.
* `soon: true` = کلید ثبت شده، قابلیت ساخته نشده. UI برچسب «به‌زودی» می‌زند و
  **پنهان نمی‌کند**.
* `catalog_version` برای بی‌اعتبار کردن کش.
* فهرست کامل ۲۸ قابلیت و ۷ سقف در
  [`src/domain/billing.ts`](../src/domain/billing.ts).
* بدون توکن هم قابل فراخوانی باشد (صفحهٔ پلن‌ها ممکن است قبل از ورود دیده شود).
* `Cache-Control` بلند + `ETag`.

### ۵.۲ `GET /v1/billing/config`

اطلاعات پرداخت کارت‌به‌کارت — **هرگز در کد اپ ثابت نمی‌شود**.

```json
{
  "data": {
    "card_number": "6037997512345678",
    "card_holder": "شرکت نبض",
    "receipt_contact_phone": "09120000000",
    "receipt_channels": ["sms", "telegram", "whatsapp"],
    "payment_providers": ["manual_card"],
    "trial_days": 30,
    "request_ttl_hours": 72
  }
}
```

### ۵.۳ `GET /v1/me/entitlements`

پاسخ این endpoint **شکل مرجع** وضعیت اشتراک کاربر است.

```json
{
  "data": {
    "effective_plan": "pro",
    "source": "trial",
    "expires_at": 1738000000000,
    "trial_used": true,
    "queued": [
      { "plan_key": "plus", "starts_at": 1738000000000, "expires_at": 1740592000000 }
    ],
    "usage": {
      "accounts.max": 3,
      "categories.custom.max": 4,
      "budgets.max": 3,
      "goals.max": 2,
      "recurring.max": 2
    }
  }
}
```

* `source`: `trial` | `purchase` | `admin_grant`
* `expires_at`: epoch ms. برای پلن رایگانِ بی‌انقضا `null`.
* `usage`: مصرف فعلی هر سقف. کلاینت با آن «۳ از ۵ حساب» را نشان می‌دهد.
* `queued`: پلن‌هایی که خریده شده‌اند و پشت دورهٔ فعلی صف‌اند (بخش ۵.۵ سند پروژه).

**قاعدهٔ آفلاین:** کلاینت این پاسخ را کش می‌کند. اگر آفلاین بود، کش معتبر است تا
`expires_at` **+ ۷ روز مهلت لطف**. بعد از آن اپ به `free` برمی‌گردد — بی‌صدا،
بدون صفحهٔ خطا. یعنی قطع اینترنت هیچ‌وقت قابلیت پول‌داده‌شده را وسط کار نمی‌بندد.

### ۵.۴ `POST /v1/billing/trial`

شروع دورهٔ آزمایشی. بدنه خالی.
خطا: `trial_already_used` (۴۰۹).
پاسخ: entitlements تازه.

### ۵.۵ `POST /v1/billing/payment-requests`

```json
// درخواست
{ "plan_key": "plus", "duration_days": 90, "provider": "manual_card" }

// پاسخ 201 (یا 200 اگر درخواست pending مشابه از قبل بود)
{
  "data": {
    "id": "pr_a1b2c3d",
    "plan_key": "plus",
    "duration_days": 90,
    "amount_toman": 129000,
    "ref_code": "K7M2QX",
    "provider": "manual_card",
    "status": "pending",
    "created_at": 1735000000000,
    "expires_at": 1735259200000,
    "reject_reason": null
  }
}
```

**قواعد الزامی:**

1. اگر درخواست `pending` با **همان `plan_key` و همان `duration_days`** وجود
   دارد، درخواست تازه ساخته **نمی‌شود**؛ همان قبلی با `200` برمی‌گردد.
   دو کد پیگیری برای یک واریز یعنی ادمین نمی‌داند کدام را تأیید کند.
2. `ref_code` ۶ کاراکتر از الفبای `23456789ABCDEFGHJKMNPQRSTUVWXYZ`
   (**بدون `0/O` و `1/I/L`**) — کاربر باید آن را از صفحه بخواند و تایپ کند.
3. `amount_toman` را **سرور** از کاتالوگ می‌خواند. مبلغ فرستاده‌شدهٔ کلاینت
   اگر بود، نادیده گرفته می‌شود.
4. `expires_at = created_at + request_ttl_hours` (۷۲ ساعت).
5. اگر `plan.is_purchasable == false` → `forbidden` (۴۰۳).
6. `Idempotency-Key` محترم شمرده شود.

### ۵.۶ `GET /v1/billing/payment-requests`

`?status=pending|approved|rejected|cancelled&limit=&cursor=`
تاریخچهٔ پرداخت (صفحهٔ S-123). آرایه‌ای از همان شکل بالا، به‌علاوهٔ فیلدهای
تصمیم: `decided_at`, `queued`, `starts_at`, `ends_at`.

### ۵.۷ `GET /v1/billing/payment-requests/{id}`

صفحهٔ وضعیت (S-122). کلاینت این را **polling** می‌کند (هر ۱۵ ثانیه تا ۵ دقیقه،
بعد on-focus). بهتر: push notification روی تصمیم ادمین.

پاسخ تأییدشده:

```json
{
  "data": {
    "id": "pr_a1b2c3d", "status": "approved",
    "decided_at": 1735003000000,
    "queued": true,
    "starts_at": 1738000000000,
    "ends_at": 1745776000000
  }
}
```

> `queued` اجباری است. صفحهٔ وضعیت باید فرق «الان فعال شد» و «بعد از پایان
> دورهٔ فعلی شروع می‌شود» را بگوید؛ قاطی کردنشان یعنی دروغ به کاربر.

### ۵.۸ `POST /v1/billing/payment-requests/{id}/receipt`

اعلام ارسال رسید.

```json
{ "channel": "telegram", "note": "واریز از کارت ۶۰۳۷…۱۲۳۴ ساعت ۱۴:۳۰" }
```

> ⚠ اگر آپلود تصویر رسید اضافه شد: `multipart/form-data`، سقف ۵ مگابایت، فقط
> `image/jpeg|png|webp|application/pdf`. تصویر رسید **داده حساس** است —
> در استوریج خصوصی با URL امضاشدهٔ کوتاه‌عمر، نه در bucket عمومی.
> **PAN کامل هرگز در متن یا متادیتا ذخیره نشود** (فقط ۴ رقم آخر).

### ۵.۹ `POST /v1/billing/payment-requests/{id}/cancel`

لغو توسط کاربر. فقط روی `pending` اثر دارد؛ روی بقیه no-op با ۲۰۰.

### ۵.۱۰ منطق تأیید (سمت سرور)

پیاده‌سازی مرجع در [`src/domain/billing.ts`](../src/domain/billing.ts)
(تابع `approve`). خلاصه:

```
tier_buying = plan(request.plan_key).tier
tier_current = plan(me.effective_plan).tier
active_now = me.expires_at > server_now()

queue = active_now AND tier_current >= tier_buying

starts_at  = queue ? me.expires_at : server_now()
expires_at = starts_at + duration_days * 86400000

اگر queue:  به me.queued اضافه شود، effective_plan دست نخورد
وگرنه:      effective_plan = plan_key، source = 'purchase', expires_at = ...
```

یعنی: **ارتقا فوری، تمدید یا تنزل صف‌شده**. روز پولی کاربر هدر نمی‌رود.

> تأیید پرداخت **فقط سمت سرور و به‌دست ادمین**. هیچ endpoint کاربری نباید
> بتواند entitlement را عوض کند. `approveRequest` در کلاینت فقط برای دیدن حالت
> «تأیید شد» در پروتوتایپ است و با آمدن سرور حذف می‌شود.

---

## ۶. همگام‌سازی (Sync)

قلب الزام offline-first. مدل: **snapshot یک‌بار، بعد دلتای دوطرفه**.

### ۶.۱ `GET /v1/sync/snapshot`

کل داده در یک پاسخ. کلاینت این را بعد از ورود روی دستگاه جدید می‌گیرد.

```json
{
  "data": {
    "sync_cursor": "c_000871",
    "accounts": [
      { "id": "uuid", "name": "بانک ملت", "icon": "bank", "balance": 42500000,
        "card": { "bin": "610433", "last4": "1234", "expiry": "07/29",
                  "bank": "ملت", "tone": "rose" },
        "updated_at": 1735000000000, "deleted_at": null }
    ],
    "categories": [
      { "id": "uuid", "name": "خوراک", "icon": "food", "color": "amber",
        "custom": false, "order": 1,
        "updated_at": 1735000000000, "deleted_at": null }
    ],
    "transactions": [
      { "id": "uuid", "type": "expense", "amount": 185000, "name": "نان",
        "note": null, "category": "cat-uuid", "account": "acc-uuid",
        "occurred_at": "2026-09-25T09:10:00Z",
        "updated_at": 1735000000000, "deleted_at": null },
      { "id": "uuid", "type": "transfer", "amount": 5000000, "name": "انتقال",
        "from": "acc-uuid-1", "to": "acc-uuid-2",
        "occurred_at": "2026-09-24T12:00:00Z",
        "updated_at": 1735000000000, "deleted_at": null }
    ],
    "budgets": [
      { "id": "uuid", "category": "cat-uuid", "limit": 4000000,
        "updated_at": 1735000000000, "deleted_at": null }
    ],
    "goals": [
      { "id": "uuid", "name": "سفر", "target": 80000000, "current": 32000000,
        "months": 6, "updated_at": 1735000000000, "deleted_at": null }
    ],
    "alerts_read": ["alert-uuid-1", "alert-uuid-2"]
  }
}
```

**نکته‌های الزامی:**

* انتقال **`category` و `account` ندارد** و درآمد/هزینه **`from`/`to` ندارد**.
  اسکیما باید این را اجبار کند (BR-01).
* `budget.spent`، `goal.monthlyNeed`، `goal.status` و کل `summary`
  **ارسال نمی‌شوند** — مشتق‌اند و کلاینت خودش می‌سازد (BR-02 / P6).
  اگر سرور آن‌ها را بفرستد، دو منبع حقیقت می‌شود و از هم جدا می‌افتند.
* `occurred_at` تاریخ رخداد (ISO با timezone). گروه‌بندی روزانه و برچسب جلالی
  کار کلاینت است.
* `deleted_at` برای tombstone.
* اگر داده زیاد شد: صفحه‌بندی با `?cursor=` و پرچم `has_more`.

### ۶.۲ `POST /v1/sync/push`

صف تغییرات محلی. **مهم‌ترین endpoint برای offline-first.**

```json
{
  "base_cursor": "c_000871",
  "ops": [
    { "op_id": "uuid-1", "entity": "transaction", "action": "create",
      "client_updated_at": 1735000100000,
      "payload": { "id": "tx-uuid", "type": "expense", "amount": 185000,
                   "name": "نان", "category": "cat-uuid",
                   "account": "acc-uuid", "occurred_at": "2026-09-25T09:10:00Z" } },
    { "op_id": "uuid-2", "entity": "transaction", "action": "delete",
      "client_updated_at": 1735000200000, "payload": { "id": "tx-uuid-old" } }
  ]
}
```

پاسخ:

```json
{
  "data": {
    "sync_cursor": "c_000895",
    "results": [
      { "op_id": "uuid-1", "status": "applied" },
      { "op_id": "uuid-2", "status": "duplicate" },
      { "op_id": "uuid-3", "status": "rejected",
        "code": "plan_limit_reached",
        "message": "برای حساب بیشتر باید پلن را ارتقا بدهی." },
      { "op_id": "uuid-4", "status": "conflict",
        "server_version": { } }
    ]
  }
}
```

**قواعد الزامی:**

1. **Idempotency بر `op_id`**: `op_id` تکراری → `duplicate`، بدون اجرای دوباره.
   کلاینت با شبکهٔ نامطمئن همان دسته را چند بار می‌فرستد.
2. **Partial success**: یک op خراب کل دسته را رد نمی‌کند. هر op نتیجهٔ خودش
   را دارد. کد وضعیت HTTP همیشه ۲۰۰ اگر بدنه معتبر بود.
3. **حل تعارض**: last-write-wins بر `client_updated_at`؛ `delete` همیشه برنده.
   در `conflict` نسخهٔ سرور برگردد تا کلاینت بتواند آشتی بدهد.
4. **ترتیب**: opها به ترتیب آرایه اجرا می‌شوند (وابستگی حساب→تراکنش).
5. **سقف پلن**: اگر op از سقف پلن رد شد، `rejected` با `plan_limit_reached`
   و `message` فارسی. کلاینت آن را در شیت ارتقا نشان می‌دهد، نه به‌عنوان خطای شبکه.
6. سقف اندازهٔ دسته: ۵۰۰ op یا ۱ مگابایت.

### ۶.۳ `GET /v1/sync/pull`

`?cursor=c_000871`

تغییرات سرور از آن cursor به بعد — همان شکل snapshot ولی فقط دلتا،
به‌علاوهٔ `sync_cursor` تازه و `has_more`.
اگر cursor خیلی قدیمی یا نامعتبر بود: `410` با `code: "cursor_expired"` →
کلاینت snapshot تازه می‌گیرد.

### ۶.۴ احترام به `localOnly`

اگر کاربر تنظیم `localOnly` را روشن کرده، کلاینت هیچ‌کدام از سه endpoint بالا
را صدا نمی‌زند. سرور هم اگر پرچم را در `/settings` دید، باید داده‌ای نگه ندارد
و در صورت روشن شدنش دادهٔ قبلی را پاک کند.

---

## ۷. تنظیمات

### ۷.۱ `GET /v1/settings` · `PUT /v1/settings`

آینهٔ تنظیمات برای چنددستگاهی. کلاینت **بی‌قید و شرط محلی کار می‌کند**؛ این
فقط همگام‌سازی است.

```json
{
  "data": {
    "calendar": "jalali",
    "digits": "fa",
    "weekStart": "sat",
    "reportChart": "bars",
    "reportStory": false,
    "homeSections": { "goals": false, "chart": false, "insights": false },
    "autoLock": 60,
    "benchmarking": false,
    "localOnly": false,
    "alerts": {
      "budgetNear": true, "budgetOver": true, "spendingSpike": true,
      "recurringDue": true, "balanceDrop": true, "goalBehind": true,
      "savingRateDown": false
    },
    "quietHours": true,
    "quietFrom": "22:00",
    "quietTo": "08:00",
    "updated_at": 1735000000000
  }
}
```

> ⚠ `appLock` و `biometric` **همگام نمی‌شوند** — تنظیم امنیتیِ همان دستگاه‌اند
> و به سرور نمی‌روند.
> `quietFrom/quietTo` در API با ارقام **لاتین** و فرمت `HH:mm` می‌آیند
> (کلاینت `۲۲:۰۰` نشان می‌دهد).
> `benchmarking` پیش‌فرض `false` است و سرور نباید پیش‌فرض را عوض کند.
> اگر `true` شد، دادهٔ ارسالی باید **تجمیعی و بی‌نام** باشد؛ هیچ تراکنش خامی
> برای این کار نمی‌رود.

---

## ۸. اعلان‌ها

### ۸.۱ `POST /v1/devices/push-token`

```json
{ "device_id": "...", "platform": "android",
  "token": "ExponentPushToken[...]", "app_version": "1.0.0" }
```

### ۸.۲ `POST /v1/alerts/read`

`{ "ids": ["alert-uuid-1"] }` — همگام کردن پرچم «خوانده شد». در صف می‌نشیند.

### ۸.۳ قواعد ارسال push

* هفت نوع هشدار؛ هر کدام فقط اگر در `settings.alerts` روشن است ارسال شود.
* **ساعت آرام** (`quietHours`) محترم شمرده شود — به وقت محلی کاربر.
* هشدار مالی حساس است: **مبلغ در متن notification نیاید**.
  «بودجهٔ خوراک به سقف نزدیک شد» ✅ — «۳٬۸۰۰٬۰۰۰ از ۴٬۰۰۰٬۰۰۰ خرج شد» ❌
  (روی صفحهٔ قفل گوشی دیده می‌شود).
* تصمیم ادمین روی پرداخت → push (بهتر از polling).

---

## ۹. خروجی و کانفیگ

### ۹.۱ `POST /v1/export`

```json
{ "format": "csv", "from": "2026-08-23", "to": "2026-09-22",
  "include": ["transactions", "budgets", "goals"] }
```

* `csv` برای همهٔ پلن‌ها — و **کلاینت می‌تواند آفلاین خودش بسازد**، پس این
  endpoint اختیاری است.
* `xlsx` و `pdf` فقط با قابلیت `export.pro_formats`؛ اگر نبود
  → `feature_not_available` (۴۰۳).
* پاسخ: `202` با `job_id`، یا `200` با URL امضاشدهٔ کوتاه‌عمر (۱۵ دقیقه).

### ۹.۲ `GET /v1/config/app`

کانفیگ عمومی؛ بدون توکن. برای تغییر رفتار بدون انتشار نسخهٔ جدید:

```json
{
  "data": {
    "min_supported_version": "1.0.0",
    "force_update": false,
    "update_url": "https://...",
    "support_phone": "...",
    "sync_enabled": true,
    "otp_length": 6,
    "entitlement_grace_days": 7
  }
}
```

> ⚠ `force_update` باید با احتیاط استفاده شود. اگر `true` بود و کاربر آفلاین
> بود، **اپ نباید قفل شود** — کاربر باید بتواند دادهٔ مالی خودش را ببیند.

---

## ۱۰. الزامات امنیتی (خلاصهٔ اجباری)

| # | الزام |
|---|---|
| ۱ | TLS 1.2+ اجباری. HSTS. (certificate pinning در کلاینت توصیه می‌شود) |
| ۲ | OTP در دیتابیس **هش‌شده**، مقایسه **زمان‌ثابت** |
| ۳ | refresh token **چرخشی**؛ استفادهٔ دوبارهٔ توکن باطل‌شده → باطل کردن همهٔ جلسه‌ها |
| ۴ | **PAN کامل هیچ‌جا** — نه دیتابیس، نه لاگ، نه متادیتای رسید. فقط ۴ رقم آخر |
| ۵ | پاسخ OTP **enumeration-resistant** (شکل، کد وضعیت و زمان پاسخ یکسان) |
| ۶ | rate limit روی شماره **و** IP |
| ۷ | لاگ‌ها **بدون داده مالی**، بدون توکن، بدون OTP، شمارهٔ موبایل ماسک‌شده |
| ۸ | مجوزدهی در هر endpoint بر مبنای مالکیت — هیچ‌وقت ID از URL بدون بررسی مالک |
| ۹ | تأیید پرداخت و تغییر entitlement **فقط سرور، فقط ادمین** |
| ۱۰ | تصویر رسید در استوریج خصوصی با URL امضاشدهٔ کوتاه‌عمر |
| ۱۱ | `localOnly` و `benchmarking` محترم شمرده شوند؛ پیش‌فرض هر دو محافظه‌کارانه |
| ۱۲ | حذف حساب = حذف واقعی و کامل بعد از مهلت ۷ روزه |

---

## ۱۱. چک‌لیست پذیرش

بک‌اند وقتی آماده است که همهٔ این‌ها درست کار کنند:

**ورود**
- [ ] ورود با شماره در هر فرمتی (`+98`، `0098`، ارقام فارسی، با فاصله)
- [ ] پاسخ `otp/request` برای شمارهٔ موجود و جدید از هم قابل تشخیص **نیست**
- [ ] ۵ تلاش غلط → قفل ۱۵ دقیقه با `retry_after`
- [ ] refresh چرخشی؛ استفادهٔ دوبارهٔ توکن کهنه همهٔ جلسه‌ها را می‌بندد
- [ ] قطع جلسهٔ دستگاه دیگر فوراً اثر می‌کند

**آفلاین — بخش حیاتی**
- [ ] با **خاموش کردن کامل شبکه** بعد از ورود، هر ۲۷ صفحه کار می‌کند
- [ ] ثبت، ویرایش و حذف تراکنش آفلاین **فوراً موفق** می‌شود
- [ ] **هیچ Toast، هیچ صفحهٔ خطا و هیچ Spinner بی‌پایانی** به‌خاطر شبکه دیده نمی‌شود
- [ ] با برگشت شبکه، صف بی‌صدا ارسال می‌شود و داده یکسان می‌ماند
- [ ] ارسال دوبارهٔ همان دسته هیچ رکورد تکراری نمی‌سازد
- [ ] entitlement کش‌شده در آفلاین معتبر است (تا انقضا + ۷ روز)
- [ ] `401` واقعی از سرور تنها دلیل بیرون کردن کاربر است، نه timeout

**پلن و پرداخت**
- [ ] هیچ قیمت، سقف یا قابلیتی در کلاینت hard-code نیست
- [ ] درخواست pending تکراری ساخته نمی‌شود، همان قبلی برمی‌گردد
- [ ] `ref_code` هیچ `0/O/1/I/L` ندارد
- [ ] ارتقا فوری، تمدید/تنزل صف‌شده — و صفحهٔ وضعیت فرقشان را می‌گوید
- [ ] دورهٔ آزمایشی دوبار داده نمی‌شود
- [ ] عوض کردن تاریخ گوشی دوره را کِش نمی‌دهد

**داده**
- [ ] انتقال در هیچ aggregate سروری شمرده نمی‌شود (BR-01)
- [ ] هیچ جمع مشتقی (`spent`، `summary`، `status`) ذخیره یا ارسال نمی‌شود (BR-02)
- [ ] هیچ PAN کاملی در دیتابیس و لاگ نیست
- [ ] `localOnly` روشن → هیچ دادهٔ مالی در سرور نمی‌ماند
- [ ] همهٔ `message`های خطا فارسی و قابل نمایش مستقیم‌اند
