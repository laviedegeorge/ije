/**
 * Neutralize spreadsheet formula injection: a cell starting with = or @ (or a
 * leading tab/CR), or with + / - followed by anything but a digit, is treated
 * as a formula by Google Sheets/Excel. Prefixing a single quote forces text.
 * Phone numbers like "+234 803…" are left alone; the Apps Script also writes
 * every cell as plain text, so this is a second line of defence.
 */
const FORMULA_TRIGGER_RE = /^(?:[=@\t\r]|[+-](?![\d\s(]))/;

export const sanitizeSheetCell = (value: string): string =>
	FORMULA_TRIGGER_RE.test(value) ? `'${value}` : value;
