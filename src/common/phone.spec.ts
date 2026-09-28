import { normalizePhone, maskPhone, toLatinDigits } from './phone';

describe('normalizePhone', () => {
  it('شمارهٔ ساده را بدون تغییر می‌پذیرد', () => {
    expect(normalizePhone('09121234567')).toBe('09121234567');
  });

  it('قالب +98 و 0098 و 98 را نرمال می‌کند', () => {
    expect(normalizePhone('+989121234567')).toBe('09121234567');
    expect(normalizePhone('00989121234567')).toBe('09121234567');
    expect(normalizePhone('989121234567')).toBe('09121234567');
    expect(normalizePhone('9121234567')).toBe('09121234567');
  });

  it('ارقام فارسی و عربی را تبدیل می‌کند', () => {
    expect(normalizePhone('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
    expect(normalizePhone('٠٩١٢١٢٣٤٥٦٧')).toBe('09121234567');
    expect(normalizePhone('+۹۸ ۹۱۲ ۱۲۳ ۴۵۶۷')).toBe('09121234567');
  });

  it('فاصله، خط تیره و پرانتز را نادیده می‌گیرد', () => {
    expect(normalizePhone('0912 123 4567')).toBe('09121234567');
    expect(normalizePhone('0912-123-4567')).toBe('09121234567');
    expect(normalizePhone('(0912) 123.4567')).toBe('09121234567');
  });

  it('نویسه‌های کنترل جهت متن را حذف می‌کند', () => {
    expect(normalizePhone('‏09121234567‎')).toBe('09121234567');
  });

  it('همهٔ پیش‌شمارهای مجاز موبایل را می‌پذیرد', () => {
    for (const prefix of ['090', '091', '092', '093', '099']) {
      expect(normalizePhone(`${prefix}12345678`)).toBe(`${prefix}12345678`);
    }
  });

  it('خط ثابت را رد می‌کند چون پیامک به آن نمی‌رسد', () => {
    expect(normalizePhone('02112345678')).toBeNull();
    expect(normalizePhone('+982112345678')).toBeNull();
  });

  it('پیش‌شمارهٔ موبایل نامعتبر را رد می‌کند', () => {
    expect(normalizePhone('09412345678')).toBeNull();
    expect(normalizePhone('09812345678')).toBeNull();
  });

  it('طول نادرست و ورودی بی‌ربط را رد می‌کند', () => {
    expect(normalizePhone('0912123456')).toBeNull();
    expect(normalizePhone('091212345678')).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('سلام')).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('maskPhone', () => {
  it('میانهٔ شماره را می‌پوشاند تا در لاگ کامل نیفتد', () => {
    expect(maskPhone('09121234567')).toBe('0912***67');
    expect(maskPhone('0912')).toBe('***');
  });
});

describe('toLatinDigits', () => {
  it('متن غیررقمی را دست نمی‌زند', () => {
    expect(toLatinDigits('مبلغ ۱۲۳')).toBe('مبلغ 123');
  });
});
