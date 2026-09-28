import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('عدد را به قالب سند تبدیل می‌کند', () => {
    expect(encodeCursor(871)).toBe('c_000871');
    expect(encodeCursor(0n)).toBe('c_000000');
    expect(encodeCursor(1234567)).toBe('c_1234567');
  });

  it('رفت و برگشت مقدار را حفظ می‌کند', () => {
    expect(decodeCursor(encodeCursor(871))).toBe(871n);
  });

  it('نشانگر خالی یعنی از ابتدا', () => {
    expect(decodeCursor(undefined)).toBe(0n);
    expect(decodeCursor('')).toBe(0n);
  });

  it('نشانگر بی‌قالب را رد می‌کند تا کلاینت snapshot تازه بگیرد', () => {
    expect(decodeCursor('871')).toBeNull();
    expect(decodeCursor('c_abc')).toBeNull();
    expect(decodeCursor('x_000871')).toBeNull();
  });
});
