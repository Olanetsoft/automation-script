# Awesome dApps Issue Creator

Creates a custom GitHub issue on every repository listed in the [midnight-awesome-dapps](https://github.com/midnightntwrk/midnight-awesome-dapps) README.

## What it does

- Fetches the README from `midnightntwrk/midnight-awesome-dapps`
- Parses all GitHub repository links
- Creates an issue with a custom title and body on each repo
- Skips archived repos, repos with issues disabled, and repos that already have an open issue with the same title

## Setup

From the project root:

```bash
npm install
cp awesome-dapps/.env.example awesome-dapps/.env
```

Edit `awesome-dapps/.env` with your values.

## Configuration

| Variable                 | Required | Description                                                        |
| ------------------------ | -------- | ------------------------------------------------------------------ |
| `GITHUB_TOKEN`           | Yes      | GitHub PAT with `public_repo` scope                                |
| `ISSUE_TITLE`            | Yes      | Title for the issue                                                |
| `ISSUE_BODY`             | Yes      | Body content for the issue                                         |
| `ISSUE_LABELS`           | No       | Comma-separated labels (e.g. `bug,help wanted`)                    |
| `DELAY_BETWEEN_REQUESTS` | No       | Milliseconds between API calls (default: `3000`)                   |
| `DRY_RUN`                | No       | Set to `true` to preview without creating issues (default: `true`) |

## Usage

Preview (dry run, no issues created):

```bash
npm run awesome-dapps:dry
```

Create issues:

Set `DRY_RUN=false` in your `.env`, then:

```bash
npm run awesome-dapps
```

## Notes

- Dry run is enabled by default.
- Duplicate detection is based on issue title. If an open issue with the same title exists, the repo is skipped.
- Repos that are archived or have issues disabled are skipped.
