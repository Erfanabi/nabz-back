#!/usr/bin/env bash
# مسیر کامل: ورود ← entitlements ← پرداخت ← تأیید ادمین ← snapshot ← push ← pull
# کد OTP از لاگ سرور خوانده می‌شود، پس فقط با درایور پیامک `log` کار می‌کند.
set -euo pipefail

BASE="${BASE:-http://localhost:3000/v1}"
PHONE="${PHONE:-0912$(printf '%07d' $((RANDOM % 10000000)))}"
LOG="${SERVER_LOG:?مسیر لاگ سرور را در SERVER_LOG بده}"
ADMIN_EMAIL="${ADMIN_SEED_EMAIL:-admin@nabz.ir}"
ADMIN_PASS="${ADMIN_SEED_PASSWORD:-ChangeMe!123}"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);const p='$1'.split('.');let v=o;for(const k of p)v=v?.[k];console.log(typeof v==='object'?JSON.stringify(v):v)})"; }
uuid() { node -e "console.log(require('crypto').randomUUID())"; }

say "۱. کانفیگ عمومی (بدون توکن)"
curl -fsS "$BASE/config/app" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log('  min_version:',o.data.min_supported_version,'| grace:',o.data.entitlement_grace_days,'| server_time:',o.server_time)})"

say "۲. کاتالوگ پلن‌ها (بدون توکن)"
curl -fsS "$BASE/billing/plans" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  نسخه:',d.catalog_version,'| پلن:',d.plans.length,'| سقف:',Object.keys(d.limits).length,'| قابلیت:',d.features.length,'| قیمت پلاس ۹۰روزه:',d.prices.plus['90'])})"

say "۳. درخواست OTP برای $PHONE"
curl -fsS -X POST "$BASE/auth/otp/request" -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"device_id\":\"smoke-device\"}" | j data.expires_in | sed 's/^/  اعتبار کد (ثانیه): /'

sleep 1
CODE=$(grep -o 'OTP برای .* → [0-9]\{6\}' "$LOG" | tail -1 | grep -o '[0-9]\{6\}$')
echo "  کد از لاگ: $CODE"

say "۴. تأیید OTP"
VERIFY=$(curl -fsS -X POST "$BASE/auth/otp/verify" -H 'Content-Type: application/json' \
  -H 'X-Client: nabz-app/1.0.0 (android 14)' \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\",\"device_id\":\"smoke-device\",\"device_name\":\"Pixel 8\"}")
ACCESS=$(echo "$VERIFY" | j data.access_token)
REFRESH=$(echo "$VERIFY" | j data.refresh_token)
echo "  is_new: $(echo "$VERIFY" | j data.is_new)$(echo "$VERIFY" | j data.user.is_new)"
echo "  پلن اولیه: $(echo "$VERIFY" | j data.entitlements.effective_plan)"
AUTH=(-H "Authorization: Bearer $ACCESS")

say "۵. چرخش توکن و رد شدن توکن کهنه"
NEW=$(curl -fsS -X POST "$BASE/auth/token/refresh" -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH\"}")
REFRESH2=$(echo "$NEW" | j data.refresh_token)
STALE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/token/refresh" -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$REFRESH\"}")
echo "  توکن کهنه → HTTP $STALE (باید ۴۰۱ باشد)"

say "۶. ورود دوباره (جلسهٔ دوم) چون استفادهٔ دوبارهٔ توکن همهٔ جلسه‌ها را بست"
curl -fsS -X POST "$BASE/auth/otp/request" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}" > /dev/null
sleep 1
CODE=$(grep -o 'OTP برای .* → [0-9]\{6\}' "$LOG" | tail -1 | grep -o '[0-9]\{6\}$')
VERIFY=$(curl -fsS -X POST "$BASE/auth/otp/verify" -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\",\"device_id\":\"smoke-device-2\",\"device_name\":\"iPhone 16\"}")
ACCESS=$(echo "$VERIFY" | j data.access_token)
USER_ID=$(echo "$VERIFY" | j data.user.id)
AUTH=(-H "Authorization: Bearer $ACCESS")
echo "  کاربر: $USER_ID"

