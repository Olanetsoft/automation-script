const axios = require("axios");
require("dotenv").config();

// ============================================
// CONFIGURATION - LOADED FROM .ENV FILE
// ============================================
const CONFIG = {
  // GitHub Personal Access Token (needs 'public_repo' scope)
  githubToken: process.env.GITHUB_TOKEN,

  // Source repo containing the awesome-dapps README
  sourceOwner: "midnightntwrk",
  sourceRepo: "midnight-awesome-dapps",

  // Issue configuration
  issueTitle: process.env.ISSUE_TITLE || "Default Issue Title",
  issueBody: process.env.ISSUE_BODY || "Default issue body.",
  issueLabels: process.env.ISSUE_LABELS
    ? process.env.ISSUE_LABELS.split(",").map((l) => l.trim())
    : [],

  // Rate limiting (milliseconds between requests)
  delayBetweenRequests: parseInt(process.env.DELAY_BETWEEN_REQUESTS) || 3000,

  // Dry run mode - set to true to preview without creating issues
  dryRun: process.env.DRY_RUN === "true",
};

// ============================================
// GITHUB API SETUP
// ============================================
const githubAPI = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `token ${CONFIG.githubToken}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// FETCH README FROM AWESOME-DAPPS REPO
// ============================================
async function fetchReadme() {
  try {
    const response = await githubAPI.get(
      `/repos/${CONFIG.sourceOwner}/${CONFIG.sourceRepo}/readme`,
      { headers: { Accept: "application/vnd.github.v3.raw" } },
    );
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error fetching README:",
      error.response?.data?.message || error.message,
    );
    process.exit(1);
  }
}

// ============================================
// PARSE GITHUB REPO URLS FROM README
// ============================================
function parseReposFromReadme(readmeContent) {
  // Match GitHub repo links: https://github.com/owner/repo
  // Exclude file-level links (those with /blob/, /tree/, etc.)
  const repoRegex =
    /https:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?=[)\s\]])/g;
  const seen = new Set();
  const repos = [];

  let match;
  while ((match = repoRegex.exec(readmeContent)) !== null) {
    const owner = match[1];
    const repo = match[2];
    const fullUrl = `https://github.com/${owner}/${repo}`;

    // Skip duplicates, non-repo links, GitHub meta pages, and the source repo itself
    const skipOwners = ["apps", "topics", "orgs"];
    if (
      seen.has(fullUrl) ||
      skipOwners.includes(owner) ||
      (owner === CONFIG.sourceOwner && repo === CONFIG.sourceRepo)
    ) {
      continue;
    }

    seen.add(fullUrl);
    repos.push({ owner, repo, url: fullUrl });
  }

  return repos;
}

// ============================================
// CHECK IF REPO EXISTS AND ACCEPTS ISSUES
// ============================================
async function checkRepoAccess(owner, repo) {
  try {
    const response = await githubAPI.get(`/repos/${owner}/${repo}`);
    const repoData = response.data;
    return {
      exists: true,
      hasIssues: repoData.has_issues,
      archived: repoData.archived,
      private: repoData.private,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return { exists: false };
    }
    console.error(
      `   ⚠️  Error checking repo ${owner}/${repo}:`,
      error.message,
    );
    return { exists: false };
  }
}

// ============================================
// CHECK FOR EXISTING ISSUES ON A REPO
// ============================================
async function checkExistingIssue(owner, repo, title) {
  try {
    const response = await githubAPI.get(`/repos/${owner}/${repo}/issues`, {
      params: {
        state: "open",
        per_page: 100,
      },
    });

    const existingIssue = response.data.find((issue) => issue.title === title);
    if (existingIssue) {
      return {
        exists: true,
        url: existingIssue.html_url,
        state: existingIssue.state,
      };
    }
    return { exists: false };
  } catch (error) {
    console.error(
      `   ⚠️  Error checking issues on ${owner}/${repo}:`,
      error.message,
    );
    return { exists: false };
  }
}

