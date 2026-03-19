import type { Contact } from "./types";
import { parseYMDDateStrict } from "./validation/date";

const KEYWORDS = [
  { keyword: "mentor", weight: 40 },
  { keyword: "investor", weight: 30 },
  { keyword: "advisor", weight: 20 },
  { keyword: "friend", weight: 10 },
] as const;

function parseDateMaybe(iso: string): Date | null {
  return parseYMDDateStrict(iso);
}

function daysSince(date: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((now.getTime() - date.getTime()) / msPerDay);
}

function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export function buildRecommendations(contacts: Contact[]): Array<{ name: string; reason: string }> {
  const now = new Date();

  const ranked = contacts
    .map((c) => {
      const date = parseDateMaybe(c.lastContactedDate);
      const ds = date ? daysSince(date, now) : null;

      const notes = (c.notes ?? "").toLowerCase();
      const matched = KEYWORDS.filter((k) => notes.includes(k.keyword));

      const shouldRecommend =
        (ds !== null && ds >= 30) || matched.length > 0;

      if (!shouldRecommend) return null;

      const topKeyword = matched.sort((a, b) => b.weight - a.weight)[0];
      const keywordBoost = topKeyword ? topKeyword.weight : 0;
      const overdueDays = ds ?? 0;
      const priorityScore = overdueDays + keywordBoost;

      let reason = "";
      if (topKeyword && ds !== null && ds >= 30) {
        reason = `${titleCase(topKeyword.keyword)} and not contacted in ${ds} days`;
      } else if (topKeyword && ds !== null && ds < 30) {
        reason = `${titleCase(topKeyword.keyword)} keyword match; last contacted ${ds} days ago`;
      } else if (topKeyword && ds === null) {
        reason = `${titleCase(topKeyword.keyword)} keyword match; lastContactedDate invalid`;
      } else if (!topKeyword && ds !== null && ds >= 30) {
        reason = `Not contacted in ${ds} days`;
      } else {
        reason = `Recommended based on relationship signals`;
      }

      return { name: c.name, reason, priorityScore, lastContactedDate: ds };
    })
    .filter((x): x is Exclude<typeof x, null> => x !== null);

  ranked.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    // Tie-breaker: higher overdue (older contact) first; invalid dates last.
    const aDs = a.lastContactedDate ?? -1;
    const bDs = b.lastContactedDate ?? -1;
    if (bDs !== aDs) return bDs - aDs;
    return a.name.localeCompare(b.name);
  });

  return ranked.map((r) => ({ name: r.name, reason: r.reason }));
}

