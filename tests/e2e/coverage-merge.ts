import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'fs';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nycOutputDir = path.resolve(__dirname, '../../.nyc_output');
const coverageDir = path.resolve(__dirname, '../../coverage-e2e');

export default async function globalTeardown() {
  if (process.env.E2E_COVERAGE !== '1') return;
  if (!existsSync(nycOutputDir)) return;

  const { createCoverageMap } = libCoverage;
  const { createContext } = libReport;
  const coverageMap = createCoverageMap({});

  for (const file of readdirSync(nycOutputDir)) {
    if (!file.endsWith('.json')) continue;
    const fullPath = path.join(nycOutputDir, file);
    const data = JSON.parse(readFileSync(fullPath, 'utf8'));
    coverageMap.merge(data);
  }

  mkdirSync(coverageDir, { recursive: true });
  const context = createContext({ dir: coverageDir, coverageMap });
  reports.create('text').execute(context);
  reports.create('html').execute(context);

  // Clean up temp coverage files
  rmSync(nycOutputDir, { recursive: true, force: true });
}