// ============================================
// CREATE ISSUE ON A REPO
// ============================================
async function createIssueOnRepo(owner, repo) {
  const title = CONFIG.issueTitle;
  const body = CONFIG.issueBody;

  // Check repo access
  console.log(`   Checking repo access...`);
  const repoInfo = await checkRepoAccess(owner, repo);

  if (!repoInfo.exists) {
    console.log(`   ❌ Repo not found or inaccessible: ${owner}/${repo}\n`);
    return {
      success: false,
      repo: `${owner}/${repo}`,
      error: "Repo not found",
      skipped: true,
    };
  }

  if (repoInfo.archived) {
    console.log(`   ⏭️  Repo is archived: ${owner}/${repo}\n`);
    return {
      success: false,
      repo: `${owner}/${repo}`,
      error: "Repo is archived",
      skipped: true,
    };
  }

  if (!repoInfo.hasIssues) {
    console.log(`   ⏭️  Issues disabled on: ${owner}/${repo}\n`);
    return {
      success: false,
      repo: `${owner}/${repo}`,
      error: "Issues disabled",
      skipped: true,
    };
  }

  // Check for existing issue with same title
  console.log(`   Checking for existing issue...`);
  const existingCheck = await checkExistingIssue(owner, repo, title);

  if (existingCheck.exists) {
    console.log(`   ⚠️  Issue already exists: ${existingCheck.url}`);
    console.log(`   ⏭️  Skipping...\n`);
    return {
      success: false,
      repo: `${owner}/${repo}`,
      error: "Issue already exists",
      duplicate: true,
      url: existingCheck.url,
    };
  }

  // Dry run mode
  if (CONFIG.dryRun) {
    console.log(`   🧪 [DRY RUN] Would create issue on ${owner}/${repo}`);
    console.log(`   Title: ${title}\n`);
    return {
      success: true,
      repo: `${owner}/${repo}`,
      url: "(dry run)",
      dryRun: true,
    };
  }

  // Create the issue
  const issueData = {
    title,
    body,
    labels: CONFIG.issueLabels,
  };

  try {
    const response = await githubAPI.post(
      `/repos/${owner}/${repo}/issues`,
      issueData,
    );

    if (response.status === 201) {
      console.log(`   ✅ Created issue on ${owner}/${repo}`);
      console.log(`   URL: ${response.data.html_url}\n`);
      return {
        success: true,
        repo: `${owner}/${repo}`,
        url: response.data.html_url,
      };
    }
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    console.error(`   ❌ Failed to create issue on ${owner}/${repo}`);
    console.error(`   Error: ${msg}\n`);
    return { success: false, repo: `${owner}/${repo}`, error: msg };
  }
}

// ============================================
// MAIN FUNCTION
// ============================================
async function main() {
  console.log("========================================");
  console.log("Awesome dApps Issue Creator");
  console.log("========================================\n");

  if (!CONFIG.githubToken) {
    console.error("❌ GITHUB_TOKEN is not set in .env");
    process.exit(1);
  }

  if (CONFIG.dryRun) {
    console.log("🧪 DRY RUN MODE — no issues will be created\n");
  }

  console.log(`📝 Issue Title: ${CONFIG.issueTitle}`);
  console.log(
    `📋 Issue Labels: ${CONFIG.issueLabels.join(", ") || "(none)"}\n`,
  );

  // Step 1: Fetch README
  console.log("📖 Fetching README from midnight-awesome-dapps...");
  const readmeContent = await fetchReadme();
  console.log(`✅ README fetched (${readmeContent.length} chars)\n`);

  // Step 2: Parse repos
  console.log("🔍 Parsing GitHub repos from README...");
  const repos = parseReposFromReadme(readmeContent);
  console.log(`✅ Found ${repos.length} unique repos\n`);

  if (repos.length === 0) {
    console.log("No repos found. Exiting.");
    return;
  }

  // Display discovered repos
  console.log("📋 Repos discovered:");
  repos.forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.owner}/${r.repo}`);
  });
  console.log();

  // Step 3: Create issues
  console.log("🚀 Starting to create issues...\n");
  console.log("========================================\n");

  const results = { successful: [], failed: [] };

  for (let i = 0; i < repos.length; i++) {
    const { owner, repo } = repos[i];
    console.log(`[${i + 1}/${repos.length}] ${owner}/${repo}`);

    const result = await createIssueOnRepo(owner, repo);

    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }

    // Rate limiting between requests
    if (i < repos.length - 1) {
      await delay(CONFIG.delayBetweenRequests);
    }
  }

  // Step 4: Summary
  console.log("========================================");
  console.log("SUMMARY");
  console.log("========================================");

  const duplicates = results.failed.filter((r) => r.duplicate);
  const skipped = results.failed.filter((r) => r.skipped);
  const actualFailures = results.failed.filter(
    (r) => !r.duplicate && !r.skipped,
  );

  console.log(`✅ Successfully created: ${results.successful.length} issues`);
  console.log(`🔄 Duplicates skipped: ${duplicates.length}`);
  console.log(`⏭️  Skipped (archived/no issues/not found): ${skipped.length}`);
  console.log(`❌ Failed: ${actualFailures.length}`);

  if (results.successful.length > 0) {
    console.log("\n📋 Created Issues:");
    results.successful.forEach((r) => {
      console.log(`   - ${r.repo} → ${r.url}`);
    });
  }

  if (duplicates.length > 0) {
    console.log("\n🔄 Duplicates (Skipped):");
    duplicates.forEach((r) => {
      console.log(`   - ${r.repo} → ${r.url}`);
    });
  }

  if (skipped.length > 0) {
    console.log("\n⏭️  Skipped:");
    skipped.forEach((r) => {
      console.log(`   - ${r.repo}: ${r.error}`);
    });
  }

  if (actualFailures.length > 0) {
    console.log("\n⚠️ Failed:");
    actualFailures.forEach((r) => {
      console.log(`   - ${r.repo}: ${r.error}`);
    });
  }

  console.log("\n✨ Done!");
}

// ============================================
// RUN THE SCRIPT
// ============================================
main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
