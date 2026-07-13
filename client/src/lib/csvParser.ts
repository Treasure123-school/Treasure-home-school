/**
 * RFC-4180-compliant CSV parser (browser-safe, no dependencies).
 *
 * Why this exists: naive `content.split('\n')` before tokenizing a CSV file
 * silently corrupts any field that was quoted specifically because it
 * contains embedded line breaks (e.g. a reading passage/poem pasted into a
 * "QuestionText" cell). Each internal line break gets treated as the start
 * of a brand new row, shredding one real row into many broken fragments.
 *
 * This parser scans the *entire* file content as a single character stream
 * and only treats a line break as a row separator when it is outside an
 * open quoted field. It also handles:
 *   - CRLF and lone-CR line endings (common from Excel/Windows exports)
 *   - Escaped quotes inside quoted fields ("" -> ")
 *   - A leading UTF-8 BOM (common from Excel "CSV UTF-8" exports)
 */

/** Parses raw CSV text into rows of raw (untrimmed) string fields. */
export function parseCSVToRows(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, ''); // strip BOM if present
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // consume escaped quote pair
        } else {
          inQuotes = false;
        }
      } else {
        field += ch; // includes literal \n / \r inside a quoted field
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++; // treat \r\n as one line break
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // Flush the final field/row (files don't always end with a trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully-blank rows (e.g. a trailing blank line, or blank lines between records)
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

/**
 * Parses CSV text into a header row + data rows, trimming each field.
 * Throws if the file has no header + at least one data row.
 */
export function parseCSVWithHeaders(content: string): ParsedCSV {
  const allRows = parseCSVToRows(content).map(r => r.map(f => f.trim()));
  if (allRows.length < 2) {
    throw new Error('CSV needs a header row + at least one data row');
  }
  const [headers, ...rows] = allRows;
  return { headers, rows };
}

/** Case-insensitive column getter bound to a specific header row. */
export function makeColumnGetter(headers: string[], row: string[]) {
  const normalized = headers.map(h => h.toLowerCase());
  return (name: string): string => {
    const idx = normalized.indexOf(name.toLowerCase());
    return idx >= 0 ? (row[idx]?.trim() ?? '') : '';
  };
}
