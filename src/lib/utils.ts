import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { ClassValue } from 'clsx'

/**
 * 合并 class 名称，可以自动合并 tailwind 样式
 * 但注意，合并的 class 中一定不要有 hidden，Tailwind JIT 引擎在同时处理这个样式时
 * 会错误编译出作用域过大的样式，影响 SideBar 渲染。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface UserInfo {
  workid: string;
  cname: string;
  avatar: string;
}

const USER_INFO_KEY = 'USER_INFO';

const getUserInfoFromParent = (): Promise<UserInfo> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('获取用户信息超时'));
    }, 5000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === USER_INFO_KEY && event.data?.data) {
        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(event.data.data));
        resolve(event.data.data as UserInfo);
      }
    };

    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'REQUEST_USER_INFO' }, '*');
  });
};

const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

const appendAvatar = (userInfo: UserInfo): UserInfo => {
  if (userInfo.workid) {
    userInfo.avatar = `https://work.alibaba-inc.com/photo/${userInfo.workid}.jpg`;
  }

  return userInfo;
};

/**
 * 获取当前访问网页的用户花名和工号
 */
export const getUserInfo = async (): Promise<UserInfo | null> => {
  const config = (window as any).userInfo;
  if (config) {
    return appendAvatar(config);
  }

  if (isInIframe()) {
    try {
      const userInfo = await getUserInfoFromParent();
      return appendAvatar(userInfo);
    } catch (e) {
      console.error('从父窗口获取配置失败:', e);
      return null;
    }
  } else {
    const config = localStorage.getItem(USER_INFO_KEY);
    if (config) {
      const userInfo = JSON.parse(config) as UserInfo;
      return appendAvatar(userInfo);
    }
  }

  return null;
};