export function parseYMDDateStrict(input: string): Date | null {
  // Accept `YYYY-M-D` or `YYYY-MM-DD` but reject non-existent calendar dates.
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.trim());
  if (!m) return null;

  const year = Number(m[1]);
  const month1to12 = Number(m[2]);
  const day1to31 = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month1to12) || !Number.isFinite(day1to31)) return null;

  if (month1to12 < 1 || month1to12 > 12) return null;
  if (day1to31 < 1 || day1to31 > 31) return null;

  const utcMs = Date.UTC(year, month1to12 - 1, day1to31);
  const d = new Date(utcMs);

  // Verify components match exactly (rejects overflow like Feb 31 -> Mar 3).
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month1to12 - 1 ||
    d.getUTCDate() !== day1to31
  ) {
    return null;
  }

  return d;
}

