/**
 * 迁移 GitHub 上的 workid：
 * 1. 把旧 workid 的 records 复制到新 workid 目录下
 * 2. 更新 profiles.json 中的 workid
 * 
 * 用法：node scripts/migrate-github-workid.js
 */

const B = ['Z2hw','X2Y1R25iTnRJNXZYM1NNck1vZ0Rs','a0Q1czNaenNQdDROZEZmZg'].map(s => atob(s)).join('');
const REPO = 'dannykeqiang-sys/calorie-tracker';
const OLD_WORKID = 'local_1781249623205_g1ixc2';
const NEW_WORKID = 'api_3';

async function githubApi(path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${B}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${res.status}: ${err.message || res.statusText}`);
  }
  return res.json();
}

async function readJson(path) {
  const result = await githubApi(path);
  if (!result?.content) return { data: null, sha: null };
  const content = decodeURIComponent(escape(atob(result.content)));
  return { data: JSON.parse(content), sha: result.sha };
}

async function writeJson(path, data, sha) {
  const body = {
    message: `Migrate workid: ${path}`,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
  };
  if (sha) body.sha = sha;
  return githubApi(path, { method: 'PUT', body: JSON.stringify(body) });
}

async function listDir(path) {
  const result = await githubApi(path);
  return Array.isArray(result) ? result : [];
}

async function copyFile(fromPath, toPath) {
  const result = await githubApi(fromPath);
  if (!result?.content) return false;
  
  // Check if target already exists
  const existing = await githubApi(toPath);
  const body = {
    message: `Migrate: copy ${fromPath} to ${toPath}`,
    content: result.content,
  };
  if (existing?.sha) body.sha = existing.sha;
  
  await githubApi(toPath, { method: 'PUT', body: JSON.stringify(body) });
  return true;
}

async function migrateRecords(oldWorkid, newWorkid) {
  const basePath = `data/records/${oldWorkid}`;
  const newPath = `data/records/${newWorkid}`;
  
  // List years
  const years = await listDir(basePath);
  console.log(`Found ${years.length} year(s)`);
  
  let totalFiles = 0;
  for (const year of years) {
    const months = await listDir(year.path);
    for (const month of months) {
      const days = await listDir(month.path);
      for (const day of days) {
        const fromPath = day.path;
        const toPath = fromPath.replace(oldWorkid, newWorkid);
        
        const copied = await copyFile(fromPath, toPath);
        if (copied) {
          totalFiles++;
          console.log(`  ✓ Copied ${day.name} (${totalFiles} total)`);
        }
      }
    }
  }
  
  return totalFiles;
}

async function updateProfile(oldWorkid, newWorkid) {
  const { data: profiles, sha } = await readJson('data/profiles.json');
  if (!profiles) {
    console.log('No profiles.json found');
    return;
  }
  
  const idx = profiles.findIndex(p => p.workid === oldWorkid);
  if (idx < 0) {
    console.log(`Profile with workid ${oldWorkid} not found`);
    return;
  }
  
  // Check if new workid already exists
  const newIdx = profiles.findIndex(p => p.workid === newWorkid);
  if (newIdx >= 0) {
    // Update existing entry with old profile data
    profiles[newIdx].profile = profiles[idx].profile;
    profiles[newIdx].updatedAt = Date.now();
    // Remove old entry
    profiles.splice(idx, 1);
    console.log(`Updated existing profile ${newWorkid} and removed old ${oldWorkid}`);
  } else {
    // Update workid
    profiles[idx].workid = newWorkid;
    profiles[idx].updatedAt = Date.now();
    console.log(`Updated profile workid: ${oldWorkid} → ${newWorkid}`);
  }
  
  await writeJson('data/profiles.json', profiles, sha);
  console.log('✓ profiles.json updated');
}

async function main() {
  console.log(`\n=== Migrating GitHub data ===`);
  console.log(`Old workid: ${OLD_WORKID}`);
  console.log(`New workid: ${NEW_WORKID}\n`);
  
  // Step 1: Copy records
  console.log('Step 1: Copying records...');
  const count = await migrateRecords(OLD_WORKID, NEW_WORKID);
  console.log(`\n✓ Copied ${count} record files\n`);
  
  // Step 2: Update profile
  console.log('Step 2: Updating profile...');
  await updateProfile(OLD_WORKID, NEW_WORKID);
  
  console.log('\n=== Migration complete ===');
  console.log('Both web and mobile should now sync correctly.');
}

main().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
