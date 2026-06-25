const SESSION_KEY = 'USER_INFO';

export interface AuthSession {
  workid: string;
  cname: string;
  avatar: string;
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.workid ? parsed : null;
  } catch {
    return null;
  }
}

export function setSession(workid: string, name: string): void {
  const session: AuthSession = { workid, cname: name, avatar: '' };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('calorie_user_profile');
  localStorage.removeItem('calorie_profile_updated_at');
}
