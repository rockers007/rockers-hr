#!/usr/bin/env node

/**
 * testmo-report.js
 *
 * Reads Playwright JUnit XML results and submits them to Testmo
 * as an automation run linked to repository test cases.
 *
 * Usage:
 *   node scripts/testmo-report.js [--dry-run]
 *
 * Requires: TESTMO_URL, TESTMO_TOKEN, TESTMO_PROJECT_ID env vars
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const resultsFile = path.resolve('test-results/results.xml');

  if (!fs.existsSync(resultsFile)) {
    console.error('No results.xml found. Run Playwright tests first.');
    process.exit(1);
  }

  const TESTMO_URL = process.env.TESTMO_URL;
  const TESTMO_TOKEN = process.env.TESTMO_TOKEN;
  const TESTMO_PROJECT_ID = process.env.TESTMO_PROJECT_ID;

  if (!TESTMO_URL || !TESTMO_TOKEN || !TESTMO_PROJECT_ID) {
    console.error('Missing: TESTMO_URL, TESTMO_TOKEN, TESTMO_PROJECT_ID');
    process.exit(1);
  }

  if (dryRun) {
    console.log('DRY RUN: Would submit', resultsFile, 'to Testmo');
    console.log('  URL:', TESTMO_URL);
    console.log('  Project:', TESTMO_PROJECT_ID);
    return;
  }

  // Use testmo CLI to submit results
  const cmd = [
    'npx', 'testmo', 'automation:run:submit',
    '--instance', TESTMO_URL,
    '--project-id', TESTMO_PROJECT_ID,
    '--name', `"Playwright Test Run - ${new Date().toISOString().slice(0, 16)}"`,
    '--source', '"playwright"',
    '--results', `"${resultsFile}"`,
  ].join(' ');

  console.log('Submitting results to Testmo...');
  console.log('Command:', cmd);

  try {
    const output = execSync(cmd, {
      env: { ...process.env, TESTMO_TOKEN },
      stdio: 'inherit',
    });
    console.log('\nResults submitted successfully!');
  } catch (err) {
    console.error('Failed to submit results:', err.message);
    process.exit(1);
  }
}

main();
