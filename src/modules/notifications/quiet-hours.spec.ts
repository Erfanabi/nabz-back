import { isQuietNow, minutesOfDay } from './quiet-hours';

const tehran = (isoUtc: string) => new Date(isoUtc);
const base = { quietHours: true, quietFrom: '22:00', quietTo: '08:00', timezone: 'Asia/Tehran' };

describe('minutesOfDay', () => {
  it('ساعت را به دقیقه تبدیل می‌کند', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('22:00')).toBe(1320);
    expect(minutesOfDay('08:30')).toBe(510);
  });
});

describe('isQuietNow — بازهٔ شبانه', () => {
  // تهران UTC+03:30
  it('نیمه‌شب به وقت تهران در ساعت آرام است', () => {
    expect(isQuietNow(tehran('2026-09-25T20:30:00Z'), base)).toBe(true); // 00:00 تهران
  });

  it('ظهر به وقت تهران در ساعت آرام نیست', () => {
    expect(isQuietNow(tehran('2026-09-25T08:30:00Z'), base)).toBe(false); // 12:00 تهران
  });

  it('مرز شروع شامل است و مرز پایان نیست', () => {
    expect(isQuietNow(tehran('2026-09-25T18:30:00Z'), base)).toBe(true); // 22:00
    expect(isQuietNow(tehran('2026-09-25T18:29:00Z'), base)).toBe(false); // 21:59
    expect(isQuietNow(tehran('2026-09-25T04:30:00Z'), base)).toBe(false); // 08:00
    expect(isQuietNow(tehran('2026-09-25T04:29:00Z'), base)).toBe(true); // 07:59
  });

  it('خاموش بودن ساعت آرام همه‌چیز را باز می‌کند', () => {
    expect(isQuietNow(tehran('2026-09-25T20:30:00Z'), { ...base, quietHours: false })).toBe(false);
  });
});

describe('isQuietNow — بازهٔ روزانه و حالت‌های مرزی', () => {
  it('بازهٔ درون‌روز درست کار می‌کند', () => {
    const day = { ...base, quietFrom: '09:00', quietTo: '17:00' };
    expect(isQuietNow(tehran('2026-09-25T08:30:00Z'), day)).toBe(true); // 12:00
    expect(isQuietNow(tehran('2026-09-25T16:30:00Z'), day)).toBe(false); // 20:00
  });

  it('بازهٔ صفر یعنی ساعت آرامی وجود ندارد', () => {
    expect(isQuietNow(tehran('2026-09-25T20:30:00Z'), { ...base, quietFrom: '22:00', quietTo: '22:00' })).toBe(false);
  });

  it('منطقهٔ زمانی نامعتبر هشدار را بی‌صدا نمی‌کند', () => {
    expect(isQuietNow(tehran('2026-09-25T20:30:00Z'), { ...base, timezone: 'Not/AZone' })).toBe(false);
  });

  it('منطقهٔ زمانی دیگر، بازه را جابه‌جا می‌کند', () => {
    const utc = { ...base, timezone: 'UTC' };
    expect(isQuietNow(tehran('2026-09-25T23:00:00Z'), utc)).toBe(true);
    expect(isQuietNow(tehran('2026-09-25T20:30:00Z'), utc)).toBe(false); // 20:30 UTC
  });
});
