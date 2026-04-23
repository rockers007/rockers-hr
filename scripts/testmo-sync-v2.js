#!/usr/bin/env node
/**
 * testmo-sync-v2.js — custom sync that works against the deployed TestMo API.
 *
 * The bundled @testmo/testmo-api package sends folders/cases as JSON arrays
 * (`{"folders":[...]}`), but the real TestMo v1 API expects an object map
 * (`{"folders":{"0":{...}}}`) on the POST body. This rewrite uses fetch
 * directly with the correct shape.
 *
 * Usage:
 *   node scripts/testmo-sync-v2.js <path-to-test-cases.json> [--dry-run]
 *
 * Env: TESTMO_URL, TESTMO_TOKEN, TESTMO_PROJECT_ID
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filePath = args.find((a) => !a.startsWith('--'));

  if (!filePath) {
    console.error(
      'Usage: node scripts/testmo-sync-v2.js <test-cases.json> [--dry-run]',
    );
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf-8'));
  const totalCases = plan.folders.reduce((s, f) => s + f.cases.length, 0);

  console.log(
    `Folders: ${plan.folders.length}  Cases: ${totalCases}  Source: ${filePath}`,
  );

  if (dryRun) {
    for (const f of plan.folders) {
      console.log(`  - ${f.name}  (${f.cases.length} cases)`);
    }
    return;
  }

  const base = (process.env.TESTMO_URL || '').replace(/\/$/, '');
  const token = process.env.TESTMO_TOKEN;
  const projectId = process.env.TESTMO_PROJECT_ID;
  if (!base || !token || !projectId) {
    console.error('Missing TESTMO_URL / TESTMO_TOKEN / TESTMO_PROJECT_ID');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const post = async (pathname, body) => {
    const res = await fetch(`${base}${pathname}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      throw new Error(`${res.status} ${pathname}  ${JSON.stringify(json)}`);
    }
    return json;
  };

  // toObjectMap({name:'a'}, {name:'b'}) -> {"0":{...},"1":{...}}
  const toMap = (arr) =>
    arr.reduce((acc, v, i) => {
      acc[String(i)] = v;
      return acc;
    }, {});

  let totalFoldersCreated = 0;
  let totalCasesCreated = 0;
  const failures = [];

  for (const folder of plan.folders) {
    let folderId;
    try {
      const r = await post(`/api/v1/projects/${projectId}/folders`, {
        folders: toMap([{ name: folder.name }]),
      });
      folderId = r.result?.[0]?.id;
      totalFoldersCreated++;
      console.log(`Created folder [${folderId}] "${folder.name}"`);
    } catch (e) {
      failures.push({ folder: folder.name, error: String(e) });
      console.error(`  ✗ folder "${folder.name}": ${e.message}`);
      continue;
    }

    // batches of 50 (TestMo's POST may cap the body size)
    const CHUNK = 50;
    for (let i = 0; i < folder.cases.length; i += CHUNK) {
      const chunk = folder.cases.slice(i, i + CHUNK);
      const payload = chunk.map((c) => {
        const row = { name: c.name, folder_id: folderId };
        if (c.estimate) row.estimate = c.estimate;
        if (Array.isArray(c.tags)) row.tags = c.tags;
        return row;
      });
      try {
        const r = await post(`/api/v1/projects/${projectId}/cases`, {
          cases: toMap(payload),
        });
        const n = r.result?.length ?? payload.length;
        totalCasesCreated += n;
        console.log(`  +${n} cases`);
      } catch (e) {
        failures.push({
          folder: folder.name,
          error: String(e),
          batch: `${i}-${i + chunk.length}`,
        });
        console.error(`  ✗ cases ${i}-${i + chunk.length}: ${e.message}`);
      }
    }
  }

  console.log('');
  console.log(
    `Done. Folders: ${totalFoldersCreated}  Cases: ${totalCasesCreated}  Failures: ${failures.length}`,
  );
  if (failures.length) {
    console.log('First failures:');
    failures.slice(0, 5).forEach((f) => console.log(`  - ${JSON.stringify(f)}`));
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
