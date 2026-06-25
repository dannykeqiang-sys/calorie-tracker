# Profile 数据意外修改问题修复报告

## 问题描述
用户 profile 数据在云端同步、本地存储、登出等场景下被意外修改或丢失。

## 修复的 8 个问题

### 1. 🔴 SHA 冲突处理缺失（严重）
**位置**: `src/utils/githubDB.ts`

**问题**: GitHub API 返回 409 (SHA conflict) 时，写入操作被静默丢弃，导致数据丢失。

**修复**:
- 新增 `ShaConflictError` 错误类
- 在 `githubApi()` 中捕获 409 并抛出专用错误
- `syncProfileToCloud()` 实现最多 3 次重试机制，每次延迟递增（300ms × attempt）
- 添加详细日志记录每次重试

```typescript
class ShaConflictError extends Error {
  constructor(public path: string) {
    super(`SHA conflict on ${path}`);
    this.name = 'ShaConflictError';
  }
}

// syncProfileToCloud 中的重试逻辑
for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
  try {
    // 读取-修改-写入
  } catch (e) {
    if (e instanceof ShaConflictError && attempt < MAX_SYNC_RETRIES) {
      await new Promise(r => setTimeout(r, 300 * attempt));
      continue;
    }
    throw e;
  }
}
```

---

### 2. 🔴 workid 自动生成导致幽灵条目（严重）
**位置**: `src/utils/githubDB.ts:84`

**问题**: 
```typescript
// 修复前
const workid = localStorage.getItem('calorie_workid') || `user_${Date.now()}`;
localStorage.setItem('calorie_workid', workid);
```
当 workid 不存在时自动生成并保存，可能导致：
- 创建无主幽灵条目
- 用户无法通过登录找回数据

**修复**:
```typescript
// 修复后
const workid = localStorage.getItem('calorie_workid');
if (!workid) {
  log('sync', '⚠️ 无 workid，跳过云端同步');
  return;
}
```

---

### 3. 🔴 localStorage.clear() 清除所有数据（严重）
**位置**: `src/pages/index.tsx:146`

**问题**: 登出时调用 `localStorage.clear()` 清除所有数据，包括：
- `calorie_workid` - 用户标识
- `calorie_user_profile` - 用户档案
- 所有历史记录索引

导致用户重新登录后数据关联断裂。

**修复**:
```typescript
// 修复后
const handleLogout = useCallback(() => {
  const workid = localStorage.getItem('calorie_workid');
  clearSession(); // 仅清除 USER_INFO、profile、updatedAt
  // 清除临时缓存（不清除 workid 和记录数据）
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('calorie_ai_cache_') ||
        key.startsWith('calorie_advice_') ||
        key.startsWith('calorie_review_')) {
      localStorage.removeItem(key);
    }
  }
  console.log('[profile:logout] 已登出，保留 workid:', workid);
  navigate('/login');
}, [navigate]);
```

---

### 4. 🟡 多设备并发写入无 last-write-wins 保护（中等）
**位置**: `src/utils/githubDB.ts`

**问题**: 两台设备同时修改 profile 时，后写入的会覆盖先写入的，无法保证数据一致性。

**修复**:
- `ProfileEntry` 新增 `updatedAt: number` 字段
- `syncProfileToCloud()` 写入前比较时间戳：
```typescript
if (existing.updatedAt > now) {
  log('sync', `⚠️ 云端数据更新 (${new Date(existing.updatedAt).toISOString()})，放弃本次写入`);
  return;
}
```

---

### 5. 🟡 初始化时不比较新旧（中等）
**位置**: `src/pages/index.tsx:110-124`

**问题**: 初始化时本地 profile 永远优先于云端，即使云端有更新的数据。

**修复**:
```typescript
// 无论本地是否有 profile，都异步检查云端
loadProfileFromCloud()
  .then(cloudResult => {
    if (!cloudResult) {
      // 云端无数据，使用本地
    } else {
      const { profile: cloudProfile, updatedAt: cloudUpdatedAt } = cloudResult;
      
      if (!localProfile) {
        // 本地无数据，使用云端
      } else {
        // 两端均有数据，比较时间戳
        if (cloudUpdatedAt > localUpdatedAt) {
          setProfile(cloudProfile);
          saveProfile(cloudProfile);
        } else {
          setProfile(localProfile);
        }
      }
    }
  })
```

---

### 6. 🟡 无任何日志追踪（中等）
**位置**: 全局

**问题**: profile 变更时无任何日志，难以调试问题。

**修复**: 在关键路径添加带颜色标签的日志：

**githubDB.ts**:
```typescript
function log(tag: string, ...args: any[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`%c[profile:${tag}] ${ts}`, 'color:#F97316;font-weight:bold', ...args);
}
```

**storage.ts**:
```typescript
function profileLog(tag: string, ...args: any[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`%c[storage:${tag}] ${ts}`, 'color:#7CB9E8;font-weight:bold', ...args);
}
```

