import { z } from 'zod';

const SECRET_SOURCES = [
  'sk-[A-Za-z0-9_-]{16,}',
  '(?:api[_-]?key|access[_-]?token|secret|password)\\s*[:=]\\s*["\']?[A-Za-z0-9_./+=-]{20,}',
] as const;

/** True when text contains a high-confidence credential pattern. */
export function containsSensitiveText(value: string): boolean {
  return SECRET_SOURCES.some((source) => new RegExp(source, 'i').test(value));
}

/** Remove high-confidence credentials before model or log boundaries. */
export function redactSensitiveText(value: string): string {
  return SECRET_SOURCES.reduce(
    (current, source) => current.replace(new RegExp(source, 'gi'), '[REDACTED]'),
    value,
  );
}

/** User-authored text that must not contain likely credentials. */
export function safeUserTextSchema(maxLength: number): z.ZodEffects<z.ZodString> {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => !containsSensitiveText(value), '请删除输入中的 API Key、Token 或密码。');
}
