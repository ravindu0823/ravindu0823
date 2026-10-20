import assert from "node:assert/strict";
import { test } from "node:test";
import { computeStreaks, graphql, summarize, validate, weightLanguages } from "./github.mjs";
import { renderActivityCard, renderLanguagesCard } from "./stats.mjs";
import { THEMES } from "./theme.mjs";

const day = (date, count) => ({ date, contributionCount: count });

test("current streak counts back from today", () => {
  const days = [day("2026-10-17", 0), day("2026-10-18", 2), day("2026-10-19", 1), day("2026-10-20", 5)];
  assert.deepEqual(computeStreaks(days, "2026-10-20"), { current: 3, longest: 3 });
});

test("an empty today does not break the current streak yet", () => {
  const days = [day("2026-10-18", 1), day("2026-10-19", 1), day("2026-10-20", 0)];
  assert.equal(computeStreaks(days, "2026-10-20").current, 2);
});

test("an empty yesterday does break it", () => {
  const days = [day("2026-10-18", 1), day("2026-10-19", 0), day("2026-10-20", 0)];
  assert.equal(computeStreaks(days, "2026-10-20").current, 0);
});

test("a calendar that stops before yesterday has no current streak", () => {
  const days = [day("2026-10-10", 1), day("2026-10-11", 1)];
  assert.deepEqual(computeStreaks(days, "2026-10-21"), { current: 0, longest: 2 });
});

test("future calendar days are ignored and a missing date breaks a run", () => {
  const days = [
    day("2026-01-01", 1), day("2026-01-02", 1), /* 01-03 missing */ day("2026-01-04", 1),
    day("2026-01-05", 1), day("2026-01-06", 1), day("2026-12-30", 9),
  ];
  assert.deepEqual(computeStreaks(days, "2026-01-06"), { current: 3, longest: 3 });
});

test("year calendars that overlap at the boundary are de-duplicated", () => {
  const days = [day("2025-12-31", 1), day("2026-01-01", 1), day("2025-12-31", 1), day("2026-01-02", 1)];
  assert.deepEqual(computeStreaks(days, "2026-01-02"), { current: 3, longest: 3 });
});

const repo = (commits, isPrivate, langs) => ({
  contributions: { totalCount: commits },
  repository: {
    isPrivate,
    languages: {
      totalSize: langs.reduce((a, [, s]) => a + s, 0),
      edges: langs.map(([name, size]) => ({ size, node: { name, color: `#${name.length}00000` } })),
    },
  },
});

test("languages are weighted by commits, not by repository size", () => {
  const out = weightLanguages([
    repo(90, true, [["C#", 1_000]]),
    repo(10, false, [["CSS", 9_000_000]]),
  ]);
  assert.equal(out[0].name, "C#");
  assert.equal(out[0].share.toFixed(2), "0.90");
});

test("build-file languages are ignored and repos without languages are skipped", () => {
  const out = weightLanguages([repo(5, false, [["Dockerfile", 50], ["Go", 50]]), repo(3, false, [])]);
  assert.deepEqual(out.map((l) => l.name), ["Go"]);
  assert.equal(out[0].share, 1);
});

test("the tail beyond the limit is folded into Other", () => {
  const langs = ["A", "B", "C", "D"].map((n, i) => repo(10 - i, false, [[n, 1]]));
  const out = weightLanguages(langs, { limit: 2 });
  assert.deepEqual(out.map((l) => l.name), ["A", "B", "Other"]);
  assert.equal(out.reduce((a, l) => a + l.share, 0).toFixed(6), "1.000000");
});

const lastYear = {
  totalCommitContributions: 2907,
  totalPullRequestContributions: 436,
  totalPullRequestReviewContributions: 43,
  totalIssueContributions: 39,
  totalRepositoriesWithContributedCommits: 107,
  restrictedContributionsCount: 0,
  contributionYears: [2026, 2025],
  contributionCalendar: { totalContributions: 3467 },
  commitContributionsByRepository: [repo(2900, true, [["C#", 1]])],
};
const years = {
  2026: { totalContributions: 3000, weeks: [{ contributionDays: [day("2026-10-20", 4)] }] },
  2025: { totalContributions: 2000, weeks: [{ contributionDays: [day("2025-12-31", 1)] }] },
};