日志覆盖场景：
- `sync` - 云端同步开始/成功/失败/重试
- `load` - 从云端加载
- `find` - 按名称查找
- `save` - 本地保存（含完整字段）
- `restore` - 从备份恢复
- `init` - 初始化加载
- `logout` - 登出

---

### 7. 🟢 无备份机制（低）
**位置**: `src/utils/storage.ts`

**问题**: profile 被意外覆盖后无法恢复。

**修复**:
- 新增 `calorie_user_profile_backup` 备份键
- `saveProfile()` 在保存前自动备份旧数据：
```typescript
const prev = localStorage.getItem(PROFILE_KEY);
if (prev && prev !== JSON.stringify(profile)) {
  localStorage.setItem(PROFILE_BACKUP_KEY, prev);
}
```
- 新增 `restoreProfileFromBackup()` 函数用于回滚

---

### 8. 🟢 UserProfilePanel 表单不随 prop 更新（低）
**位置**: `src/pages/components/UserProfilePanel.tsx`

**问题**: 
```typescript
// 修复前
const [form, setForm] = useState<UserProfile>({
  name: profile?.name ?? '',
  // ...
});
```
`useState` 只在组件首次渲染时初始化，当 `profile` prop 变化时表单不会更新。

**修复**:
```typescript
useEffect(() => {
  if (profile) {
    setForm({
      name: profile.name,
      height: profile.height,
      weight: profile.weight,
      age: profile.age,
      gender: profile.gender,
      goal: profile.goal,
      activityLevel: profile.activityLevel,
    });
  }
}, [profile]);
```

---

## API 变更

### githubDB.ts
```typescript
// loadProfileFromCloud 返回值变更
- Promise<UserProfile | null>
+ Promise<{ profile: UserProfile; updatedAt: number } | null>

// findProfileByName 返回值变更
- Promise<{ workid: string; profile: UserProfile } | null>
+ Promise<{ workid: string; profile: UserProfile; updatedAt: number } | null>
```

### storage.ts
```typescript
// 新增函数
export function getProfileUpdatedAt(): number;
export function restoreProfileFromBackup(): UserProfile | null;
```

### auth.ts
```typescript
// clearSession 新增清除项
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('calorie_user_profile');
  localStorage.removeItem('calorie_profile_updated_at'); // 新增
}
```

---

## 新增 localStorage 键

| 键名 | 用途 |
|------|------|
| `calorie_profile_updated_at` | profile 最后保存时间戳（ms） |
| `calorie_user_profile_backup` | profile 备份（上一次保存的数据） |

---

## 调试方法

1. **打开浏览器控制台**，过滤日志：
   - `[profile:` - 云端同步相关
   - `[storage:` - 本地存储相关
   - `[profile:init]` - 初始化加载
   - `[profile:logout]` - 登出

2. **查看 profile 变更历史**：
   ```javascript
   // 控制台执行
   localStorage.getItem('calorie_user_profile_backup')
   ```

3. **手动恢复备份**：
   ```javascript
   // 控制台执行
   import('./src/utils/storage').then(m => m.restoreProfileFromBackup())
   ```

4. **查看时间戳**：
   ```javascript
   new Date(Number(localStorage.getItem('calorie_profile_updated_at'))).toISOString()
   ```

---

## 文件变更清单

| 文件 | 变更类型 |
|------|----------|
| `src/utils/githubDB.ts` | 重构（SHA 重试、last-write-wins、日志） |
| `src/utils/storage.ts` | 增强（备份、时间戳、日志、新函数） |
| `src/utils/auth.ts` | 修复（clearSession 清除 updatedAt） |
| `src/pages/index.tsx` | 修复（登出逻辑、初始化比较） |
| `src/pages/components/UserProfilePanel.tsx` | 修复（useEffect 同步 prop） |

---

## 验证步骤

1. **SHA 冲突重试**：
   - 模拟两台设备同时写入
   - 观察控制台是否出现 `⚠️ SHA 冲突` 和重试日志

2. **last-write-wins**：
   - 设备 A 修改 weight=60，保存
   - 设备 B 修改 weight=70，保存
   - 设备 A 刷新，应该显示 weight=70

3. **登出保留 workid**：
   - 登出后检查 `localStorage.getItem('calorie_workid')` 是否仍存在
   - 重新登录同一用户，历史记录应该保留

4. **备份恢复**：
   - 修改 profile 并保存
   - 控制台执行 `restoreProfileFromBackup()`
   - 验证是否恢复到上一次的数据

5. **表单同步**：
   - 打开 UserProfilePanel
   - 在另一标签页修改 profile 并同步
   - 回到原标签页，表单应该显示最新数据

---

## 总结

本次修复覆盖了 profile 数据生命周期的所有关键环节：
- **创建**: 注册时生成 workid
- **读取**: 初始化时 last-write-wins 策略
- **更新**: SHA 冲突重试 + 时间戳保护
- **删除**: 登出时保留 workid
- **备份**: 自动备份 + 恢复函数
- **日志**: 全链路追踪

所有修复均通过 TypeScript 类型检查，向后兼容旧数据（`updatedAt` 字段缺失时默认 `0`）。
