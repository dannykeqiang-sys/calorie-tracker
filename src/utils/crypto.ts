/**
 * 简单的口令加密/解密工具
 * 使用口令派生密钥 + XOR + Base64 编码
 */

// 从口令派生一个重复模式的密钥字节
function deriveKey(password: string, length: number): Uint8Array {
  const key = new Uint8Array(length);
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash + password.charCodeAt(i)) | 0;
  }
  // 用简单的 PRNG 填充密钥
  let seed = Math.abs(hash) || 1;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) | 0;
    key[i] = ((seed >>> 16) & 0xff) ^ (password.charCodeAt(i % password.length) || 0x5a);
  }
  return key;
}

// 将字符串编码为 UTF-8 字节
function encodeUTF8(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

// 从字节解码为字符串
function decodeUTF8(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// 将字节数组转为 Base64
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// 从 Base64 转为字节数组
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 生成随机口令（6位数字+字母） */
export function generatePasscode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** 加密明文 JSON 字符串，返回 Base64 密文 */
export function encryptData(plainJson: string, password: string): string {
  // 添加校验头
  const header = 'CALBACKUP:';
  const dataBytes = encodeUTF8(header + plainJson);
  const key = deriveKey(password, dataBytes.length);
  const encrypted = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ key[i];
  }
  return bytesToBase64(encrypted);
}

/** 解密密文，返回明文 JSON 字符串。失败返回 null */
export function decryptData(cipherBase64: string, password: string): string | null {
  try {
    const encrypted = base64ToBytes(cipherBase64.trim());
    const key = deriveKey(password, encrypted.length);
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ key[i];
    }
    const text = decodeUTF8(decrypted);
    if (!text.startsWith('CALBACKUP:')) {
      return null; // 口令错误或数据损坏
    }
    return text.slice('CALBACKUP:'.length);
  } catch {
    return null;
  }
}
