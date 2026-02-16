# Automation Scripts

A collection of scripts for automating GitHub issue creation across Midnight ecosystem repositories.

## Structure

```
.
├── awesome-dapps/
│   ├── index.js
│   ├── issue-template.md   # Issue title, labels, and body (markdown)
│   ├── .env.example
│   └── README.md
├── contributor-hub/
│   ├── index.js
│   ├── .env.example
│   └── README.md
├── .gitignore
├── .env.example
└── package.json
```

## Setup

```bash
npm install
```

Each script has its own `.env`. See the README in each folder for configuration details.

## Scripts

| Command                     | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `npm run awesome-dapps`     | Create issues on repos from the awesome-dapps README |
| `npm run awesome-dapps:dry` | Preview without creating issues                      |
| `npm run contributor-hub`   | Create dApp proposal issues from Excel               |

## Documentation

- [awesome-dapps/README.md](awesome-dapps/README.md) - Usage and configuration for the awesome-dapps issue creator
- [contributor-hub/README.md](contributor-hub/README.md) - Usage and configuration for the contributor-hub issue creator
