// Reads contribution data from the GitHub GraphQL API and reduces it to the numbers the
// stats cards print. Only aggregates leave this module: repository names are never read
// into the output, because most of the contributions are in private client repositories.

const ENDPOINT = "https://api.github.com/graphql";
const IGNORED_LANGUAGES = new Set(["Dockerfile", "Makefile", "Batchfile", "Procfile"]);

export async function graphql(token, query, variables, { attempts = 3, delayMs = 2000 } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "ravindu0823-profile-cards" },
        body: JSON.stringify({ query, variables }),
      });
      // GitHub's GraphQL endpoint returns transient 502/503s under load; those are retried.
      // A 4xx is a token or query problem and retrying will not fix it.
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!res.ok || json.errors?.length) {
        const message = json.errors?.map((e) => e.message).join("; ") ?? json.message ?? `HTTP ${res.status}`;
        throw Object.assign(new Error(`GitHub GraphQL: ${message}`), { fatal: true });
      }
      return json.data;
    } catch (err) {
      lastError = err;
      if (err.fatal || i === attempts) break;
      await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
  throw lastError;
}

const LAST_YEAR = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionYears
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      restrictedContributionsCount
      contributionCalendar { totalContributions }
      commitContributionsByRepository(maxRepositories: 100) {
        contributions { totalCount }
        repository {
          isPrivate
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            totalSize
            edges { size node { name color } }
          }
        }
      }
    }
  }
}`;

// A contributionsCollection window may span at most one year, so all-time totals and
// streaks need one calendar per contribution year. They are batched into one request.
const yearsQuery = (years) => `query ($login: String!) {
  user(login: $login) {
${years.map((y) => `    y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") {
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
    }`).join("\n")}
  }
}`;

export async function fetchContributions(token, login) {
  const { user } = await graphql(token, LAST_YEAR, { login });
  if (!user) throw new Error(`GitHub user ${login} not found`);
  const lastYear = user.contributionsCollection;
  const yearData = await graphql(token, yearsQuery(lastYear.contributionYears), { login });
  const years = Object.fromEntries(
    lastYear.contributionYears.map((y) => [y, yearData.user[`y${y}`].contributionCalendar]),
  );
  return { lastYear, years };
}

const dayIndex = (date) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

export function computeStreaks(days, today) {
  // Calendars for adjacent years can both carry the boundary day; keep one entry per date.
  const byDate = new Map();
  for (const d of days) {
    if (d.date > today) continue;
    byDate.set(d.date, Math.max(byDate.get(d.date) ?? 0, d.contributionCount));
  }
  const sorted = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

  let longest = 0;
  let run = 0;
  let prev = null;
  for (const [date, count] of sorted) {
    const idx = dayIndex(date);
    run = count > 0 ? (prev !== null && idx - prev === 1 && run > 0 ? run + 1 : 1) : 0;
    longest = Math.max(longest, run);
    prev = idx;
  }

  // Today still counts as "in progress": an empty today keeps yesterday's streak alive.
  let i = sorted.length - 1;
  if (i >= 0 && sorted[i][0] === today && sorted[i][1] === 0) i--;
  // A calendar that stops before yesterday is stale data, not a live streak.
  if (i >= 0 && dayIndex(today) - dayIndex(sorted[i][0]) > 1) i = -1;
  let current = 0;
  for (let expected = i >= 0 ? dayIndex(sorted[i][0]) : 0; i >= 0; i--, expected--) {
    const [date, count] = sorted[i];
    if (count === 0 || dayIndex(date) !== expected) break;
    current++;
  }
  return { current, longest };
}

export function weightLanguages(repos, { limit = 6 } = {}) {
  // Weight each repository's language mix by the commits made to it. Raw byte counts would
  // let one vendored CSS bundle outweigh a year of C#.
  const weights = new Map();
  for (const { contributions, repository } of repos) {
    const { totalSize, edges } = repository.languages;
    const kept = edges.filter((e) => !IGNORED_LANGUAGES.has(e.node.name));
    const size = kept.reduce((a, e) => a + e.size, 0);
    if (!totalSize || !size) continue;
    for (const e of kept) {
      const prev = weights.get(e.node.name) ?? { name: e.node.name, color: e.node.color ?? "#8b949e", weight: 0 };
      prev.weight += (contributions.totalCount * e.size) / size;
      weights.set(e.node.name, prev);
    }
  }
  const total = [...weights.values()].reduce((a, l) => a + l.weight, 0);
  if (!total) return [];
  const ranked = [...weights.values()].sort((a, b) => b.weight - a.weight).map((l) => ({ name: l.name, color: l.color, share: l.weight / total }));
  if (ranked.length <= limit) return ranked;
  const other = ranked.slice(limit).reduce((a, l) => a + l.share, 0);
  return [...ranked.slice(0, limit), { name: "Other", color: "#8b949e", share: other }];
}

export function summarize(lastYear, years, today) {
  const days = Object.values(years).flatMap((c) => c.weeks.flatMap((w) => w.contributionDays));
  const repos = lastYear.commitContributionsByRepository;
  return {
    contributions: lastYear.contributionCalendar.totalContributions,
    allTime: Object.values(years).reduce((a, c) => a + c.totalContributions, 0),
    since: Math.min(...Object.keys(years).map(Number)),
    commits: lastYear.totalCommitContributions,
    pullRequests: lastYear.totalPullRequestContributions,
    reviews: lastYear.totalPullRequestReviewContributions,
    issues: lastYear.totalIssueContributions,
    repositories: lastYear.totalRepositoriesWithContributedCommits,
    // Non-zero means the token cannot see some private work, so the counts are partial.
    restricted: lastYear.restrictedContributionsCount,
    privateRepos: repos.filter((r) => r.repository.isPrivate).length,
    languageRepos: repos.filter((r) => r.repository.languages.totalSize > 0).length,
    streak: computeStreaks(days, today),
    languages: weightLanguages(repos),
  };
}

// Fail closed: a token that lost its scopes returns a well-formed but shrunken profile, and
// publishing that would replace a good card with zeros or public-only numbers. Refuse
// instead, so the workflow keeps the last good card and goes red.
export function validate(s, { expectPrivate = false } = {}) {
  if (!(s.contributions > 0)) throw new Error("validate: no contributions in the last year; refusing to publish");
  if (!s.languages.length) throw new Error("validate: no languages resolved; refusing to publish");
  if (s.allTime < s.contributions) throw new Error(`validate: all-time total ${s.allTime} is below the last-year total ${s.contributions}`);
  if (expectPrivate && (s.privateRepos === 0 || s.restricted > 0)) {
    throw new Error(`validate: private work not visible (privateRepos=${s.privateRepos}, restricted=${s.restricted}); the token likely lost the repo scope`);
  }
  return s;
}