test("summarize builds the numbers the cards print", () => {
  const s = summarize(lastYear, years, "2026-10-20");
  assert.equal(s.contributions, 3467);
  assert.equal(s.allTime, 5000);
  assert.equal(s.since, 2025);
  assert.equal(s.commits, 2907);
  assert.equal(s.repositories, 107);
  assert.equal(s.privateRepos, 1);
  assert.equal(s.streak.current, 1);
  assert.equal(s.languages[0].name, "C#");
});

test("validate refuses data that would overwrite a good card with an empty one", () => {
  const good = summarize(lastYear, years, "2026-10-20");
  assert.doesNotThrow(() => validate(good));
  assert.throws(() => validate({ ...good, contributions: 0 }), /no contributions/);
  assert.throws(() => validate({ ...good, languages: [] }), /no languages/);
  assert.throws(() => validate({ ...good, allTime: 10 }), /all-time/);
});

test("validate with expectPrivate refuses a token that can no longer see private work", () => {
  const good = summarize(lastYear, years, "2026-10-20");
  assert.doesNotThrow(() => validate(good, { expectPrivate: true }));
  assert.throws(() => validate({ ...good, privateRepos: 0 }, { expectPrivate: true }), /private work not visible/);
  assert.throws(() => validate({ ...good, restricted: 12 }, { expectPrivate: true }), /private work not visible/);
  assert.doesNotThrow(() => validate({ ...good, privateRepos: 0 }));
});

test("a repo whose only language is ignored contributes nothing, and a null colour gets a fallback", () => {
  const nullColour = repo(4, false, [["Zig", 10]]);
  nullColour.repository.languages.edges[0].node.color = null;
  const out = weightLanguages([repo(9, false, [["Dockerfile", 10]]), nullColour]);
  assert.deepEqual(out, [{ name: "Zig", color: "#8b949e", share: 1 }]);
});

const mockFetch = (responses) => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    const r = responses[Math.min(calls.length, responses.length - 1)];
    calls.push(r);
    return { ok: r.status < 400, status: r.status, json: async () => r.body };
  };
  return { calls, restore: () => (globalThis.fetch = original) };
};

test("graphql retries a 5xx and then returns data", async () => {
  const m = mockFetch([{ status: 502, body: {} }, { status: 200, body: { data: { ok: 1 } } }]);
  try {
    assert.deepEqual(await graphql("t", "q", {}, { attempts: 3, delayMs: 0 }), { ok: 1 });
    assert.equal(m.calls.length, 2);
  } finally { m.restore(); }
});

test("graphql does not retry a 401 or a response carrying errors", async () => {
  for (const r of [{ status: 401, body: { message: "Bad credentials" } }, { status: 200, body: { data: { user: null }, errors: [{ message: "boom" }] } }]) {
    const m = mockFetch([r, { status: 200, body: { data: {} } }]);
    try {
      await assert.rejects(graphql("t", "q", {}, { attempts: 3, delayMs: 0 }), /GitHub GraphQL/);
      assert.equal(m.calls.length, 1);
    } finally { m.restore(); }
  }
});

test("cards escape text and colours that come from the API", () => {
  const s = summarize(lastYear, years, "2026-10-20");
  s.languages = [{ name: "C<&>\"", color: '#123"/><script>', share: 1 }];
  for (const t of Object.values(THEMES)) {
    const svg = renderLanguagesCard(t, s, new Date("2026-10-20T00:00:00Z")) + renderActivityCard(t, s, new Date("2026-10-20T00:00:00Z"));
    assert.ok(!svg.includes("<script>"));
    assert.ok(svg.includes("C&lt;&amp;&gt;&quot;"));
    assert.equal((svg.match(/<svg /g) ?? []).length, 2);
  }
});
