/**
 * "Live from GitHub": loads public repositories from the GitHub API
 * and shows the repo count, a language breakdown and the most
 * recently updated repositories. Results are cached for the visit
 * (sessionStorage) to stay well inside GitHub's anonymous rate limit.
 * If GitHub can't be reached, a short message and the profile link remain.
 */
window.App.githubLive = (() => {
  "use strict";
  const { $, escapeHtml: esc } = window.App;

  const API = "https://api.github.com";
  const RECENT_COUNT = 4;
  const LANGUAGE_COLORS = {
    Python: "#3776AB", "Jupyter Notebook": "#F37626", JavaScript: "#F7DF1E", HTML: "#E34F26",
    CSS: "#663399", HCL: "#844FBA", Shell: "#89E051", TypeScript: "#3178C6",
  };
  const DEFAULT_COLOR = "#9a9aa5";

  async function fetchRepos(user) {
    const cacheKey = `github-repos:${user}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* storage unavailable: just fetch */ }

    const response = await fetch(`${API}/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const repos = (await response.json())
      .filter((repo) => !repo.fork)
      .map(({ name, html_url, description, language, pushed_at, size }) => ({ name, html_url, description, language, pushed_at, size }));

    try { sessionStorage.setItem(cacheKey, JSON.stringify(repos)); } catch { /* ignore */ }
    return repos;
  }

  /** "3 days ago" / "قبل 3 أيام", in the page language. */
  function timeAgo(isoDate, lang) {
    const seconds = (new Date(isoDate) - Date.now()) / 1000;
    const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    const format = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(0, "minute");
  }

  function languageShares(repos) {
    const counts = {};
    for (const repo of repos) if (repo.language) counts[repo.language] = (counts[repo.language] ?? 0) + 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, share: (count / total) * 100, color: LANGUAGE_COLORS[name] ?? DEFAULT_COLOR }));
  }

  function render(repos, content) {
    const { t, lang } = content;
    // empty repositories (size 0) are left out of the counts
    const nonEmpty = repos.filter((repo) => repo.size > 0);
    $("#github-repo-count").textContent = nonEmpty.length;

    const shares = languageShares(nonEmpty);
    $("#github-language-bar").innerHTML = shares
      .map((l) => `<span style="width: ${l.share}%; background: ${l.color}" title="${esc(l.name)}"></span>`)
      .join("");
    $("#github-language-legend").innerHTML = shares
      .map((l) => `<li><i style="background: ${l.color}"></i>${esc(l.name)} <span>${Math.round(l.share)}%</span></li>`)
      .join("");

    $("#github-repos").innerHTML = nonEmpty
      .slice(0, RECENT_COUNT)
      .map((repo) => `
        <li>
          <a href="${esc(repo.html_url)}" target="_blank" rel="noopener">
            <b>${esc(repo.name)}</b>
            <p>${esc(repo.description || content.repoDescriptions[repo.name] || t("github.noDescription"))}</p>
            <span class="repo-meta">
              ${repo.language ? `<i style="background: ${LANGUAGE_COLORS[repo.language] ?? DEFAULT_COLOR}"></i>${esc(repo.language)} · ` : ""}
              ${esc(timeAgo(repo.pushed_at, lang))}
            </span>
          </a>
        </li>`)
      .join("");
  }

  function showError(t) {
    $("#github-repos").innerHTML = `<li class="muted">${esc(t("github.error"))}</li>`;
  }

  async function init(content) {
    const user = content.githubUser;
    $("#github-profile").href = `https://github.com/${encodeURIComponent(user)}`;
    const container = $("#github-live");

    // Only call the API once the section is about to scroll into view.
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      try {
        render(await fetchRepos(user), content);
      } catch {
        showError(content.t);
      } finally {
        container.setAttribute("aria-busy", "false");
      }
    }, { rootMargin: "400px 0px" });
    observer.observe(container);
  }

  return { init };
})();
