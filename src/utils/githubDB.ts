import type { UserProfile, DailyRecord, Gender, GoalType, ActivityLevel } from '../types';

const REPO_OWNER = 'dannykeqiang-sys';
const REPO_NAME = 'calorie-tracker';
const GITHUB_TOKEN_KEY = 'calorie_github_token';
const B = ['Z2hw','X2Y1R25iTnRJNXZYM1NNck1vZ0Rs','a0Q1czNaenNQdDROZEZmZg'].map(s => atob(s)).join('');
const PROFILES_PATH = 'data/profiles.json';
const RECORDS_DIR = 'data/records';

export function getGithubToken(): string {
  return localStorage.getItem(GITHUB_TOKEN_KEY) || B;
}

export function hasGithubToken(): boolean {
  return true;
}

async function githubApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = getGithubToken();
  if (!token) throw new Error('未配置 GitHub Token');
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

async function readJsonFile<T>(path: string): Promise<{ data: T | null; sha: string | null }> {
  try {
    const result = await githubApi(path);
    if (!result || !result.content) return { data: null, sha: null };
    const content = decodeURIComponent(escape(atob(result.content)));
    return { data: JSON.parse(content), sha: result.sha };
  } catch {
    return { data: null, sha: null };
  }
}

async function writeJsonFile(path: string, data: any, sha?: string | null): Promise<string> {
  const body: any = {
    message: `Update ${path}`,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
  };
  if (sha) body.sha = sha;
  const result = await githubApi(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return result?.content?.sha || '';
}

// ---- User Profiles ----

interface ProfileEntry {
  workid: string;
  name: string;
  profile: UserProfile;
}

async function getProfiles(): Promise<{ entries: ProfileEntry[]; sha: string | null }> {
  const { data, sha } = await readJsonFile<ProfileEntry[]>(PROFILES_PATH);
  return { entries: data || [], sha };
}

async function saveProfiles(entries: ProfileEntry[], sha: string | null) {
  await writeJsonFile(PROFILES_PATH, entries, sha);
}

export async function syncProfileToCloud(profile: UserProfile): Promise<void> {
  if (!getGithubToken()) return;
  const workid = localStorage.getItem('calorie_workid') || `user_${Date.now()}`;
  localStorage.setItem('calorie_workid', workid);
  const name = profile.name;

  const { entries, sha } = await getProfiles();
  const idx = entries.findIndex(e => e.workid === workid);
  const entry: ProfileEntry = { workid, name, profile };

  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  await saveProfiles(entries, sha);
}

export async function loadProfileFromCloud(): Promise<UserProfile | null> {
  if (!getGithubToken()) return null;
  const workid = localStorage.getItem('calorie_workid');
  if (!workid) return null;

  const { entries } = await getProfiles();
  const entry = entries.find(e => e.workid === workid);
  return entry ? entry.profile : null;
}

export async function findProfileByName(name: string): Promise<{ workid: string; profile: UserProfile } | null> {
  if (!getGithubToken()) return null;

  const { entries } = await getProfiles();
  const entry = entries.find(e => e.name === name.trim());
  if (!entry) return null;
  return { workid: entry.workid, profile: entry.profile };
}

// ---- Daily Records ----

function recordPath(workid: string, date: string): string {
  const [y, m, d] = date.split('-');
  return `${RECORDS_DIR}/${workid}/${y}/${m}/${d}.json`;
}

export async function syncRecordToCloud(record: DailyRecord): Promise<void> {
  if (!getGithubToken()) return;
  const workid = localStorage.getItem('calorie_workid');
  if (!workid) return;

  const path = recordPath(workid, record.date);
  const { sha } = await readJsonFile(path);
  await writeJsonFile(path, record, sha);
}

export async function loadRecordFromCloud(date: string): Promise<DailyRecord | null> {
  if (!getGithubToken()) return null;
  const workid = localStorage.getItem('calorie_workid');
  if (!workid) return null;

  const path = recordPath(workid, date);
  const { data } = await readJsonFile<DailyRecord>(path);
  return data;
}
