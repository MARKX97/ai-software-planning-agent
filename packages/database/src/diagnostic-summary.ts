/** Redact likely credentials and cap diagnostic message content at 240 characters. */
export function summarizeDiagnosticText(content: string): string {
  const redacted = content
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
    .replace(/(api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
  return redacted.length > 240 ? `${redacted.slice(0, 237)}...` : redacted;
}