say "۷. جلسه‌های فعال"
curl -fsS "${AUTH[@]}" "$BASE/auth/sessions" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const x of JSON.parse(s).data)console.log('  -',x.device_name,'| is_current:',x.is_current)})"

say "۸. ساخت حساب و دسته و تراکنش با sync/push"
ACC1=$(uuid); ACC2=$(uuid); CAT=$(uuid); TX1=$(uuid); TX2=$(uuid)
NOW=$(node -e 'console.log(Date.now())')
PUSH_BODY=$(cat <<JSON
{"ops":[
 {"op_id":"$(uuid)","entity":"account","action":"create","client_updated_at":$NOW,
  "payload":{"id":"$ACC1","name":"بانک ملت","icon":"bank","balance":42500000,
             "card":{"bin":"610433","last4":"1234","expiry":"07/29","bank":"ملت","tone":"rose"}}},
 {"op_id":"$(uuid)","entity":"account","action":"create","client_updated_at":$NOW,
  "payload":{"id":"$ACC2","name":"نقد","icon":"cash","balance":500000,"card":null}},
 {"op_id":"$(uuid)","entity":"category","action":"create","client_updated_at":$NOW,
  "payload":{"id":"$CAT","name":"خوراک","icon":"food","color":"amber","custom":true,"order":1}},
 {"op_id":"$(uuid)","entity":"transaction","action":"create","client_updated_at":$NOW,
  "payload":{"id":"$TX1","type":"expense","amount":185000,"name":"نان","category":"$CAT","account":"$ACC1",
             "occurred_at":"2026-09-25T09:10:00Z"}},
 {"op_id":"$(uuid)","entity":"transaction","action":"create","client_updated_at":$NOW,
  "payload":{"id":"$TX2","type":"transfer","amount":5000000,"name":"انتقال","from":"$ACC1","to":"$ACC2",
             "occurred_at":"2026-09-24T12:00:00Z"}},
 {"op_id":"dup-check-op","entity":"transaction","action":"create","client_updated_at":$NOW,
  "payload":{"id":"$(uuid)","type":"expense","amount":1000.5,"name":"مبلغ اعشاری","category":"$CAT","account":"$ACC1",
             "occurred_at":"2026-09-25T09:10:00Z"}},
 {"op_id":"$(uuid)","entity":"transaction","action":"create","client_updated_at":$NOW,
  "payload":{"id":"$(uuid)","type":"transfer","amount":100,"name":"انتقال با دسته","category":"$CAT",
             "from":"$ACC1","to":"$ACC2","occurred_at":"2026-09-25T09:10:00Z"}}
]}
JSON
)
RES=$(curl -fsS -X POST "$BASE/sync/push" "${AUTH[@]}" -H 'Content-Type: application/json' -d "$PUSH_BODY")
echo "$RES" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  cursor:',d.sync_cursor);for(const r of d.results)console.log('  -',r.status,r.message??'')})"

say "۹. ارسال دوبارهٔ همان دسته → همه duplicate، هیچ رکورد تکراری"
curl -fsS -X POST "$BASE/sync/push" "${AUTH[@]}" -H 'Content-Type: application/json' -d "$PUSH_BODY" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s).data.results;console.log('  وضعیت‌ها:',[...new Set(r.map(x=>x.status))].join(', '))})"

say "۱۰. snapshot — انتقال بدون دسته، بودجه بدون spent"
curl -fsS "${AUTH[@]}" "$BASE/sync/snapshot" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;
 console.log('  حساب:',d.accounts.length,'| دسته:',d.categories.length,'| تراکنش:',d.transactions.length);
 for(const t of d.transactions)console.log('   -',t.type,t.amount,'| کلیدها:',Object.keys(t).filter(k=>['category','account','from','to'].includes(k)).join(','));
 console.log('  کارت حساب نقد:',JSON.stringify(d.accounts.find(a=>a.name==='نقد').card))})"

