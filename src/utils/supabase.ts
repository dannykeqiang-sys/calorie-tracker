import { PostgrestClient } from '@supabase/postgrest-js';

interface SupabaseConfig {
  serviceUrl: string;
  schemaName: string;
  token: string;
}

const SUPABASE_CONFIG_KEY = 'SUPABASE_CONFIG';

const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const getConfigFromParent = (): Promise<SupabaseConfig> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('获取 Supabase 配置超时'));
    }, 5000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === SUPABASE_CONFIG_KEY && event.data?.data) {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(event.data.data));
        resolve(event.data.data as SupabaseConfig);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'REQUEST_SUPABASE_CONFIG' }, '*');
  });
};

const getSupabaseConfig = async (): Promise<SupabaseConfig | null> => {
  const config = (window as any).SUPER?.supabase;
  if (config) return config as SupabaseConfig;

  const getConfigFromStorage = (): SupabaseConfig | null => {
    const stored = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as SupabaseConfig;
      } catch {
        localStorage.removeItem(SUPABASE_CONFIG_KEY);
      }
    }
    return null;
  };

  if (isInIframe()) {
    try {
      return await getConfigFromParent();
    } catch {
      return getConfigFromStorage();
    }
  }
  return getConfigFromStorage();
};

let postgrestInstance: PostgrestClient<any, any, any> | null = null;

export const getPostgrest = async (): Promise<PostgrestClient<any, any, any> | null> => {
  if (postgrestInstance) return postgrestInstance;

  const config = await getSupabaseConfig();
  if (!config) return null;

  postgrestInstance = new PostgrestClient(config.serviceUrl, {
    headers: { Authorization: `Bearer ${config.token}` },
    schema: config.schemaName,
  }) as PostgrestClient<any, any, any>;

  return postgrestInstance;
};

export default getPostgrest;
