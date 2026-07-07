/**
 * Prompt template renderer.
 *
 * Renders `{{variable}}` placeholders using `String.prototype.replace`. No
 * conditionals, no string concatenation in callers — only direct variable
 * substitution, per `specs/prompt.spec.md` §2.3.
 *
 * @internal
 */
export function renderPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}
