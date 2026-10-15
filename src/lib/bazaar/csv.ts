/**
 * Safe CSV string generator.
 * Prevents CSV formula injection by prepending single quotes to cells starting with =, +, -, @.
 */

function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // Formula injection mitigation: if the first character is dangerous, prepend a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Escape double quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(sanitizeCell).join(",");
  const rowLines = rows.map((row) => row.map(sanitizeCell).join(","));
  return [headerLine, ...rowLines].join("\r\n");
}
