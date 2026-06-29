# Calorie Tracker Server

后端 API 服务，为卡路里追踪应用提供数据持久化和认证功能。

## 技术栈

- **运行时**: Node.js + TypeScript
- **框架**: Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT + bcrypt
- **密码加密**: bcryptjs

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

主要配置项：
- `PORT`: 服务器端口（默认 3001）
- `DATABASE_PATH`: SQLite 数据库文件路径
- `JWT_SECRET`: JWT 签名密钥
- `ADMIN_PASSWORD`: 管理员密码
- `ADMIN_USERNAME`: 管理员用户名（默认 admin）

### 3. 启动服务

**开发模式**（自动重启）：
```bash
npm run dev
```

**生产模式**：
```bash
npm run build
npm start
```

## API 端点

### 健康检查

```
GET /health
```

### 认证 API

#### 用户登录/注册
```
POST /api/auth/login
Content-Type: application/json

{
  "nickname": "string",
  "inviteCode": "string"
}

Response:
{
  "token": "jwt_token",
  "user": {
    "id": 1,
    "nickname": "string",
    "inviteCode": "string"
  }
}
```

首次登录会自动创建用户，后续登录会验证 inviteCode。

#### 管理员登录
```
POST /api/auth/admin
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}

Response:
{
  "token": "admin_jwt_token"
}
```

### 用户 API（需要用户 Token）

所有用户 API 需要在请求头中包含：
```
Authorization: Bearer <user_token>
```

#### 获取个人资料
```
GET /api/user/profile
```

#### 更新个人资料
```
PUT /api/user/profile
Content-Type: application/json

{
  "name": "string",
  "gender": "male" | "female",
  "age": number,
  "height": number,
  "weight": number,
  "goal": "lose" | "maintain" | "gain",
  "activityLevel": "sedentary" | "light" | "moderate" | "active" | "very_active"
}
```

#### 获取每日记录
```
GET /api/user/records/:date
```

#### 保存每日记录
```
PUT /api/user/records/:date
Content-Type: application/json

{
  "date": "YYYY-MM-DD",
  "meals": {
    "breakfast": [...],
    "lunch": [...],
    "dinner": [...],
    "snacks": [...]
  },
  "exercises": [...],
  "water": [...]
}
```

#### 创建备份
```
POST /api/user/backup
```

#### 获取备份列表
```
GET /api/user/backups
```

#### 获取单个备份
```
GET /api/user/backups/:id
```

### 管理员 API（需要管理员 Token）

所有管理员 API 需要在请求头中包含：
```
Authorization: Bearer <admin_token>
```

#### 获取统计信息
```
GET /api/admin/stats
```

#### 管理邀请码
```
# 获取所有邀请码
GET /api/admin/invites

# 创建邀请码
POST /api/admin/invites
Content-Type: application/json

{
  "code": "string",
  "maxUses": number
}

# 删除邀请码
DELETE /api/admin/invites/:id
```

#### 管理用户
```
# 获取所有用户
GET /api/admin/users

# 获取单个用户
GET /api/admin/users/:id

# 禁用用户
PUT /api/admin/users/:id/disable

# 启用用户
PUT /api/admin/users/:id/enable
```

#### 全量备份
```
# 创建全量备份
POST /api/admin/backup/all

# 下载全量备份
GET /api/admin/backup/all
```

## 数据库结构

### users
用户表，存储用户基本信息和认证信息。

### user_profiles
用户资料表，存储身高、体重、目标等个人信息。

### daily_records
每日记录表，存储饮食、运动、饮水等数据。

### data_backups
备份表，存储用户数据的快照。

### invite_codes
邀请码表，用于控制用户注册。

### admin_config
管理员配置表，存储管理员密码哈希等配置。

## 测试

### 创建管理员账号

首次启动后，需要手动创建管理员账号：

```bash
node scripts/create-admin.js
```

或直接在 SQLite 中插入：

```sql
INSERT INTO admin_config (key, value) 
VALUES ('admin_password_hash', '<bcrypt_hash>');
```

### 使用 curl 测试

```bash
# 健康检查
curl http://localhost:3001/health

# 用户登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nickname":"test","inviteCode":"TEST123"}'

# 保存记录（需要替换 token）
curl -X PUT http://localhost:3001/api/user/records/2026-06-30 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"date":"2026-06-30","meals":{"breakfast":[]},"exercises":[],"water":[]}'

# 管理员登录
curl -X POST http://localhost:3001/api/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 部署

### 生产环境配置

1. 设置强密码和密钥：
   - `JWT_SECRET`: 使用随机生成的长字符串
   - `ADMIN_PASSWORD`: 使用强密码

2. 设置正确的数据库路径（建议使用持久化存储）

3. 使用 PM2 或 systemd 管理进程：

```bash
# 使用 PM2
npm install -g pm2
npm run build
pm2 start dist/index.js --name calorie-server

# 查看日志
pm2 logs calorie-server
```

### Docker 部署（可选）

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

## 开发

### 项目结构

```
server/
├── src/
│   ├── index.ts              # 入口文件
│   ├── db.ts                 # 数据库初始化和连接
│   ├── auth.ts               # 认证工具函数
│   ├── middleware/
│   │   └── authMiddleware.ts # 认证中间件
│   └── routes/
│       ├── auth.ts           # 认证路由
│       ├── user.ts           # 用户路由
│       └── admin.ts          # 管理员路由
├── dist/                     # 编译输出
├── data/                     # SQLite 数据库文件
├── package.json
├── tsconfig.json
└── .env
```

### 添加新路由

1. 在 `src/routes/` 中创建新的路由文件
2. 在 `src/index.ts` 中注册路由
3. 根据需要添加中间件

### 数据库迁移

数据库 schema 在 `src/db.ts` 的 `initSchema()` 函数中定义。修改时请注意：

- 使用 `IF NOT EXISTS` 避免重复创建
- 添加索引以优化查询性能
- 使用事务确保数据一致性

## 常见问题

### Q: 数据库文件在哪里？
A: 默认在 `./data/calorie.db`，可通过 `DATABASE_PATH` 环境变量修改。

### Q: 如何重置数据库？
A: 删除数据库文件并重启服务，schema 会自动创建。

### Q: 如何更改管理员密码？
A: 修改 `.env` 中的 `ADMIN_PASSWORD`，然后更新数据库中的哈希值。

### Q: 支持多个管理员吗？
A: 当前版本只支持单个管理员。如需多管理员，需要扩展 `admin_config` 表。

## 许可证

MIT
