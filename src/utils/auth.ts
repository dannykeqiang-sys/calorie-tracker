const SESSION_KEY = 'USER_INFO';
const API_TOKEN_KEY = 'calorie_api_token';

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
  localStorage.removeItem(API_TOKEN_KEY);
  localStorage.removeItem('calorie_user_profile');
  localStorage.removeItem('calorie_profile_updated_at');
}

// ─── API Token (JWT) ─────────────────────────────────────

/** 获取后端 API 的 JWT token */
export function getApiToken(): string | null {
  return localStorage.getItem(API_TOKEN_KEY);
}

/** 保存后端 API 的 JWT token */
export function setApiToken(token: string): void {
  localStorage.setItem(API_TOKEN_KEY, token);
}

/** 清除 API token */
export function clearApiToken(): void {
  localStorage.removeItem(API_TOKEN_KEY);
}

// ─── API Fetch 封装 ──────────────────────────────────────

/** 获取 API 基础 URL（优先使用环境变量，开发环境走 proxy） */
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || '';
}

/**
 * 封装带 JWT token 的 fetch，自动添加 Authorization header。
 * 如果 token 过期（401），自动清除 token 并跳转到登录页。
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getApiToken();
  const baseUrl = getApiBaseUrl();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  // Token 过期或无效 → 清除并跳转登录
  if (response.status === 401) {
    clearApiToken();
    clearSession();
    // 避免在登录页循环跳转
    if (!window.location.hash.includes('/login')) {
      window.location.hash = '#/login';
    }
  }

  return response;
}

/**
 * 检查是否已配置后端 API（有 token 或有 base URL）
 */
export function hasApiConfig(): boolean {
  return !!getApiToken() || !!getApiBaseUrl();
}
