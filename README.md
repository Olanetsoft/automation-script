# Automation Scripts

A collection of scripts for automating GitHub issue creation across Midnight ecosystem repositories.

## Structure

```
.
├── awesome-dapps/       # Create issues on repos listed in midnight-awesome-dapps
│   ├── index.js
│   └── .env.example
├── contributor-hub/     # Create dApp proposal issues from an Excel spreadsheet
│   ├── index.js
│   └── .env.example
├── .env                 # Shared environment variables (git-ignored)
└── package.json
```

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your GitHub token and configuration.

## Scripts

| Command                     | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `npm run awesome-dapps`     | Create issues on repos from the awesome-dapps README |
| `npm run awesome-dapps:dry` | Preview without creating issues                      |
| `npm run contributor-hub`   | Create dApp proposal issues from Excel               |

## Documentation

- [awesome-dapps/README.md](awesome-dapps/README.md) - Usage and configuration for the awesome-dapps issue creator
- [contributor-hub/README.md](contributor-hub/README.md) - Usage and configuration for the contributor-hub issue creator
