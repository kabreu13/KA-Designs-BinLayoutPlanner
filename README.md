# KA Designs Bin Layout Planner

React + Vite app for planning drawer bin layouts with drag/drop placement, validation, and export tools.

## Requirements

- Node `20.19.0` (see `.nvmrc`)
- npm

## Setup

```bash
npm ci
```

## Common commands

```bash
npm run dev
npm run verify
npm run verify:deploy
npm run test:e2e:smoke
npm run clean
```

## Script summary

- `verify`: lint + typecheck + unit coverage + build
- `verify:deploy`: lint + typecheck (fast pre-deploy gate)
- `playwright:install`: install Playwright browsers/deps for CI/E2E
- `clean`: remove generated local artifacts
