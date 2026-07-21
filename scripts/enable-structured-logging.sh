#!/usr/bin/env node
/**
 * enable-structured-logging.js
 * --------------------------------------------------------------------------
 * One-off: add the Pino structured-logging env vars to EVERY existing
 * pm2 app config (~/pm2-apps/strapi-projectes-*.config.js) AND to the
 * monolithic deploy/ecosystem.config.js, then restart pm2.
 *
 * Strapi 3.6.11's logger (strapi-utils/lib/logger.js) is Pino and already
 * reads these env vars, so no code change is needed — only the pm2 env.
 *
 * What it adds to each app's `env` block (only if missing):
 *     STRAPI_LOG_PRETTY_PRINT: 'false',
 *     STRAPI_LOG_TIMESTAMP:    'true',
 *     STRAPI_LOG_LEVEL:        'info',
 *
 * Usage:
 *     node scripts/enable-structured-logging.js            # show a diff/plan
 *     node scripts/enable-structured-logging.js --apply    # write + restart
 *
 * Run as the pm2 user (e.g. webcoop) on the Strapi host.
 * --------------------------------------------------------------------------
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APPLY = process.argv.includes('--apply');
const HOME = process.env.HOME;
const PM2_APPS_DIR = path.join(HOME, 'pm2-apps');

const LOG_ENV = {
  STRAPI_LOG_PRETTY_PRINT: 'false',
  STRAPI_LOG_TIMESTAMP: 'true',
  STRAPI_LOG_LEVEL: 'info',
};

function findConfigs() {
  const files = [];
  if (fs.existsSync(PM2_APPS_DIR)) {
    for (const f of fs.readdirSync(PM2_APPS_DIR)) {
      if (/\.config\.js$/.test(f)) files.push(path.join(PM2_APPS_DIR, f));
    }
  }
  // Also try to find the monolithic ecosystem.config.js in a few likely spots
  // (repo layout differs between dev and the server). Best-effort, optional.
  const candidates = [
    path.join(HOME, 'ecosystem.config.js'),
    path.join(__dirname, '..', 'deploy', 'ecosystem.config.js'),
    path.join(__dirname, '..', '..', 'deploy', 'ecosystem.config.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && !files.includes(c)) { files.push(c); break; }
  }
  return files;
}

// Minimal re-serializer that matches the style of these config files.
function serialize(cfg) {
  return `module.exports = ${JSON.stringify(cfg, null, 2)};\n`;
}

function patchConfig(file) {
  delete require.cache[require.resolve(file)];
  const cfg = require(file);
  let changed = false;
  for (const app of cfg.apps || []) {
    app.env = app.env || {};
    for (const [k, v] of Object.entries(LOG_ENV)) {
      if (app.env[k] !== v) {
        // For STRAPI_LOG_LEVEL, respect an existing explicit setting.
        if (k === 'STRAPI_LOG_LEVEL' && app.env[k]) continue;
        app.env[k] = v;
        changed = true;
      }
    }
  }
  if (changed) {
    console.log(`${APPLY ? 'PATCHED' : 'would patch'}: ${file}`);
    if (APPLY) fs.writeFileSync(file, serialize(cfg), 'utf8');
  } else {
    console.log(`already ok : ${file}`);
  }
  // Return the (possibly patched) config so main can re-start the apps in it.
  return changed ? cfg : null;
}

// pm2's `restart`/`reload`/`reload --update-env` do NOT re-read the
// `env:` block of a .config.js file — they re-inject the snapshot the
// daemon holds in memory (often from ~/.pm2/dump.pm2). The ONLY way to
// make pm2 re-read the file is to delete the app and start it again
// from the config file. This touches just the apps in this file.
function restartApps(cfg, file) {
  for (const app of cfg.apps || []) {
    if (!app.name) continue;
    console.log(`  restarting ${app.name} (delete + start from config)...`);
    execSync(`pm2 delete "${app.name}" 2>/dev/null || true`, { stdio: 'inherit' });
    execSync(`pm2 start "${file}"`, { stdio: 'inherit' });
  }
}

function main() {
  const files = findConfigs();
  if (!files.length) {
    console.error('No pm2 config files found.');
    process.exit(1);
  }
  console.log(`Mode: ${APPLY ? 'APPLY (will write files)' : 'DRY-RUN (--apply to write)'}`);
  console.log('----');
  const patched = [];
  for (const f of files) {
    const cfg = patchConfig(f);
    if (cfg) patched.push({ cfg, file: f });
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write & restart pm2.');
    return;
  }
  if (!patched.length) {
    console.log('\nNothing to change.');
    return;
  }
  console.log('\nRestarting patched apps so pm2 re-reads their env...');
  for (const { cfg, file } of patched) restartApps(cfg, file);
  try {
    execSync('pm2 save', { stdio: 'inherit' });
    console.log('Done. New logs are now JSON.');
  } catch (e) {
    console.error('pm2 save failed. Run `pm2 save` manually.');
    process.exit(1);
  }
}

main();
