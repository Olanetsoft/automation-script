# Contributor Hub Issue Creator

Creates GitHub issues on the `midnightntwrk/community-hub` repo from an Excel spreadsheet of dApp proposals. Optionally adds each issue to a GitHub Projects V2 board.

## What it does

- Reads dApp ideas from an `.xlsx` file
- Formats each into a structured proposal issue
- Creates the issue on the target repo
- Adds the issue to a project board (if configured)
- Skips duplicate titles and empty rows

## Setup

From the project root:

```bash
npm install
npm install xlsx
cp contributor-hub/.env.example contributor-hub/.env
```

Edit `contributor-hub/.env` with your values.

## Configuration

| Variable                 | Required | Description                                      |
| ------------------------ | -------- | ------------------------------------------------ |
| `GITHUB_TOKEN`           | Yes      | GitHub PAT with `repo` and `project` scopes      |
| `REPO_NAME`              | Yes      | Target repository name (e.g. `community-hub`)    |
| `EXCEL_FILE_PATH`        | Yes      | Path to the `.xlsx` file containing dApp ideas   |
| `DELAY_BETWEEN_REQUESTS` | No       | Milliseconds between API calls (default: `3000`) |

## Usage

```bash
npm run contributor-hub
```

## Excel columns

| Column                                   | Purpose                      |
| ---------------------------------------- | ---------------------------- |
| `Vertical`                               | Category of the dApp         |
| `dApp idea/use case`                     | Name used as the issue title |
| `Description`                            | Description of the idea      |
| `Why Midnight? / How does Midnight fit?` | Midnight relevance           |
| `Existing examples`                      | Similar projects             |
| `Has it been built before?`              | Prior art                    |
| `Examples?`                              | Reference links              |

## Notes

- The script currently processes rows 120-130 (test range). Edit `startIndex` and `endIndex` in `index.js` to change.
- Project board number is hardcoded to `36`. Update `CONFIG.projectNumber` as needed.
- Issues are labelled `dapp proposal`, `idea`, `community`.