say "۱۱. سقف پلن رایگان: حساب سوم رد می‌شود (سقف ۲)"
curl -fsS -X POST "$BASE/sync/push" "${AUTH[@]}" -H 'Content-Type: application/json' \
 -d "{\"ops\":[{\"op_id\":\"$(uuid)\",\"entity\":\"account\",\"action\":\"create\",\"client_updated_at\":$NOW,\"payload\":{\"id\":\"$(uuid)\",\"name\":\"حساب سوم\",\"balance\":0}}]}" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s).data.results[0];console.log('  ',r.status,'|',r.code,'|',r.message)})"

say "۱۲. entitlements و مصرف سقف‌ها"
curl -fsS "${AUTH[@]}" "$BASE/me/entitlements" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  پلن:',d.effective_plan,'| انقضا:',d.expires_at,'| trial_used:',d.trial_used);console.log('  مصرف:',JSON.stringify(d.usage))})"

say "۱۳. درخواست پرداخت پلاس ۹۰ روزه"
IDEM=$(uuid)
PR=$(curl -fsS -X POST "$BASE/billing/payment-requests" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $IDEM" -d '{"plan_key":"plus","duration_days":90}')
PR_ID=$(echo "$PR" | j data.id)
echo "  کد پیگیری: $(echo "$PR" | j data.ref_code) | مبلغ: $(echo "$PR" | j data.amount_toman) | وضعیت: $(echo "$PR" | j data.status)"

say "۱۴. تکرار همان Idempotency-Key → همان کد پیگیری، HTTP 200"
curl -s -o "$PWD/.pr2.json" -w '  HTTP %{http_code}\n' -X POST "$BASE/billing/payment-requests" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $IDEM" -d '{"plan_key":"plus","duration_days":90}'
echo "  کد پیگیری: $(j data.ref_code < "$PWD/.pr2.json")"; rm -f "$PWD/.pr2.json"

say "۱۵. درخواست pending تکراری (بدون کلید) → همان درخواست، بدون کد دوم"
curl -s -o "$PWD/.pr3.json" -w '  HTTP %{http_code}\n' -X POST "$BASE/billing/payment-requests" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"plan_key":"plus","duration_days":90}'
echo "  همان id؟ $([ "$(j data.id < "$PWD/.pr3.json")" = "$PR_ID" ] && echo بله || echo خیر)"; rm -f "$PWD/.pr3.json"

say "۱۶. خرید پرو → رد (is_purchasable=false)"
curl -s -X POST "$BASE/billing/payment-requests" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"plan_key":"pro","duration_days":30}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const e=JSON.parse(s).error;console.log('  ',e.code,'|',e.message)})"

say "۱۷. اعلام ارسال رسید"
curl -fsS -X POST "$BASE/billing/payment-requests/$PR_ID/receipt" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"channel":"telegram","note":"واریز از کارت 6037997512345678 ساعت ۱۴:۳۰"}' > /dev/null && echo "  رسید ثبت شد (شمارهٔ کارت در متن ماسک می‌شود)"

say "۱۸. ورود ادمین و تأیید واریزی"
ADMIN=$(curl -fsS -X POST "$BASE/admin/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" | j data.access_token)
AADM=(-H "Authorization: Bearer $ADMIN")
curl -fsS "${AADM[@]}" "$BASE/admin/payment-requests?status=pending" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const i=JSON.parse(s).data.items;console.log('  در انتظار:',i.length);if(i[0]){console.log('  شمارهٔ ماسک‌شده:',i[0].user.phone_masked);console.log('  متن رسید ذخیره‌شده:',i[0].receipts[0]?.note)}})"
curl -fsS -X POST "$BASE/admin/payment-requests/$PR_ID/approve" "${AADM[@]}" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  وضعیت:',d.status,'| queued:',d.queued,'| starts_at:',d.starts_at,'| ends_at:',d.ends_at)})"

