# نبض — سند تحویل به تیم فرانت

> **مخاطب:** تیم فرانت (React Native / Expo)
> **وضعیت بک‌اند:** پیاده‌سازی کامل، ۱۰۲ تست پاس، آمادهٔ اتصال
> **Base URL:** `https://api.nabz.ir/v1` · توسعه: `http://localhost:3000/v1`
> **مستندات تعاملی:** `/docs` (Swagger)

همهٔ نمونه‌پاسخ‌های این سند **از خروجی واقعی سرور** گرفته شده‌اند، نه از سند طراحی.

---

## فهرست

1. [قواعد عمومی — این را اول بخوانید](#۱-قواعد-عمومی)
2. [جریان‌های محصول (Flow)](#۲-جریانهای-محصول)
3. [احراز هویت](#۳-احراز-هویت)
4. [حساب کاربری](#۴-حساب-کاربری)
5. [پلن و پرداخت](#۵-پلن-و-پرداخت)
6. [همگام‌سازی](#۶-همگامسازی)
7. [تنظیمات](#۷-تنظیمات)
8. [اعلان و هشدار](#۸-اعلان-و-هشدار)
9. [خروجی و کانفیگ](#۹-خروجی-و-کانفیگ)
10. [پنل ادمین](#۱۰-پنل-ادمین)
11. [جدول کامل خطاها](#۱۱-جدول-کامل-خطاها)
12. [چک‌لیست اتصال فرانت](#۱۲-چکلیست-اتصال-فرانت)

---

## ۱. قواعد عمومی

### ۱.۱ شکل پاسخ

**هر پاسخ موفق** دقیقاً این شکل را دارد:

```json
{ "data": { }, "server_time": "2026-09-26T11:14:25.739Z" }
```

**هر پاسخ خطا:**

```json
{
  "error": {
    "code": "otp_invalid",
    "message": "کد وارد شده درست نیست.",
    "message_en": "Invalid code.",
    "fields": { "code": "کد ۶ رقمی است." },
    "retry_after": 45
  },
  "server_time": "2026-09-26T11:14:25.739Z"
}
```

* `message` **فارسی و آمادهٔ نمایش مستقیم** است. همان را نشان بدهید.
* `code` ماشین‌خوان و ثابت است — **شرط‌هایتان را روی `code` بگذارید، نه روی `message`**.
* `fields` فقط روی خطای اعتبارسنجی می‌آید؛ کلیدش نام فیلد است.
* `retry_after` (ثانیه) روی ۴۲۹ و روی قفل OTP می‌آید و در هدر `Retry-After` هم هست.

### ۱.۲ `server_time` — اجباری است، استفاده کنید

روی **هر** پاسخ موفق و خطا می‌آید. یک‌بار اختلاف ساعت را حساب کنید و **همهٔ محاسبه‌های «روزهای باقی‌مانده» را از آن بگذرانید**. اگر ساعت گوشی مرجع باشد، کاربر با عوض کردن تاریخ می‌تواند دورهٔ اشتراک را کِش بدهد.

```ts
// یک‌بار بعد از اولین پاسخ موفق
const skewMs = new Date(res.server_time).getTime() - Date.now();
const serverNow = () => Date.now() + skewMs;
```

### ۱.۳ هدرهای درخواست

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept-Language: fa-IR
X-Client: nabz-app/1.0.0 (android 14)
X-Device-Id: <شناسهٔ پایدار دستگاه، تولید کلاینت>
X-Request-Id: <uuid، برای پیگیری در لاگ>
Idempotency-Key: <uuid>        # روی POSTهای نوشتنی
```

* `X-Client` را دقیقاً با همین قالب بفرستید — سرور `platform` جلسه را از پرانتز آن می‌خواند و در فهرست دستگاه‌ها نشان می‌دهد.
* `X-Device-Id` اگر `device_id` در بدنه نبود، جای آن استفاده می‌شود.

### ۱.۴ نوع داده

| چیز | قاعده |
|---|---|
| **پول** | تومان، **integer**. بدون اعشار، بدون رشته. `1000.5` رد می‌شود. |
| **تاریخ** | ISO 8601 با timezone یا epoch ms. **هیچ رشتهٔ جلالی پذیرفته نمی‌شود** — سرور `1405-07-03` را صریحاً رد می‌کند. |
| **ارقام** | سرور همیشه لاتین می‌فرستد و می‌پذیرد. تبدیل به فارسی کار شماست. |
| **شناسه** | UUID v4، **تولید کلاینت** برای همهٔ موجودیت‌های مالی. سرور ID نمی‌سازد. |
| **شماره موبایل** | هر قالبی بفرستید (`+98`، `0098`، ارقام فارسی، فاصله، خط تیره) — سرور نرمال می‌کند و `09xxxxxxxxx` برمی‌گرداند. |
| `null` vs غایب | `null` = «مقدار ندارد» (مثلاً سقف نامحدود). فیلد **غایب** = «تغییر نکرده». |

### ۱.۵ Idempotency — مهم برای آفلاین

روی همهٔ POSTهای نوشتنی هدر `Idempotency-Key: <uuid>` بفرستید و **در صف، همان کلید را برای همان عمل نگه دارید**.

* تکرار همان کلید با همان بدنه ⇒ **همان پاسخ قبلی با `200`** (نه `201`، نه اجرای دوباره).
* تکرار همان کلید با بدنهٔ متفاوت ⇒ عمل تازه اجرا می‌شود.
* **استثنا:** `POST /sync/push` از این هدر استفاده نمی‌کند؛ idempotency آن روی `op_id` هر عمل است تا موفقیت جزئی حفظ شود.

### ۱.۶ محدودیت نرخ

| مسیر | سقف |
|---|---|
| `POST /auth/otp/request` | ۳ بار در ۱۰ دقیقه **بر شماره** · ۱۰ بار در ساعت **بر IP** |
| `POST /auth/otp/verify` | ۵ تلاش، بعد قفل ۱۵ دقیقه |
| `POST /sync/push` | ۶۰ بار در دقیقه بر کاربر |
| بقیه | ۱۲۰ بار در دقیقه بر کاربر |

پاسخ `429` با `retry_after`.

### ۱.۷ قاعدهٔ طلایی آفلاین

> **هیچ endpointی در مسیر رندر هیچ صفحه‌ای نیست.**

با timeout کوتاه (**۸ ثانیه**) صدا بزنید و اگر نرسید، **بی‌صدا** از کش یا حالت محلی ادامه بدهید.
هیچ Toast، هیچ صفحهٔ خطا و هیچ Spinner بی‌پایانی به‌خاطر شبکه نشان داده نمی‌شود.

**تنها دلیل بیرون کردن کاربر، پاسخ صریح `401` با `code: "token_expired"` یا `"token_revoked"` از سرور است** — نه timeout، نه قطع اتصال، نه `5xx`.

---

## ۲. جریان‌های محصول

### ۲.۱ راه‌اندازی اول

```
نصب
 └─> GET /config/app                (بدون توکن — نسخهٔ پشتیبانی‌شده و پارامترها)
 └─> صفحهٔ ورود
      └─> POST /auth/otp/request    (اینترنت اجباری — تنها جای اجباری)
      └─> POST /auth/otp/verify     → توکن‌ها + user.is_new + entitlements
           ├─ is_new: true  → آنبوردینگ (۴ صفحه) → GET /sync/snapshot (خالی) → اپ
           └─ is_new: false → GET /sync/snapshot (بازیابی کامل داده) → اپ
```

`entitlements` **در همان پاسخ verify** می‌آید — یک round-trip کمتر و اپ بلافاصله آفلاین‌پذیر می‌شود. آن را کش کنید.

### ۲.۲ کار روزمره (بدون اینترنت)

```
کاربر تراکنش ثبت می‌کند
 └─> UUID محلی می‌سازید، در SQLite می‌نویسید، فوراً موفق نشان می‌دهید
 └─> یک op در صف می‌گذارید:
     { op_id: uuid(), entity: 'transaction', action: 'create',
       client_updated_at: serverNow(), payload: { id, type, amount, … } }
 └─> صف در پس‌زمینه با POST /sync/push فرستاده می‌شود
     ├─ رسید: هر op نتیجهٔ خودش را دارد → op را از صف بردارید
     └─ نرسید: صف می‌ماند، هیچ خطایی به کاربر نشان داده نمی‌شود
```

### ۲.۳ چرخهٔ همگام‌سازی

```
ورود روی دستگاه تازه ──> GET /sync/snapshot ──> sync_cursor را ذخیره کنید
                                                      │
       ┌──────────────────────────────────────────────┘
       ▼
 حلقهٔ پس‌زمینه (on-focus / هر چند دقیقه / با برگشت شبکه):
   1. POST /sync/push   با صف محلی   → sync_cursor تازه
   2. GET  /sync/pull?cursor=<آخرین> → دلتای سرور + sync_cursor تازه
       └─ ۴۱۰ با cursor_expired → GET /sync/snapshot تازه بگیرید
```

**ترتیب مهم است:** اول push بعد pull، وگرنه تغییر محلیِ نفرستاده با نسخهٔ سرور بازنویسی می‌شود.

**ترتیب opها در آرایه هم مهم است:** حساب و دسته را **پیش از** تراکنشی که به آن‌ها ارجاع می‌دهد بفرستید. سرور به ترتیب آرایه اجرا می‌کند و تراکنش با حساب ناموجود `rejected` می‌شود.

### ۲.۴ خرید پلن (کارت‌به‌کارت)

```
صفحهٔ پلن‌ها
 └─> GET /billing/plans            (بدون توکن، کش بلند با ETag)
 └─> GET /billing/config           (شماره کارت و نام صاحب حساب — هرگز در کد اپ)
 └─> انتخاب پلن و مدت
      └─> POST /billing/payment-requests  → ref_code شش‌کاراکتری
           │  ۲۰۱ = درخواست تازه · ۲۰۰ = همان درخواست pending قبلی
           └─> کاربر کارت‌به‌کارت واریز می‌کند و ref_code را می‌نویسد
                └─> POST …/{id}/receipt   (اعلام ارسال رسید، با یا بدون فایل)
                     └─> صفحهٔ وضعیت: GET …/{id}
                          polling هر ۱۵ ثانیه تا ۵ دقیقه، بعد on-focus
                          (اگر push فعال است، اعلام تصمیم ادمین با notification می‌آید)
                          │
                          ├─ status: approved + queued: false → «همین حالا فعال شد»
                          ├─ status: approved + queued: true  → «بعد از پایان دورهٔ فعلی شروع می‌شود»
                          └─ status: rejected → reject_reason را نشان بدهید
 └─> GET /me/entitlements          (وضعیت تازه، کش کنید)
```

> ⚠ **`queued` را جدی بگیرید.** قاطی کردن «الان فعال شد» و «بعداً شروع می‌شود» یعنی دروغ گفتن به کاربری که پول داده.

### ۲.۵ منطق صف‌شدن اشتراک

وقتی ادمین تأیید می‌کند، سرور خودش تصمیم می‌گیرد:

| حالت | نتیجه |
|---|---|
| پلن **بالاتر** از پلن فعال | `queued: false` — **فوراً** شروع می‌شود |
| پلن **هم‌سطح یا پایین‌تر** و دورهٔ فعلی هنوز فعال | `queued: true` — **پشت** دورهٔ فعلی صف می‌شود |
| دورهٔ فعلی تمام شده یا پلن رایگان | `queued: false` — فوراً |

روز پولی کاربر هدر نمی‌رود. صفِ نتیجه در `entitlements.queued` دیده می‌شود.

### ۲.۶ مهلت لطف آفلاین (entitlement)

`GET /me/entitlements` را کش کنید. در حالت آفلاین:

```
کش معتبر است تا:  expires_at + (entitlement_grace_days × 86400000)
                   └─ مقدار grace از GET /config/app می‌آید (پیش‌فرض ۷ روز)
بعد از آن:         بی‌صدا به پلن free برگردید — نه صفحهٔ خطا، نه قفل
```

این منطق **کار کلاینت** است؛ سرور فقط حقیقت را می‌گوید. قطع اینترنت هیچ‌وقت نباید قابلیت پول‌داده‌شده را وسط کار ببندد.

### ۲.۷ خروج و حذف داده

```
POST /auth/logout   → ۲۰۴، فقط همین جلسه، دادهٔ محلی پاک نمی‌شود (این را به کاربر بگویید)
wipeAll محلی        → عمل جداگانهٔ کلاینت، هیچ endpointی ندارد
DELETE /me          → ۲۰۲ با مهلت ۷ روزه؛ ورود موفق بعدی، حذف را لغو می‌کند
```

---

## ۳. احراز هویت

### ۳.۱ `POST /auth/otp/request` — بدون توکن

```json
// درخواست
{ "phone": "09121234567", "device_id": "stable-device-id" }
```

```json
// ۲۰۰
{
  "data": {
    "sent": true,
    "otp_length": 6,
    "expires_in": 120,
    "resend_after": 60,
    "attempts_allowed": 5
  },
  "server_time": "2026-09-26T11:14:25.739Z"
}
```

> **پاسخ برای شمارهٔ موجود و جدید کاملاً یکسان است** — شکل، کد وضعیت و حتی زمان پاسخ. هیچ راهی برای فهمیدن اینکه شماره ثبت شده یا نه وجود ندارد (و نباید در UI ادعایی در این باره بکنید).

`otp_length`، `expires_in` و `resend_after` را **از همین پاسخ بخوانید**، نه از ثابت در کد — تا بعداً بدون انتشار نسخهٔ جدید اپ قابل تغییر باشند.

**خطاها:** `phone_invalid` (۴۰۰) · `rate_limited` (۴۲۹ با `retry_after`)

### ۳.۲ `POST /auth/otp/verify` — بدون توکن

```json
// درخواست
{ "phone": "09121234567", "code": "123456",
  "device_id": "stable-device-id", "device_name": "Pixel 8" }
```

```json
// ۲۰۰
{
  "data": {
    "access_token": "eyJhbGciOi…",
    "access_expires_in": 900,
    "refresh_token": "3Qk8…",
    "refresh_expires_in": 2592000,
    "user": {
      "id": "7f84412c-aa5b-4230-aba3-7b5ae5db9520",
      "phone": "09121234567",
      "created_at": "2026-09-26T11:14:25.655Z",
      "is_new": true
    },
    "entitlements": {
      "effective_plan": "free",
      "source": null,
      "expires_at": null,
      "trial_used": false,
      "queued": [],
      "usage": {
        "accounts.max": 0,
        "categories.custom.max": 0,
        "budgets.max": 0,
        "goals.max": 0,
        "recurring.max": 0
      }
    }
  },
  "server_time": "…"
}
```

* `is_new` فقط برای نمایش آنبوردینگ است و **بعد از** تأیید موفق می‌آید.
* توکن‌ها را در **Keychain / Keystore** بگذارید، **نه AsyncStorage** (روی اندروید رمزنگاری‌نشده است).

**خطاها:**

| کد | HTTP | معنی |
|---|---|---|
| `otp_invalid` | ۴۰۱ | «کد وارد شده درست نیست.» |
| `otp_expired` | ۴۱۰ | مهلت ۱۲۰ ثانیه تمام شده |
| `otp_locked` | ۴۲۳ | ۵ تلاش غلط ⇒ قفل ۱۵ دقیقه، با `retry_after: 900` |
| `phone_invalid` | ۴۰۰ | خط ثابت یا پیش‌شمارهٔ نامعتبر |

هیچ‌کدام نمی‌گویند شماره ثبت بود یا نه.

### ۳.۳ `POST /auth/token/refresh` — بدون توکن

```json
// درخواست
{ "refresh_token": "3Qk8…" }
```

```json
// ۲۰۰
{
  "data": {
    "access_token": "eyJ…",
    "access_expires_in": 900,
    "refresh_token": "به‌کل تازه — قبلی باطل شد",
    "refresh_expires_in": 2592000
  },
  "server_time": "…"
}
```

> ⚠ **refresh token چرخشی است.** هر بار refresh، توکن قبلی **باطل** می‌شود و توکن تازه صادر می‌شود. توکن تازه را فوراً ذخیره کنید.
>
> اگر یک توکن باطل‌شده دوباره استفاده شود، سرور آن را **سرقت توکن** تلقی می‌کند و **همهٔ جلسه‌های آن کاربر را می‌بندد**. پس:
> * هیچ‌وقت دو refresh همزمان نفرستید — یک mutex بگذارید.
> * توکن قبلی را نگه ندارید و دوباره امتحان نکنید.

**خطاها:** `token_expired` / `token_revoked` (۴۰۱) → کاربر را به صفحهٔ ورود ببرید. **این تنها حالتی است که کاربر را بیرون می‌کنید.**

### ۳.۴ `POST /auth/logout` — نیازمند توکن

```json
{ "refresh_token": "3Qk8…" }
```

`۲۰۴` بدون بدنه. فقط همین جلسه. **دادهٔ محلی پاک نمی‌شود و باید به کاربر گفته شود.**

### ۳.۵ `GET /auth/sessions` — نیازمند توکن

```json
{
  "data": [
    {
      "id": "41956772-8b8a-4039-a01b-d90ba664552b",
      "device_name": "همین دستگاه",
      "platform": null,
      "city": null,
      "last_active_at": "2026-09-26T11:14:25.655Z",
      "created_at": "2026-09-26T11:14:25.655Z",
      "is_current": true
    }
  ],
  "server_time": "…"
}
```

* `data` یک **آرایه** است (نه شیء).
* `device_name` جلسهٔ جاری همیشه رشتهٔ `"همین دستگاه"` است؛ بقیه نام دستگاه خودشان یا `"دستگاه ناشناس"`.
* `platform` از هدر `X-Client` پر می‌شود — اگر آن را نفرستید `null` می‌ماند.

### ۳.۶ `DELETE /auth/sessions/{id}` — نیازمند توکن

`۲۰۴`. جلسهٔ آن دستگاه **فوراً** باطل می‌شود: توکن دسترسی همان دستگاه از درخواست بعدی `401 token_revoked` می‌گیرد (منتظر انقضای JWT نمی‌ماند).

حذف جلسهٔ جاری = logout. جلسهٔ کاربر دیگر ⇒ `404`.

---

## ۴. حساب کاربری

### ۴.۱ `GET /me`

```json
{
  "data": {
    "id": "7f84412c-…",
    "phone": "09121234567",
    "display_name": null,
    "created_at": "2026-09-26T11:14:25.655Z",
    "deletion_scheduled_at": null
  },
  "server_time": "…"
}
```

### ۴.۲ `PATCH /me`

```json
// درخواست — فقط فیلدهای فرستاده‌شده تغییر می‌کنند
{ "display_name": "سارا" }
```

پاسخ: همان شکل `GET /me`.

`display_name: null` یا `""` نام را پاک می‌کند. **تغییر شماره موبایل از این مسیر ممکن نیست** — اگر بفرستید بی‌اثر نادیده گرفته می‌شود.

### ۴.۳ `DELETE /me`

```json
// درخواست — تأیید صریح اجباری است
{ "confirm": true }
```

```json
// ۲۰۲
{
  "data": {
    "deletion_scheduled_at": "2026-10-03T11:14:25.655Z",
    "grace_days": 7
  },
  "server_time": "…"
}
```

* `confirm: false` یا غایب ⇒ `422` با `fields.confirm`.
* **ورود موفق بعدی، حذف را خودکار لغو می‌کند.** این را در UI بگویید.
* بعد از مهلت، حذف **کامل و برگشت‌ناپذیر** است (فایل رسیدها هم پاک می‌شوند).

---

## ۵. پلن و پرداخت

### ۵.۱ `GET /billing/plans` — بدون توکن

**کل کاتالوگ در یک پاسخ.** هیچ قیمت، سقف یا قابلیتی را در کد اپ hard-code نکنید.

```json
{
  "data": {
    "catalog_version": 1,
    "plans": [
      { "key": "free", "title": "رایگان", "tier": 0, "is_purchasable": false,
        "pitch": "هستهٔ نبض، برای شروع",
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
      "accounts.max":          { "label": "حساب و کیف پول",    "free": 2, "plus": 5,    "pro": null },
      "categories.custom.max": { "label": "دستهٔ اختصاصی",      "free": 3, "plus": 15,   "pro": null },
      "budgets.max":           { "label": "بودجهٔ فعال",        "free": 3, "plus": null, "pro": null },
      "goals.max":             { "label": "هدف فعال",           "free": 1, "plus": 5,    "pro": null },
      "recurring.max":         { "label": "تراکنش تکرارشونده",  "free": 3, "plus": 15,   "pro": null },
      "ai.messages_per_month": { "label": "پیام دستیار هوشمند", "free": 0, "plus": 0,    "pro": 150, "soon": true },
      "ai.ocr_per_month":      { "label": "اسکن رسید",          "free": 0, "plus": 0,    "pro": 30,  "soon": true }
    },
    "features": [
      { "key": "tx.entry", "label": "ثبت هزینه، درآمد و انتقال", "free": 1, "plus": 1, "pro": 1 },
      { "key": "reports.yearly", "label": "گزارش سالانه", "free": 0, "plus": 1, "pro": 1 },
      { "key": "forecasting", "label": "پیش‌بینی مالی", "free": 0, "plus": 0, "pro": 1, "soon": true }
    ]
  },
  "server_time": "…"
}
```

**قواعد خواندن کاتالوگ:**

* در `limits`: `null` = **نامحدود** · `0` = **بسته**.
* در `features`: `1` = باز · `0` = بسته.
* `soon: true` = کلید ثبت شده ولی قابلیت ساخته نشده ⇒ **برچسب «به‌زودی» بزنید و پنهان نکنید.** پنهان کردنِ چیزی که در ماتریس هست یعنی کاربر بابت چیزی پول می‌دهد که نمی‌داند کِی می‌آید.
* `is_purchasable: false` روی `pro` ⇒ دکمهٔ خرید نباشد، اما پلن **نمایش داده شود** (دورهٔ آزمایشی همچنان پرو می‌دهد). با انتشار V2 این پرچم `true` می‌شود، **بدون تغییر کلاینت**.
* هزینهٔ معادل ماهانه و درصد تخفیف را **خودتان** از `prices` حساب کنید.
* `features` کامل ۲۸ کلید است (نمونهٔ بالا خلاصه است).

**کش:** پاسخ `ETag` و `Cache-Control: public, max-age=3600` دارد. `If-None-Match` بفرستید ⇒ `304` بدون بدنه. `catalog_version` هم برای بی‌اعتبار کردن کش دستی.

### ۵.۲ `GET /billing/config` — نیازمند توکن

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
  },
  "server_time": "…"
}
```

**هیچ‌کدام از این‌ها را در کد اپ ثابت نکنید.** `receipt_channels` فهرست کانال‌های مجاز برای فیلد `channel` در ارسال رسید است.

### ۵.۳ `GET /me/entitlements` — نیازمند توکن

**شکل مرجع وضعیت اشتراک.** کش کنید.

```json
{
  "data": {
    "effective_plan": "plus",
    "source": "purchase",
    "expires_at": 1798196932145,
    "trial_used": true,
    "queued": [
      { "plan_key": "plus", "starts_at": 1798196932145, "expires_at": 1800788932145 }
    ],
    "usage": {
      "accounts.max": 2,
      "categories.custom.max": 1,
      "budgets.max": 0,
      "goals.max": 0,
      "recurring.max": 0
    }
  },
  "server_time": "…"
}
```

| فیلد | توضیح |
|---|---|
| `effective_plan` | `free` · `plus` · `pro` |
| `source` | `trial` · `purchase` · `admin_grant` · `null` (برای پلن رایگان) |
| `expires_at` | **epoch ms**. برای پلن رایگانِ بی‌انقضا `null`. |
| `trial_used` | اگر `true` بود، دکمهٔ «شروع دورهٔ آزمایشی» را نشان ندهید |
| `queued` | دوره‌های خریده‌شده که پشت دورهٔ فعلی صف‌اند |
| `usage` | مصرف فعلی هر سقف — با آن «۲ از ۵ حساب» را نشان بدهید |

`usage` **زنده شمرده می‌شود** و ذخیره نمی‌شود. کلیدهایش همان کلیدهای `limits` در کاتالوگ‌اند، پس:

```ts
const limit = catalog.limits['accounts.max'][entitlements.effective_plan]; // number | null
const used  = entitlements.usage['accounts.max'];
const label = limit === null ? `${used} حساب` : `${used} از ${limit} حساب`;
const canAdd = limit === null || used < limit;
```

### ۵.۴ `POST /billing/trial` — نیازمند توکن

بدنه خالی. پاسخ `200` با **همان شکل entitlements** (پلن `pro`، `source: "trial"`).

**خطا:** `trial_already_used` (۴۰۹). یک‌بار برای هر شماره.

### ۵.۵ `POST /billing/payment-requests` — نیازمند توکن

```json
// درخواست
{ "plan_key": "plus", "duration_days": 90, "provider": "manual_card" }
```

```json
// ۲۰۱ (تازه) یا ۲۰۰ (همان pending قبلی)
{
  "data": {
    "id": "6a2503c0-fa96-4754-a035-3ed1915142ca",
    "plan_key": "plus",
    "duration_days": 90,
    "amount_toman": 129000,
    "ref_code": "UBMV6P",
    "provider": "manual_card",
    "status": "pending",
    "created_at": 1790420932145,
    "expires_at": 1790679132145,
    "reject_reason": null,
    "decided_at": null,
    "queued": null,
    "starts_at": null,
    "ends_at": null
  },
  "server_time": "…"
}
```

**قواعدی که باید بدانید:**

1. اگر درخواست `pending` با **همان `plan_key` و همان `duration_days`** وجود دارد، درخواست تازه ساخته **نمی‌شود** — همان قبلی با `200` برمی‌گردد. دو کد پیگیری برای یک واریز یعنی ادمین نمی‌داند کدام را تأیید کند.
2. `ref_code` شش کاراکتر از الفبای `23456789ABCDEFGHJKMNPQRSTUVWXYZ` است — **هیچ `0`، `O`، `1`، `I` یا `L` ندارد**، چون کاربر باید آن را از صفحه بخواند و تایپ کند. با فونت خوانا و امکان کپی نشان بدهید.
3. `amount_toman` را **سرور** از کاتالوگ می‌خواند. اگر مبلغ بفرستید نادیده گرفته می‌شود.
4. `expires_at` = `created_at` + ۷۲ ساعت. شمارش معکوس را از `server_time` حساب کنید.
5. `provider` اختیاری است، پیش‌فرض `manual_card`.

**خطاها:** `forbidden` (۴۰۳) اگر `is_purchasable: false` · `validation_failed` (۴۲۲) اگر مدت برای آن پلن تعریف نشده · `not_found` (۴۰۴) پلن ناشناس.

### ۵.۶ `GET /billing/payment-requests` — نیازمند توکن

`?status=pending|approved|rejected|cancelled|expired&limit=20&cursor=<id>`

```json
{
  "data": {
    "items": [ { /* همان شکل بالا */ } ],
    "next_cursor": null
  },
  "server_time": "…"
}
```

> توجه: پاسخ یک **شیء با `items`** است، نه آرایهٔ خالی. `next_cursor` اگر `null` بود صفحهٔ بعدی نیست. `limit` پیش‌فرض ۲۰، حداکثر ۱۰۰.

### ۵.۷ `GET /billing/payment-requests/{id}` — نیازمند توکن

صفحهٔ وضعیت. **polling هر ۱۵ ثانیه تا ۵ دقیقه، بعد on-focus.**

```json
// پس از تأیید ادمین
{
  "data": {
    "id": "6a2503c0-…",
    "plan_key": "plus",
    "duration_days": 90,
    "amount_toman": 129000,
    "ref_code": "UBMV6P",
    "provider": "manual_card",
    "status": "approved",
    "created_at": 1790420932145,
    "expires_at": 1790679132145,
    "reject_reason": null,
    "decided_at": 1790420955000,
    "queued": false,
    "starts_at": 1790420932145,
    "ends_at": 1798196932145
  },
  "server_time": "…"
}
```

**`status` ممکن:** `pending` · `approved` · `rejected` · `cancelled` · `expired`

**نمایش بر اساس وضعیت:**

| وضعیت | متن پیشنهادی |
|---|---|
| `pending` | «در انتظار تأیید» + کد پیگیری + شمارش معکوس تا `expires_at` |
| `approved` + `queued: false` | «اشتراک فعال شد» + تاریخ پایان از `ends_at` |
| `approved` + `queued: true` | «از `starts_at` شروع می‌شود» — **حتماً فرقش را بگویید** |
| `rejected` | `reject_reason` را عیناً نشان بدهید + دکمهٔ تلاش دوباره |
| `expired` | «مهلت تمام شد» + دکمهٔ ساخت درخواست تازه |
| `cancelled` | «لغو شد» |

درخواست کاربر دیگر ⇒ `404`.

### ۵.۸ `POST /billing/payment-requests/{id}/receipt` — نیازمند توکن

**دو حالت:**

```json
// حالت ۱ — فقط اعلام (application/json)
{ "channel": "telegram", "note": "واریز از کارت ۶۰۳۷…۱۲۳۴ ساعت ۱۴:۳۰" }
```

```
// حالت ۲ — با فایل (multipart/form-data)
channel=telegram
note=واریز ساعت ۱۴:۳۰
file=<binary>
```

پاسخ `200` با شکل کامل درخواست پرداخت.

* `channel`: یکی از `sms` · `telegram` · `whatsapp` · `in_app`
* فایل: حداکثر **۵ مگابایت**، فقط `image/jpeg` · `image/png` · `image/webp` · `application/pdf`
* فایل در استوریج **خصوصی** می‌نشیند و فقط با URL امضاشدهٔ کوتاه‌عمر خوانده می‌شود.
* **سرور شمارهٔ کامل کارت را در متن `note` خودکار ماسک می‌کند** (`••••5678`). با این حال **شمارهٔ کامل کارت را نفرستید** — فقط چهار رقم آخر.

**خطاها:** `forbidden` (۴۰۳) اگر درخواست pending نیست · `payment_request_expired` (۴۱۰) · `validation_failed` (۴۲۲) قالب فایل · `payload_too_large` (۴۱۳) بیش از ۵ مگابایت.

### ۵.۹ `POST /billing/payment-requests/{id}/cancel` — نیازمند توکن

بدنه خالی. `200` با شکل کامل درخواست.

فقط روی `pending` اثر دارد؛ روی بقیه **no-op با ۲۰۰** (نه خطا) — پس می‌توانید بی‌نگرانی دوباره بفرستید.

---

## ۶. همگام‌سازی

### ۶.۱ `GET /sync/snapshot` — نیازمند توکن

`?cursor=<c_NNNNNN>` (اختیاری، برای صفحه‌بندی)

```json
{
  "data": {
    "sync_cursor": "c_000181",
    "has_more": false,
    "accounts": [
      {
        "id": "uuid",
        "name": "بانک ملت",
        "icon": "bank",
        "balance": 42500000,
        "card": { "bin": "610433", "last4": "1234", "expiry": "07/29",
                  "bank": "ملت", "tone": "rose" },
        "updated_at": 1790420932145,
        "deleted_at": null
      },
      {
        "id": "uuid",
        "name": "نقد",
        "icon": "cash",
        "balance": 500000,
        "card": null,
        "updated_at": 1790420932145,
        "deleted_at": null
      }
    ],
    "categories": [
      { "id": "uuid", "name": "خوراک", "icon": "food", "color": "amber",
        "custom": true, "order": 1, "updated_at": 1790420932145, "deleted_at": null }
    ],
    "transactions": [
      { "id": "uuid", "type": "expense", "amount": 185000, "name": "نان", "note": null,
        "occurred_at": "2026-09-25T09:10:00.000Z",
        "updated_at": 1790420932145, "deleted_at": null,
        "category": "cat-uuid", "account": "acc-uuid" },

      { "id": "uuid", "type": "transfer", "amount": 5000000, "name": "انتقال", "note": null,
        "occurred_at": "2026-09-24T12:00:00.000Z",
        "updated_at": 1790420932145, "deleted_at": null,
        "from": "acc-uuid-1", "to": "acc-uuid-2" }
    ],
    "budgets": [
      { "id": "uuid", "category": "cat-uuid", "limit": 4000000,
        "updated_at": 1790420932145, "deleted_at": null }
    ],
    "goals": [
      { "id": "uuid", "name": "سفر", "target": 80000000, "current": 32000000,
        "months": 6, "deadline": null,
        "updated_at": 1790420932145, "deleted_at": null }
    ],
    "recurrings": [
      { "id": "uuid", "type": "expense", "amount": 1500000, "name": "اجاره",
        "category": "cat-uuid", "account": "acc-uuid",
        "day_of_month": 1, "every_months": 1, "next_due_at": "2026-10-01T00:00:00.000Z",
        "active": true, "updated_at": 1790420932145, "deleted_at": null }
    ],
    "alerts_read": ["alert-uuid-1", "alert-uuid-2"]
  },
  "server_time": "…"
}
```

**نکات الزامی:**

* **شکل تراکنش با نوعش می‌خواند (BR-01):**
  * `type: "transfer"` ⇒ فیلدهای `from` و `to` دارد، **`category` و `account` ندارد**.
  * `type: "expense" | "income"` ⇒ `category` و `account` دارد، **`from`/`to` ندارد**.
  * این در سطح دیتابیس هم اجبار شده. **انتقال را در هیچ جمعی نشمارید و هرگز سبز یا قرمز نکنید.**
* **هیچ فیلد مشتقی فرستاده نمی‌شود:** `budget.spent`، `goal.monthlyNeed`، `goal.status`، و کل `summary` در پاسخ **نیستند**. خودتان از تراکنش‌ها بسازید. اگر سرور می‌فرستاد، دو منبع حقیقت می‌شد و از هم جدا می‌افتادند.
* `occurred_at` تاریخ رخداد به **ISO با timezone**. گروه‌بندی روزانه و برچسب جلالی کار شماست.
* `updated_at` همان `client_updated_at` است که خودتان فرستاده‌اید (epoch ms).
* `deleted_at` غیر `null` = **tombstone**؛ رکورد را از UI بردارید.
* `card: null` برای حساب نقد. **هرگز شمارهٔ کارت به پول نقد ندهید.**
* از کارت فقط `bin` (۶ رقم اول) و `last4` می‌آید. **PAN کامل هیچ‌جا نیست.**
* اگر `has_more: true` بود، با `?cursor=<sync_cursor>` صفحهٔ بعد را بگیرید تا `has_more: false` شود.

### ۶.۲ `POST /sync/push` — نیازمند توکن

**مهم‌ترین endpoint برای offline-first.**

```json
{
  "base_cursor": "c_000871",
  "ops": [
    { "op_id": "uuid-1", "entity": "account", "action": "create",
      "client_updated_at": 1790420932145,
      "payload": { "id": "acc-uuid", "name": "بانک ملت", "icon": "bank", "balance": 42500000,
                   "card": { "bin": "610433", "last4": "1234", "expiry": "07/29",
                             "bank": "ملت", "tone": "rose" } } },

    { "op_id": "uuid-2", "entity": "transaction", "action": "create",
      "client_updated_at": 1790420932146,
      "payload": { "id": "tx-uuid", "type": "expense", "amount": 185000, "name": "نان",
                   "category": "cat-uuid", "account": "acc-uuid",
                   "occurred_at": "2026-09-25T09:10:00Z" } },

    { "op_id": "uuid-3", "entity": "transaction", "action": "delete",
      "client_updated_at": 1790420932147,
      "payload": { "id": "tx-uuid-old" } }
  ]
}
```

```json
// همیشه ۲۰۰ اگر بدنه معتبر بود
{
  "data": {
    "sync_cursor": "c_000895",
    "results": [
      { "op_id": "uuid-1", "status": "applied" },
      { "op_id": "uuid-2", "status": "duplicate" },
      { "op_id": "uuid-3", "status": "rejected",
        "code": "plan_limit_reached",
        "message": "به سقف حساب و کیف پول در پلن فعلی رسیدی (2). برای بیشتر، پلن را ارتقا بده." },
      { "op_id": "uuid-4", "status": "conflict",
        "server_version": { "id": "…", "name": "نسخهٔ سرور", "…": "…" } }
    ]
  },
  "server_time": "…"
}
```

**`entity` مجاز:** `transaction` · `account` · `category` · `budget` · `goal` · `recurring`
**`action` مجاز:** `create` · `update` · `delete`

#### چهار وضعیت نتیجه و کاری که باید بکنید

| `status` | معنی | کار فرانت |
|---|---|---|
| `applied` | اعمال شد | op را از صف بردارید |
| `duplicate` | `op_id` قبلاً دیده شده، دوباره اجرا نشد | op را از صف بردارید (موفق است) |
| `rejected` | رد شد، با `code` و `message` فارسی | op را از صف بردارید و بسته به `code` عمل کنید |
| `conflict` | نسخهٔ سرور تازه‌تر است، `server_version` همراهش | نسخهٔ سرور را بپذیرید یا با `client_updated_at` تازه‌تر بنویسید |

**`code`های ممکن در `rejected`:**

| کد | معنی | UI پیشنهادی |
|---|---|---|
| `plan_limit_reached` | از سقف پلن رد شد | **شیت ارتقای پلن** با همان `message` — نه Toast خطای شبکه |
| `validation_failed` | محتوا معتبر نیست (مبلغ اعشاری، دستهٔ ناموجود، شکل غلط انتقال) | یک باگ کلاینت است؛ لاگ کنید و op را دور بیندازید |
| `server_error` | خطای موقت سرور | op را **در صف نگه دارید** و بعداً دوباره بفرستید |

#### قواعد الزامی

1. **idempotency روی `op_id`** — `op_id` را در صف نگه دارید و با هر تلاش دوباره **همان** را بفرستید. تکرار ⇒ `duplicate`، بدون رکورد تکراری.
2. **موفقیت جزئی** — یک op خراب کل دسته را رد نمی‌کند. HTTP همیشه `200` است اگر بدنه معتبر بود.
3. **حل تعارض** — last-write-wins بر `client_updated_at`. **`delete` همیشه برنده است**: ویرایشِ تازه‌تر یک رکورد حذف‌شده آن را زنده نمی‌کند (نتیجه `applied` می‌گیرد ولی رکورد حذف‌شده می‌ماند).
4. **ترتیب آرایه** — opها به ترتیب اجرا می‌شوند. **حساب و دسته را پیش از تراکنشِ وابسته بفرستید.**
5. **سقف پلن فقط روی `create`** اعمال می‌شود، نه `update`/`delete` — کاربری که پلنش تمام شده باید بتواند دادهٔ موجودش را ویرایش و حذف کند.
6. **سقف دسته: ۵۰۰ op یا ۱ مگابایت.** بیشتر ⇒ `422`. صف را تکه‌تکه بفرستید.
7. `base_cursor` اختیاری است و فعلاً فقط برای رهگیری؛ نتیجه را عوض نمی‌کند.

#### اعتبارسنجی محتوا — چیزهایی که رد می‌شوند

| ورودی | نتیجه |
|---|---|
| `amount: 1000.5` یا `"1000"` | رد — پول باید **integer** باشد |
| `amount: -1` | رد — منفی نمی‌شود |
| `occurred_at: "1405-07-03"` | رد — تاریخ جلالی پذیرفته نمی‌شود |
| انتقال با `category` یا `account` | رد (BR-01) |
| هزینه/درآمد با `from` یا `to` | رد (BR-01) |
| انتقال با `from === to` | رد |
| `card.last4: "6037997512345678"` | رد — فقط ۴ رقم |
| `id` غیر UUID v4 | رد |
| تراکنش با `category`/`account` ناموجود | رد |
| بودجهٔ دوم برای همان دسته | رد |

### ۶.۳ `GET /sync/pull` — نیازمند توکن

`?cursor=c_000871`

همان شکل snapshot، ولی فقط **دلتا** از آن نشانگر به بعد.

**نشانگر نامعتبر یا کهنه ⇒ `410` با `code: "cursor_expired"`** → `GET /sync/snapshot` تازه بگیرید. این حالت خطا نیست و به کاربر نشان داده نمی‌شود.

### ۶.۴ احترام به `localOnly`

اگر کاربر `localOnly` را روشن کرد:

* **هیچ‌کدام از سه endpoint بالا را صدا نزنید.**
* اگر صدا بزنید، `403` با پیام فارسی می‌گیرید.
* سرور در لحظهٔ روشن شدن این پرچم، **دادهٔ مالی موجود آن کاربر را از سرور پاک می‌کند**. این برگشت‌ناپذیر است — در UI هشدار بدهید.
* `auth` و `billing` همچنان کار می‌کنند.

---

## ۷. تنظیمات

### ۷.۱ `GET /settings` — نیازمند توکن

```json
{
  "data": {
    "calendar": "jalali",
    "digits": "fa",
    "weekStart": "sat",
    "reportChart": "bars",
    "reportStory": false,
    "homeSections": { "chart": false, "goals": false, "insights": false },
    "autoLock": 60,
    "benchmarking": false,
    "localOnly": false,
    "alerts": {
      "budgetNear": true,
      "budgetOver": true,
      "goalBehind": true,
      "balanceDrop": true,
      "recurringDue": true,
      "spendingSpike": true,
      "savingRateDown": false
    },
    "quietHours": true,
    "quietFrom": "22:00",
    "quietTo": "08:00",
    "timezone": "Asia/Tehran",
    "updated_at": 1790421265648
  },
  "server_time": "…"
}
```

### ۷.۲ `PUT /settings` — نیازمند توکن

**فقط فیلدهای فرستاده‌شده تغییر می‌کنند.** پاسخ: شکل کامل بالا.

```json
{ "digits": "latin", "alerts": { "savingRateDown": true } }
```

`alerts` و `homeSections` **ادغام** می‌شوند، نه جایگزین — فرستادن یک کلید بقیه را پاک نمی‌کند.

| فیلد | مقدارهای مجاز |
|---|---|
| `calendar` | `jalali` · `gregorian` |
| `digits` | `fa` · `latin` |
| `weekStart` | `sat` · `mon` |
| `reportChart` | `bars` · `donut` |
| `reportStory` | boolean |
| `homeSections` | شیء با کلیدهای `goals` · `chart` · `insights` (boolean) |
| `autoLock` | ثانیه، ۰ تا ۸۶۴۰۰ |
| `benchmarking` | boolean — **پیش‌فرض `false` و سرور آن را عوض نمی‌کند** |
| `localOnly` | boolean — روشن کردنش دادهٔ سرور را پاک می‌کند |
| `alerts` | هفت کلید boolean بالا |
| `quietHours` | boolean |
| `quietFrom` / `quietTo` | `HH:mm` با **ارقام لاتین** (`"22:00"`). در UI `۲۲:۰۰` نشان بدهید ولی لاتین بفرستید. |
| `timezone` | مثل `Asia/Tehran` — سرور با آن ساعت آرام را به وقت محلی کاربر حساب می‌کند |

> ⚠ **`appLock` و `biometric` همگام نمی‌شوند** و در این پاسخ نیستند. تنظیم امنیتیِ همان دستگاه‌اند و به سرور نمی‌روند. اگر بفرستید، بی‌صدا حذف می‌شوند. رمز، کلید و توکن هیچ‌وقت در AsyncStorage نمی‌نشیند — Keychain/Keystore.

> ⚠ کلاینت **بی‌قید و شرط محلی کار می‌کند**؛ این endpoint فقط آینه برای چنددستگاهی است. هیچ‌وقت منتظر پاسخ آن نمانید.

---

## ۸. اعلان و هشدار

### ۸.۱ `POST /devices/push-token` — نیازمند توکن

```json
{ "device_id": "stable-device-id", "platform": "android",
  "token": "ExponentPushToken[xxx]", "app_version": "1.0.0" }
```

```json
{ "data": { "registered": true }, "server_time": "…" }
```

`platform`: `android` · `ios` · `web`. هر `device_id` یک توکن دارد؛ ارسال دوباره به‌روزرسانی می‌کند.

### ۸.۲ `POST /alerts/read` — نیازمند توکن

```json
{ "ids": ["alert-uuid-1", "alert-uuid-2"] }
```

```json
{ "data": { "marked": 2 }, "server_time": "…" }
```

`marked` تعداد شناسه‌های **تازه** علامت‌خورده است (تکراری‌ها شمرده نمی‌شوند). حداکثر ۵۰۰ شناسه در هر درخواست. در صف بگذارید — idempotent است.

پرچم‌های خوانده‌شده در `alerts_read` پاسخ snapshot/pull برمی‌گردند.

### ۸.۳ هشدار و بینش — کار کلاینت است

**تولید هشدار و بینش محلی است** تا آفلاین کار کند. هفت نوع هشدار:

`budgetNear` · `budgetOver` · `spendingSpike` · `recurringDue` · `balanceDrop` · `goalBehind` · `savingRateDown`

نقش سرور فقط: (۱) همگام کردن پرچم `read`، (۲) ارسال push.

**قواعد push سرور** (برای هم‌راستایی با اعلان محلی شما):

* هر هشدار فقط اگر کلیدش در `settings.alerts` روشن باشد فرستاده می‌شود.
* **ساعت آرام** به وقت محلی کاربر محترم شمرده می‌شود.
* **مبلغ در متن notification نمی‌آید** — متن روی صفحهٔ قفل گوشی دیده می‌شود.
  ✅ «بودجهٔ خوراک به سقف نزدیک شد» · ❌ «۳٬۸۰۰٬۰۰۰ از ۴٬۰۰۰٬۰۰۰ خرج شد»
* تصمیم ادمین روی پرداخت ⇒ push با `data.kind` برابر `payment_approved` یا `payment_rejected` و `data.request_id`، به‌علاوهٔ `data.target` برای مسیر مقصد در اپ. از این برای بستن polling صفحهٔ وضعیت استفاده کنید.

---

## ۹. خروجی و کانفیگ

### ۹.۱ `POST /export` — نیازمند توکن

```json
{ "format": "csv", "from": "2026-08-23", "to": "2026-09-22",
  "include": ["transactions", "budgets", "goals", "accounts"] }
```

```json
{
  "data": {
    "format": "csv",
    "url": "http://localhost:3000/v1/files?path=exports%2F…&expires=…&sig=…",
    "expires_in": 900,
    "sections": ["transactions", "budgets", "goals", "accounts"]
  },
  "server_time": "…"
}
```

* `format`: `csv` (همهٔ پلن‌ها) · `xlsx` (نیازمند قابلیت `export.pro_formats`) · `pdf` (**فعلاً `feature_not_available` با پیام «به‌زودی»**)
* `include` اختیاری، پیش‌فرض `["transactions"]`. مقدارهای مجاز: `transactions` · `budgets` · `goals` · `accounts`
* `from`/`to` اختیاری، قالب `YYYY-MM-DD` **میلادی**. فقط روی تراکنش‌ها اثر دارند.
* `url` **امضاشده و ۱۵ دقیقه‌ای** است. با `GET` مستقیم دانلود کنید (توکن لازم ندارد، امضا خودش مجوز است).
* CSV با **BOM** تولید می‌شود تا اکسل فارسی درست بازش کند.
* در جمع‌های خروجی، **انتقال شمرده نمی‌شود** (BR-01) و `spent` بودجه در لحظه محاسبه می‌شود.

> **این endpoint اختیاری است.** CSV را می‌توانید کاملاً آفلاین خودتان بسازید و بهتر است همین کار را بکنید.

**خطاها:** `feature_not_available` (۴۰۳) برای `xlsx` در پلن رایگان و برای `pdf` در همهٔ پلن‌ها · `validation_failed` (۴۲۲) بازهٔ تاریخ غلط.

### ۹.۲ `GET /config/app` — بدون توکن

```json
{
  "data": {
    "min_supported_version": "1.0.0",
    "force_update": false,
    "update_url": "https://nabz.ir/download",
    "support_phone": "09120000000",
    "sync_enabled": true,
    "otp_length": 6,
    "entitlement_grace_days": 7
  },
  "server_time": "…"
}
```

این را در راه‌اندازی بگیرید و **کش کنید**.

* `entitlement_grace_days` را برای منطق مهلت لطف آفلاین (§۲.۶) استفاده کنید.
* `sync_enabled: false` ⇒ همگام‌سازی را کلاً خاموش کنید (سوییچ اضطراری سرور).
* ⚠ **`force_update` با احتیاط:** اگر `true` بود و کاربر **آفلاین** بود، **اپ را قفل نکنید** — کاربر باید بتواند دادهٔ مالی خودش را ببیند.

---

## ۱۰. پنل ادمین

جدا از اپ موبایل، با **احراز هویت مستقل**. توکن کاربر هیچ‌وقت این مسیرها را باز نمی‌کند و برعکس.

### ۱۰.۱ `POST /admin/auth/login`

```json
{ "email": "admin@nabz.ir", "password": "…" }
```

```json
{
  "data": {
    "access_token": "eyJ…",
    "access_expires_in": 28800,
    "admin": { "id": "uuid", "email": "admin@nabz.ir", "name": "ادمین", "role": "admin" }
  },
  "server_time": "…"
}
```

عمر توکن ۸ ساعت. خطای اشتباه: `unauthorized` (۴۰۱) با «ایمیل یا رمز عبور درست نیست.» — هیچ‌وقت نمی‌گوید کدام‌شان غلط بود. سقف ۱۰ تلاش در ۱۰ دقیقه.

### ۱۰.۲ بقیهٔ مسیرها

همه با `Authorization: Bearer <admin_token>`.

| متد | مسیر | بدنه | پاسخ |
|---|---|---|---|
| `GET` | `/admin/payment-requests?status=pending&limit=50&cursor=` | — | `{ items: [...], next_cursor }` — هر item شکل درخواست پرداخت + `user: { id, phone_masked, display_name }` + `receipts: [{ id, channel, note, created_at, file_url, mime_type, size_bytes }]` |
| `POST` | `/admin/payment-requests/{id}/approve` | — | شکل کامل درخواست با `queued`، `starts_at`، `ends_at` |
| `POST` | `/admin/payment-requests/{id}/reject` | `{ "reason": "…" }` | شکل کامل درخواست با `reject_reason` |
| `POST` | `/admin/users/{id}/grant` | `{ "plan_key": "pro", "duration_days": 30, "note": "…" }` | شکل entitlements کاربر |
| `GET` | `/admin/users?q=0912&limit=20` | — | آرایه با `phone_masked`، `trial_used`، `plan` |
| `PUT` | `/admin/billing/catalog` | `{ plans?, prices?, limits?, features? }` | کاتالوگ تازه با `catalog_version` افزایش‌یافته |
| `POST` | `/admin/admins` | `{ "email", "password", "name?" }` | ادمین تازه (رمز حداقل ۱۲ کاراکتر) |

**نکات:**

* شمارهٔ کاربر همیشه **ماسک‌شده** (`0912***81`) می‌آید؛ شمارهٔ کامل در پنل نشان داده نمی‌شود.
* `file_url` رسید **امضاشده و کوتاه‌عمر** است — کش نکنید و لینکش را جای دیگر نفرستید.
* تأیید دوبارهٔ یک درخواست `approved` **اثری ندارد** (دو بار افزودن دوره یعنی کاربر دو برابر گرفته).
* `reject` بدون `reason` رد می‌شود — کاربر باید بداند چرا رد شد.
* `grant` به `is_purchasable` گره نخورده: ادمین می‌تواند پرو بدهد حتی وقتی پرو برای فروش باز نیست.
* در `PUT /admin/billing/catalog`، آرایهٔ `prices` **جای قبلی را می‌گیرد** (مدت حذف‌شده دیگر قابل خرید نیست)؛ بقیه upsert می‌شوند.

---

## ۱۱. جدول کامل خطاها

| `code` | HTTP | پیام فارسی | کار فرانت |
|---|---|---|---|
| `phone_invalid` | ۴۰۰ | شماره موبایل درست نیست. یک شماره موبایل ایران وارد کن. | خطای فیلد شماره |
| `otp_invalid` | ۴۰۱ | کد وارد شده درست نیست. | خطای فیلد کد، شمارندهٔ تلاش را نشان بدهید |
| `otp_expired` | ۴۱۰ | مدت اعتبار کد تمام شده. کد تازه بگیر. | دکمهٔ ارسال دوباره را فعال کنید |
| `otp_locked` | ۴۲۳ | تلاش‌های بیش از حد. کمی بعد دوباره امتحان کن. | شمارش معکوس از `retry_after` |
| `rate_limited` | ۴۲۹ | درخواست‌ها بیش از حد زیاد بود. | شمارش معکوس از `retry_after` |
| `token_expired` | ۴۰۱ | نشست تو تمام شده. دوباره وارد شو. | **refresh کنید؛ اگر آن هم ۴۰۱ داد، صفحهٔ ورود** |
| `token_revoked` | ۴۰۱ | این نشست بسته شده. دوباره وارد شو. | **صفحهٔ ورود** |
| `unauthorized` | ۴۰۱ | برای این کار باید وارد شده باشی. | refresh، بعد صفحهٔ ورود |
| `forbidden` | ۴۰۳ | اجازهٔ این کار را نداری. | پیام را نشان بدهید |
| `not_found` | ۴۰۴ | چیزی که دنبالش بودی پیدا نشد. | برگشت به فهرست |
| `plan_limit_reached` | ۴۰۳ | به سقف پلن فعلی رسیدی… | **شیت ارتقای پلن** |
| `feature_not_available` | ۴۰۳ | این قابلیت در پلن فعلی تو نیست. | شیت ارتقای پلن |
| `payment_request_expired` | ۴۱۰ | مهلت این درخواست پرداخت تمام شده. | دکمهٔ ساخت درخواست تازه |
| `trial_already_used` | ۴۰۹ | دورهٔ آزمایشی قبلاً برای این شماره استفاده شده. | دکمه را پنهان کنید |
| `validation_failed` | ۴۲۲ | اطلاعات فرستاده‌شده کامل یا درست نیست. | `fields` را زیر هر ورودی بگذارید |
| `sync_conflict` | ۴۰۹ | نسخهٔ تازه‌تری از این اطلاعات روی سرور هست. | (در `push` به‌صورت `status: conflict` می‌آید، نه HTTP) |
| `cursor_expired` | ۴۱۰ | نشانگر همگام‌سازی کهنه شده. | **snapshot تازه بگیرید، بی‌صدا** |
| `payload_too_large` | ۴۱۳ | حجم اطلاعات فرستاده‌شده بیش از حد مجاز است. | دسته را کوچک‌تر کنید |
| `server_error` | ۵۰۰ | مشکلی در سرور پیش آمد. | **در صف نگه دارید و بعداً دوباره** — به کاربر خطا نشان ندهید |

---

## ۱۲. چک‌لیست اتصال فرانت

### قبل از شروع

- [ ] `server_time` را یک‌بار بخوانید و `skew` را در کل اپ استفاده کنید
- [ ] توکن‌ها در **Keychain/Keystore**، نه AsyncStorage
- [ ] timeout همهٔ درخواست‌ها **۸ ثانیه**
- [ ] یک interceptor سراسری: `401` با `token_expired` ⇒ refresh (با mutex) و تلاش دوباره؛ `401` با `token_revoked` ⇒ صفحهٔ ورود
- [ ] هدرهای `X-Client`، `X-Device-Id` و `X-Request-Id` روی همهٔ درخواست‌ها
- [ ] هیچ خطای شبکه‌ای به کاربر نشان داده نشود

### کاتالوگ و پلن

- [ ] **هیچ قیمت، سقف یا قابلیتی در کد اپ نیست** — همه از `GET /billing/plans`
- [ ] `limits[key][plan] === null` را **نامحدود** تفسیر کنید، نه صفر
- [ ] `soon: true` ⇒ برچسب «به‌زودی»، **نه پنهان کردن**
- [ ] `is_purchasable: false` ⇒ فقط دکمهٔ خرید نباشد، پلن نمایش داده شود
- [ ] شماره کارت و نام صاحب حساب از `GET /billing/config`، نه از کد
- [ ] `queued: true` و `false` **دو متن متفاوت** دارند
- [ ] `ref_code` با فونت خوانا و قابل کپی

### همگام‌سازی

- [ ] هر عمل محلی یک `op_id` **ثابت** می‌گیرد که در تلاش‌های دوباره عوض نمی‌شود
- [ ] ترتیب صف: حساب/دسته پیش از تراکنش
- [ ] چرخه: **اول `push` بعد `pull`**
- [ ] `sync_cursor` ذخیره می‌شود و `cursor_expired` ⇒ snapshot تازه (بی‌صدا)
- [ ] دسته‌ها به تکه‌های کمتر از ۵۰۰ op شکسته می‌شوند
- [ ] `deleted_at` غیر `null` ⇒ رکورد از UI برداشته می‌شود
- [ ] `status: rejected` با `plan_limit_reached` ⇒ شیت ارتقا، نه Toast خطا
- [ ] `status: server_error` ⇒ op در صف می‌ماند
- [ ] `has_more: true` ⇒ صفحهٔ بعد گرفته می‌شود
- [ ] `localOnly` روشن ⇒ هیچ‌کدام از سه endpoint sync صدا زده نمی‌شود

### داده

- [ ] **انتقال در هیچ جمعی شمرده نمی‌شود و هرگز سبز یا قرمز نیست**
- [ ] `budget.spent`، `goal.monthlyNeed`، `goal.status` و `summary` **محلی محاسبه می‌شوند**
- [ ] پول همیشه **integer تومان** فرستاده می‌شود؛ هیچ اعشاری
- [ ] تاریخ همیشه **ISO یا epoch ms**؛ هیچ رشتهٔ جلالی
- [ ] فقط **چهار رقم آخر** کارت فرستاده و نشان داده می‌شود
- [ ] حساب نقد `card: null` دارد

### اشتراک

- [ ] `entitlements` کش می‌شود و در آفلاین تا `expires_at + grace` معتبر است
- [ ] بعد از آن **بی‌صدا** به `free` برمی‌گردد، نه صفحهٔ خطا
- [ ] `usage` برای نمایش «۲ از ۵» استفاده می‌شود
- [ ] همهٔ محاسبه‌های «روز باقی‌مانده» از `server_time` می‌گذرند

### تنظیمات

- [ ] `appLock` و `biometric` **فقط محلی**، به سرور نمی‌روند
- [ ] `quietFrom`/`quietTo` با **ارقام لاتین** فرستاده می‌شوند (`۲۲:۰۰` فقط در نمایش)
- [ ] `benchmarking` پیش‌فرض **خاموش**
- [ ] روشن کردن `localOnly` با **هشدار صریح** همراه است (دادهٔ سرور پاک می‌شود)
- [ ] `timezone` دستگاه فرستاده می‌شود تا ساعت آرام درست کار کند

### خروج و حذف

- [ ] بعد از logout به کاربر گفته می‌شود **دادهٔ محلی پاک نشده**
- [ ] `wipeAll` عمل جداگانه و محلی است
- [ ] `DELETE /me` با مهلت ۷ روزه و توضیح «ورود بعدی لغوش می‌کند»

---

## پیوست — محیط توسعه

```bash
docker compose up -d postgres
npx prisma migrate deploy
npm run seed
npm run start:dev
```

* API: `http://localhost:3000/v1` · Swagger: `http://localhost:3000/docs`
* درایور پیامک پیش‌فرض `log` است: **کد OTP در لاگ سرور چاپ می‌شود** (`OTP برای 0912***67 → 123456`). برای تست ورود همان را بخوانید.
* ادمین پیش‌فرض: `admin@nabz.ir` / `ChangeMe!123` (از `.env`).
* آزمون دود کل مسیر محصول: `SERVER_LOG=<path> bash scripts/smoke.sh`

سؤال یا مورد جاافتاده؟ جدول تطبیق کامل سند با کد در [`IMPLEMENTATION.md`](IMPLEMENTATION.md) است.
