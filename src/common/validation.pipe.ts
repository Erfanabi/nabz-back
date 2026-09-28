import { BadRequestException, ValidationPipe, ValidationError } from '@nestjs/common';

/**
 * خطای اعتبارسنجی را به `fields` فارسی تبدیل می‌کند.
 *
 * دلیل: پیام خطای سرور مستقیم به کاربر نشان داده می‌شود (BACKEND-SPEC §۸)، پس
 * `property should not be empty` قابل قبول نیست. اگر DTO خودش پیام فارسی داده
 * باشد همان استفاده می‌شود، وگرنه از روی نام constraint یک پیام فارسی ساخته می‌شود.
 */
const FALLBACK_BY_CONSTRAINT: Record<string, string> = {
  isNotEmpty: 'این فیلد لازم است.',
  isDefined: 'این فیلد لازم است.',
  isString: 'باید متن باشد.',
  isInt: 'باید عدد صحیح باشد.',
  isNumber: 'باید عدد باشد.',
  isBoolean: 'باید بله یا خیر باشد.',
  isUuid: 'شناسه معتبر نیست.',
  isEmail: 'ایمیل معتبر نیست.',
  isIn: 'مقدار انتخاب‌شده معتبر نیست.',
  isEnum: 'مقدار انتخاب‌شده معتبر نیست.',
  isArray: 'باید فهرست باشد.',
  arrayMaxSize: 'تعداد موارد بیش از حد مجاز است.',
  arrayMinSize: 'حداقل یک مورد لازم است.',
  min: 'عدد کوچک‌تر از حد مجاز است.',
  max: 'عدد بزرگ‌تر از حد مجاز است.',
  maxLength: 'طول متن بیش از حد مجاز است.',
  minLength: 'طول متن کمتر از حد مجاز است.',
  matches: 'قالب مقدار درست نیست.',
  isIso8601: 'تاریخ باید به قالب ISO 8601 باشد.',
  isDateString: 'تاریخ باید به قالب ISO 8601 باشد.',
};

function isPersian(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

function flatten(errors: ValidationError[], prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const err of errors) {
    const path = prefix ? `${prefix}.${err.property}` : err.property;
    if (err.constraints) {
      const entries = Object.entries(err.constraints);
      const persian = entries.find(([, msg]) => isPersian(msg));
      if (persian) {
        out[path] = persian[1];
      } else {
        const [name] = entries[0];
        out[path] = FALLBACK_BY_CONSTRAINT[name] ?? 'مقدار این فیلد درست نیست.';
      }
    }
    if (err.children?.length) {
      Object.assign(out, flatten(err.children, path));
    }
  }
  return out;
}

export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    validateCustomDecorators: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new BadRequestException({ code: 'validation_failed', fields: flatten(errors) }),
  });
}
