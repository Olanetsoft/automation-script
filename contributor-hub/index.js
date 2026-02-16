const path = require("path");
const xlsx = require("xlsx");
const axios = require("axios");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// ============================================
// CONFIGURATION - LOADED FROM .ENV FILE
// ============================================
const CONFIG = {
  // GitHub Personal Access Token (needs 'repo' and 'project' permissions)
  githubToken: process.env.GITHUB_TOKEN,

  // Repository details
  repoOwner: "midnightntwrk",
  repoName: process.env.REPO_NAME,

  // Project board details
  projectNumber: 36, // From your URL

  // File path to your Excel file
  excelFilePath: process.env.EXCEL_FILE_PATH,

  // Rate limiting (milliseconds between requests)
  delayBetweenRequests: parseInt(process.env.DELAY_BETWEEN_REQUESTS) || 3000,
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

const githubGraphQL = axios.create({
  baseURL: "https://api.github.com/graphql",
  headers: {
    Authorization: `Bearer ${CONFIG.githubToken}`,
    "Content-Type": "application/json",
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDAppProposalDescription(idea) {
  // Extract data from Excel row - check for actual content
  const vertical = idea["Vertical"] || "General";
  const dAppName = idea["dApp idea/use case"] || "Unnamed dApp";
  const description = idea["Description"];
  const whyMidnight = idea["Why Midnight? / How does Midnight fit?"];
  const existingExamples = idea["Existing examples"];
  const hasBeenBuilt = idea["Has it been built before?"];
  const examples = idea["Examples?"];

  // Helper function to check if a field has meaningful content
  const hasContent = (field) => field && field.toString().trim() !== "";

  // Create the formatted description following the template
  return `**Give your dApp a name or working title:** ${dAppName}

**One-sentence summary of the idea:** ${
    hasContent(description) ? description : "To be determined"
  }

### 🔍 Problem Statement
**What problem does this solve or what opportunity does it unlock?**
${hasContent(description) ? description : "To be determined"}

**Why does this dApp need to exist? What user pain or need is it addressing?**
${hasContent(whyMidnight) ? whyMidnight : "To be determined"}

### 🌐 Target Users
**Who would use this dApp?**
To be determined based on use case analysis

**How would they benefit from Midnight's data-protection features?**
To be determined based on use case requirements

### 🔧 Core Functionality
**What are the key features or actions users would take in the app?**
Based on the concept: ${
    hasContent(description) ? description : "To be determined"
  }

**Key features to be developed:**
To be assessed based on requirements analysis

### 🔐 Privacy & ZK Usage
**How would you leverage Midnight's privacy features or zero-knowledge technology?**
${hasContent(whyMidnight) ? whyMidnight : "To be determined"}

### 📦 Technical Considerations
**Do you have a preferred tech stack or prior implementation?**
- Frontend: To be determined
- Smart contracts: To be determined
- Backend: To be determined

**Any integrations or infrastructure required?**
- Additional requirements to be assessed

### 📈 Maturity & Next Steps
- [x] Idea stage
- [ ] I'm building this and want feedback
- [ ] I'm looking for collaborators
- [ ] I'd like help from the Midnight team

### 🔗 Related Resources
**Has it been built before?** ${
    hasContent(hasBeenBuilt) ? hasBeenBuilt : "To be determined"
  }

**Existing examples in the space:** ${
    hasContent(existingExamples) ? existingExamples : "N/A"
  }

**Examples:** ${hasContent(examples) ? examples : "N/A"}

**Additional resources:** To be determined

---
*Vertical: ${vertical}*`;
}

// ============================================
// GET PROJECT ID
// ============================================
async function getProjectId() {
  const query = `
    query {
      organization(login: "${CONFIG.repoOwner}") {
        projectV2(number: ${CONFIG.projectNumber}) {
          id
          title
        }
      }
    }
  `;

  try {
    const response = await githubGraphQL.post("", { query });
    if (response.data.data?.organization?.projectV2) {
      console.log(
        `✅ Found project: ${response.data.data.organization.projectV2.title}`,
      );
      return response.data.data.organization.projectV2.id;
    }
    return null;
  } catch (error) {
    console.error(
      "❌ Error fetching project ID:",
      error.response?.data || error.message,
    );
    return null;
  }
}

// ============================================
// ADD ISSUE TO PROJECT
// ============================================
async function addIssueToProject(issueId, projectId) {
  const mutation = `
    mutation {
      addProjectV2ItemById(
        input: {
          projectId: "${projectId}"
          contentId: "${issueId}"
        }
      ) {
        item {
          id
        }
      }
    }
  `;

  try {
    const response = await githubGraphQL.post("", { query: mutation });
    if (response.data.data?.addProjectV2ItemById?.item) {
      return true;
    }
    return false;
  } catch (error) {
    console.error(
      "❌ Error adding to project:",
      error.response?.data || error.message,
    );
    return false;
  }
}

// ============================================
// CHECK FOR EXISTING ISSUES
// ============================================
async function checkExistingIssue(title) {
  try {
    // Search for existing OPEN issues with the same title (closed issues are not duplicates)
    const response = await githubAPI.get(
      `/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/issues`,
      {
        params: {
          state: "open", // Only check open issues - closed issues can be recreated
          per_page: 100,
        },
      },
    );

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
    console.error("❌ Error checking existing issues:", error.message);
    return { exists: false }; // If we can't check, proceed with creation
  }
}

// ============================================
// CREATE GITHUB ISSUE
// ============================================
async function createGitHubIssue(idea, projectId) {
  const dAppName = idea["dApp idea/use case"];

  // Skip if dApp name/use case is empty
  if (!dAppName || dAppName.toString().trim() === "") {
    console.log(`⏭️  Skipping row - no dApp name/use case provided\n`);
    return {
      success: false,
      title: "No dApp name provided",
      error: "Empty dApp name/use case field",
      skipped: true,
    };
  }

  const title = `[dApp Proposal] ${dAppName}`;
  const body = formatDAppProposalDescription(idea);

  // Check if issue already exists
  console.log(`   Checking for existing issue...`);
  const existingCheck = await checkExistingIssue(title);

  if (existingCheck.exists) {
    console.log(`⚠️  Issue already exists: ${title}`);
    console.log(`   URL: ${existingCheck.url} (${existingCheck.state})`);
    console.log(`   ⏭️  Skipping and continuing with next idea...\n`);
    return {
      success: false,
      title,
      error: "Issue already exists",
      duplicate: true,
      url: existingCheck.url,
    };
  }

  const issueData = {
    title: title,
    body: body,
    labels: ["dapp proposal", "idea", "community"],
  };

  try {
    // Create the issue
    const response = await githubAPI.post(
      `/repos/${CONFIG.repoOwner}/${CONFIG.repoName}/issues`,
      issueData,
    );

    if (response.status === 201) {
      console.log(`✅ Created issue: ${title}`);
      console.log(`   URL: ${response.data.html_url}`);

      // Add to project if projectId is available
      if (projectId) {
        const added = await addIssueToProject(response.data.node_id, projectId);
        if (added) {
          console.log(`   ✅ Added to project board #${CONFIG.projectNumber}`);
        } else {
          console.log(`   ⚠️  Failed to add to project board`);
        }
      }

      return { success: true, title, url: response.data.html_url };
    }

    return {
      success: false,
      title,
      error: `Unexpected status ${response.status}`,
    };
  } catch (error) {
    console.error(`❌ Failed to create issue: ${title}`);
    console.error(
      `   Error: ${error.response?.data?.message || error.message}`,
    );
    return { success: false, title, error: error.message };
  }
}

// ============================================
// FIND DUPLICATE DAPP NAMES IN EXCEL
// ============================================
function findDuplicateDAppNames(data) {
  const nameCount = {};
  const duplicates = [];

  // Count occurrences of each dApp name
  data.forEach((idea, index) => {
    const dappName = idea["dApp idea/use case"];
    if (dappName && dappName.toString().trim() !== "") {
      const normalizedName = dappName.toString().trim().toLowerCase();

      if (!nameCount[normalizedName]) {
        nameCount[normalizedName] = {
          originalName: dappName.toString().trim(),
          rows: [],
        };
      }
      nameCount[normalizedName].rows.push(index + 2); // +2 because Excel rows start at 1 and we have headers
    }
  });

  // Find names that appear more than once
  Object.values(nameCount).forEach((nameInfo) => {
    if (nameInfo.rows.length > 1) {
      duplicates.push({
        name: nameInfo.originalName,
        rows: nameInfo.rows,
      });
    }
  });

  return duplicates;
}

// ============================================
// MAIN FUNCTION
// ============================================
async function main() {
  console.log("========================================");
  console.log("GitHub dApp Proposal Creator");
  console.log("========================================\n");

  // Step 1: Read Excel file
  console.log("📖 Reading Excel file...");
  let workbook;
  try {
    workbook = xlsx.readFile(CONFIG.excelFilePath);
  } catch (error) {
    console.error("❌ Error reading Excel file:", error.message);
    console.error(
      "   Make sure the file path is correct:",
      CONFIG.excelFilePath,
    );
    process.exit(1);
  }

  // Get all sheets and combine data
  console.log(
    `📋 Found ${
      workbook.SheetNames.length
    } sheet(s): ${workbook.SheetNames.join(", ")}`,
  );

  let allData = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const sheetData = xlsx.utils.sheet_to_json(sheet);
    console.log(`   Sheet "${sheetName}": ${sheetData.length} ideas`);
    allData = allData.concat(sheetData);
  });

  console.log(`✅ Total ideas found across all sheets: ${allData.length}\n`);
  const data = allData;

  // Step 1.5: Check for duplicate dApp names in Excel
  console.log("🔍 Checking for duplicate dApp names in Excel...");
  const excelDuplicates = findDuplicateDAppNames(data);

  if (excelDuplicates.length > 0) {
    console.log(`⚠️  Found ${excelDuplicates.length} duplicate dApp name(s):`);
    excelDuplicates.forEach((duplicate) => {
      console.log(
        `   "${duplicate.name}" appears in rows: ${duplicate.rows.join(", ")}`,
      );
    });
    console.log("   Consider reviewing the Excel file for data quality.\n");
  } else {
    console.log("✅ No duplicate dApp names found.\n");
  }

  // Step 2: Get Project ID
  console.log("🔍 Looking for project board...");
  const projectId = await getProjectId();

  if (projectId) {
    console.log(`✅ Will add issues to project #${CONFIG.projectNumber}\n`);
  } else {
    console.log(
      `⚠️  Could not find project #${CONFIG.projectNumber}. Issues will be created without project assignment.\n`,
    );
  }

  // Step 3: Create issues
  console.log("🚀 Starting to create GitHub issues...\n");
  console.log("========================================\n");

  const results = {
    successful: [],
    failed: [],
  };

  // TESTING: Process ideas from 120 to 130
  const startIndex = 120;
  const endIndex = 130;
  const itemsToProcess = Math.min(endIndex, data.length) - startIndex;
  console.log(
    `🧪 TEST MODE: Processing ideas ${startIndex + 1} to ${Math.min(
      endIndex,
      data.length,
    )} (${itemsToProcess} idea(s))\n`,
  );

  for (let i = startIndex; i < Math.min(endIndex, data.length); i++) {
    const idea = data[i];
    console.log(
      `Processing ${i + 1}/${data.length} (item ${
        i - startIndex + 1
      }/${itemsToProcess}):`,
    );

    const result = await createGitHubIssue(idea, projectId);

    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }

    // Rate limiting
    if (i < Math.min(endIndex, data.length) - 1) {
      console.log(
        `⏳ Waiting ${
          CONFIG.delayBetweenRequests / 1000
        } seconds before next request...\n`,
      );
      await delay(CONFIG.delayBetweenRequests);
    }
  }

  // Step 4: Summary
  console.log("\n========================================");
  console.log("SUMMARY");
  console.log("========================================");

  const duplicates = results.failed.filter((r) => r.duplicate);
  const skipped = results.failed.filter((r) => r.skipped);
  const actualFailures = results.failed.filter(
    (r) => !r.duplicate && !r.skipped,
  );

  console.log(`✅ Successfully created: ${results.successful.length} issues`);
  console.log(`🔄 Duplicates skipped: ${duplicates.length} issues`);
  console.log(`⏭️  Empty entries skipped: ${skipped.length} issues`);
  console.log(`❌ Failed: ${actualFailures.length} issues`);

  if (results.successful.length > 0) {
    console.log("\n📋 Created Issues:");
    results.successful.forEach((issue) => {
      console.log(`   - ${issue.title}`);
      console.log(`     ${issue.url}`);
    });
  }

  if (duplicates.length > 0) {
    console.log("\n🔄 Duplicate Issues (Skipped):");
    duplicates.forEach((issue) => {
      console.log(`   - ${issue.title}`);
      console.log(`     Already exists: ${issue.url}`);
    });
  }

  if (skipped.length > 0) {
    console.log("\n⏭️  Empty Entries (Skipped):");
    skipped.forEach((issue) => {
      console.log(`   - Row with no dApp name/use case`);
    });
  }

  if (actualFailures.length > 0) {
    console.log("\n⚠️ Failed Issues:");
    actualFailures.forEach((issue) => {
      console.log(`   - ${issue.title}`);
      console.log(`     Error: ${issue.error}`);
    });
  }

  console.log("\n✨ Process completed!");
}

// ============================================
// RUN THE SCRIPT
// ============================================
main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
