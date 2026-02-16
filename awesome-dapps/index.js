const fs = require("fs");
const path = require("path");
const axios = require("axios");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// --- Template parsing ---

function parseIssueTemplate(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const content = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    console.error(
      "Error: issue-template.md must have YAML front matter between --- delimiters.",
    );
    process.exit(1);
  }

  const frontMatter = match[1];
  const body = match[2].trim();

  const titleMatch = frontMatter.match(/^title:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "";

  let labels = [];
  const listMatch = frontMatter.match(/^labels:\s*\n((?:\s+-\s+.+\n?)+)/m);
  if (listMatch) {
    labels = listMatch[1]
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean);
  } else {
    const inlineMatch = frontMatter.match(/^labels:\s*(.+)$/m);
    if (inlineMatch) {
      labels = inlineMatch[1]
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
    }
  }

  if (!title) {
    console.error(
      "Error: issue-template.md is missing a title in front matter.",
    );
    process.exit(1);
  }

  if (!body) {
    console.error(
      "Error: issue-template.md has no body content after front matter.",
    );
    process.exit(1);
  }

  return { title, body, labels };
}

// --- Configuration ---

const templatePath = path.join(__dirname, "issue-template.md");
if (!fs.existsSync(templatePath)) {
  console.error(`Error: issue-template.md not found at ${templatePath}`);
  process.exit(1);
}

const {
  title: issueTitle,
  body: issueBody,
  labels: issueLabels,
} = parseIssueTemplate(templatePath);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SOURCE_OWNER = "midnightntwrk";
const SOURCE_REPO = "midnight-awesome-dapps";
const DELAY = parseInt(process.env.DELAY_BETWEEN_REQUESTS, 10) || 3000;
const DRY_RUN = process.env.DRY_RUN === "true";

const api = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- GitHub helpers ---

async function fetchReadme() {
  try {
    const { data } = await api.get(
      `/repos/${SOURCE_OWNER}/${SOURCE_REPO}/readme`,
      { headers: { Accept: "application/vnd.github.v3.raw" } },
    );
    return data;
  } catch (err) {
    console.error(
      "Error fetching README:",
      err.response?.data?.message || err.message,
    );
    process.exit(1);
  }
}

function parseReposFromReadme(content) {
  const regex = /https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/g;
  const skip = new Set(["apps", "topics", "orgs", "contact"]);
  const seen = new Set();
  const repos = [];

  let m;
  while ((m = regex.exec(content)) !== null) {
    const [, owner, repo] = m;
    const key = `${owner}/${repo}`;
    if (
      seen.has(key) ||
      skip.has(owner) ||
      (owner === SOURCE_OWNER && repo === SOURCE_REPO)
    ) {
      continue;
    }
    seen.add(key);
    repos.push({ owner, repo });
  }

  return repos;
}

async function getRepoInfo(owner, repo) {
  try {
    const { data } = await api.get(`/repos/${owner}/${repo}`);
    return {
      exists: true,
      hasIssues: data.has_issues,
      archived: data.archived,
    };
  } catch {
    return { exists: false };
  }
}

async function hasOpenIssueWithTitle(owner, repo, title) {
  try {
    const { data } = await api.get(`/repos/${owner}/${repo}/issues`, {
      params: { state: "open", per_page: 100 },
    });
    const found = data.find((i) => i.title === title);
    return found ? { exists: true, url: found.html_url } : { exists: false };
  } catch {
    return { exists: false };
  }
}

async function processRepo(owner, repo) {
  const slug = `${owner}/${repo}`;

  const info = await getRepoInfo(owner, repo);
  if (!info.exists) return { slug, status: "skipped", reason: "not found" };
  if (info.archived) return { slug, status: "skipped", reason: "archived" };
  if (!info.hasIssues)
    return { slug, status: "skipped", reason: "issues disabled" };

  const existing = await hasOpenIssueWithTitle(owner, repo, issueTitle);
  if (existing.exists) return { slug, status: "duplicate", url: existing.url };

  if (DRY_RUN) return { slug, status: "dry-run" };

  try {
    const { data } = await api.post(`/repos/${owner}/${repo}/issues`, {
      title: issueTitle,
      body: issueBody,
      labels: issueLabels,
    });
    return { slug, status: "created", url: data.html_url };
  } catch (err) {
    return {
      slug,
      status: "failed",
      reason: err.response?.data?.message || err.message,
    };
  }
}

// --- Main ---

async function main() {
  if (!GITHUB_TOKEN) {
    console.error("Error: GITHUB_TOKEN is not set in .env");
    process.exit(1);
  }

  console.log("========================================");
  console.log("Awesome dApps Issue Creator");
  console.log("========================================\n");

  if (DRY_RUN) console.log("[DRY RUN] No issues will be created.\n");

  console.log(`Title:  ${issueTitle}`);
  console.log(`Labels: ${issueLabels.join(", ") || "(none)"}\n`);

  console.log("Fetching README...");
  const readme = await fetchReadme();

  const repos = parseReposFromReadme(readme);
  console.log(`Found ${repos.length} repos.\n`);

  if (repos.length === 0) return;

  const results = [];

  for (let i = 0; i < repos.length; i++) {
    const { owner, repo } = repos[i];
    const slug = `${owner}/${repo}`;
    console.log(`[${i + 1}/${repos.length}] ${slug}`);

    const result = await processRepo(owner, repo);
    results.push(result);

    switch (result.status) {
      case "created":
        console.log(`  -> Created: ${result.url}`);
        break;
      case "dry-run":
        console.log(`  -> Would create (dry run)`);
        break;
      case "duplicate":
        console.log(`  -> Duplicate: ${result.url}`);
        break;
      case "skipped":
        console.log(`  -> Skipped: ${result.reason}`);
        break;
      case "failed":
        console.log(`  -> Failed: ${result.reason}`);
        break;
    }

    if (i < repos.length - 1) await sleep(DELAY);
  }

  const count = (s) => results.filter((r) => r.status === s).length;

  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================");
  if (DRY_RUN) console.log(`Would create: ${count("dry-run")}`);
  else console.log(`Created:    ${count("created")}`);
  console.log(`Duplicates: ${count("duplicate")}`);
  console.log(`Skipped:    ${count("skipped")}`);
  console.log(`Failed:     ${count("failed")}`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