say "۱۹. entitlements پس از تأیید (ارتقا فوری)"
curl -fsS "${AUTH[@]}" "$BASE/me/entitlements" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  پلن:',d.effective_plan,'| منبع:',d.source,'| صف:',JSON.stringify(d.queued))})"

say "۲۰. تمدید همان پلن → صف‌شده، نه فوری"
PR2=$(curl -fsS -X POST "$BASE/billing/payment-requests" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"plan_key":"plus","duration_days":30}' | j data.id)
curl -fsS -X POST "$BASE/admin/payment-requests/$PR2/approve" "${AADM[@]}" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  queued:',d.queued,'(باید true باشد)')})"
curl -fsS "${AUTH[@]}" "$BASE/me/entitlements" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  پلن فعال:',d.effective_plan,'| صف:',JSON.stringify(d.queued))})"

say "۲۱. دورهٔ آزمایشی دو بار داده نمی‌شود"
curl -s -X POST "$BASE/billing/trial" "${AUTH[@]}" -H 'Content-Type: application/json' > /dev/null
curl -s -X POST "$BASE/billing/trial" "${AUTH[@]}" -H 'Content-Type: application/json' \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log('  ',o.error?o.error.code+' | '+o.error.message:'بدون خطا (مشکل!)')})"

say "۲۲. تنظیمات و ساعت آرام"
curl -fsS -X PUT "$BASE/settings" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"calendar":"jalali","digits":"fa","quietFrom":"22:00","quietTo":"08:00","alerts":{"savingRateDown":true}}' \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  تقویم:',d.calendar,'| ساعت آرام:',d.quietFrom,'-',d.quietTo,'| localOnly:',d.localOnly);console.log('  هشدارها:',JSON.stringify(d.alerts))})"

say "۲۳. pull با نشانگر و نشانگر نامعتبر"
CUR=$(curl -fsS "${AUTH[@]}" "$BASE/sync/snapshot" | j data.sync_cursor)
curl -fsS "${AUTH[@]}" "$BASE/sync/pull?cursor=$CUR" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  دلتا خالی؟',d.transactions.length===0&&d.accounts.length===0,'| cursor:',d.sync_cursor)})"
curl -s "${AUTH[@]}" "$BASE/sync/pull?cursor=bogus" -o "$PWD/.c.json" -w '  نشانگر نامعتبر → HTTP %{http_code}\n'
echo "  کد خطا: $(j error.code < "$PWD/.c.json")"; rm -f "$PWD/.c.json"

say "۲۴. خروجی CSV و رد شدن اکسل در پلن پلاس/رایگان"
curl -fsS -X POST "$BASE/export" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"format":"csv","include":["transactions","budgets","accounts"]}' \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  قالب:',d.format,'| بخش‌ها:',d.sections.join(','));console.log('  URL امضاشده:',d.url.slice(0,72)+'…')})"

say "۲۵. localOnly روشن → همگام‌سازی بسته و دادهٔ سرور پاک"
curl -fsS -X PUT "$BASE/settings" "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"localOnly":true}' > /dev/null
curl -s "${AUTH[@]}" "$BASE/sync/snapshot" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const e=JSON.parse(s).error;console.log('  ',e.code,'|',e.message)})"
curl -fsS -X PUT "$BASE/settings" "${AUTH[@]}" -H 'Content-Type: application/json' -d '{"localOnly":false}' > /dev/null
curl -fsS "${AUTH[@]}" "$BASE/sync/snapshot" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s).data;console.log('  بعد از خاموش کردن: تراکنش‌های سرور =',d.transactions.length,'(باید ۰ باشد)')})"

say "✓ همهٔ مسیرها اجرا شد"
