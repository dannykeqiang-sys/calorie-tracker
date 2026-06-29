# Calorie Tracker Server - 快速参考指南

## 🚀 常用命令

```bash
# 启动开发服务器（自动重启）
cd server && npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 类型检查
npm run typecheck

# 安装依赖
npm install
```

## 🔑 获取 Token

### 管理员 Token
```bash
export ADMIN_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/admin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.token')

echo "Admin Token: $ADMIN_TOKEN"
```

### 用户 Token
```bash
export USER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nickname":"测试用户","inviteCode":"你的邀请码"}' | jq -r '.token')

echo "User Token: $USER_TOKEN"
```

## 📡 常用 API 调用

### 1. 创建邀请码（管理员）
```bash
curl -X POST http://localhost:3001/api/admin/invites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"code":"INVITE2024","maxUses":10}'
```

### 2. 保存每日记录
```bash
curl -X PUT http://localhost:3001/api/user/records/$(date +%Y-%m-%d) \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "data": {
      "date": "'$(date +%Y-%m-%d)'",
      "meals": {
        "breakfast": [
          {"id":"1","name":"早餐","calories":300,"protein":15,"carbs":40,"fat":10}
        ],
        "lunch": [],
        "dinner": [],
        "snacks": []
      },
      "exercises": [],
      "water": []
    }
  }'
```

### 3. 获取今日记录
```bash
curl -s http://localhost:3001/api/user/records/$(date +%Y-%m-%d) \
  -H "Authorization: Bearer $USER_TOKEN" | jq .
```

### 4. 获取所有记录
```bash
curl -s http://localhost:3001/api/user/records/all \
  -H "Authorization: Bearer $USER_TOKEN" | jq .
```

### 5. 创建备份
```bash
curl -X POST http://localhost:3001/api/user/backup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"note":"每日备份 - '$(date +%Y-%m-%d)'"}'
```

### 6. 查看统计数据（管理员）
```bash
curl -s http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 7. 查看所有用户（管理员）
```bash
curl -s http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 8. 查看邀请码列表（管理员）
```bash
curl -s http://localhost:3001/api/admin/invites \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

## 🔧 数据库操作

### 查看数据库
```bash
# 使用 sqlite3 命令行工具
sqlite3 data/calorie.db

# 常用 SQL 命令
.tables              # 查看所有表
.schema users        # 查看 users 表结构
SELECT * FROM users; # 查询所有用户
SELECT * FROM daily_records LIMIT 5; # 查看最近 5 条记录
.exit                # 退出
```

### 备份数据库
```bash
# 简单备份
cp data/calorie.db data/calorie.db.backup

# 带时间戳备份
cp data/calorie.db data/calorie.db.$(date +%Y%m%d_%H%M%S)
```

### 重置数据库
```bash
# 停止服务器
pkill -f "tsx watch src/index.ts"

# 删除数据库文件
rm data/calorie.db

# 重启服务器（会自动创建新数据库）
npm run dev
```

## 🐛 故障排查

### 服务器无法启动
```bash
# 检查端口是否被占用
lsof -i :3001

# 杀掉占用端口的进程
kill -9 <PID>

# 检查日志
tail -f server.log
```

### Token 过期
```bash
# 重新获取 token
export USER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nickname":"用户名","inviteCode":"邀请码"}' | jq -r '.token')
```

### 权限错误
```bash
# 确保使用正确的 token 类型
# 用户 API 使用 USER_TOKEN
# 管理员 API 使用 ADMIN_TOKEN

# 检查 token 是否有效
curl -s http://localhost:3001/api/user/profile \
  -H "Authorization: Bearer $USER_TOKEN" | jq .
```

## 📊 测试数据生成

### 批量生成记录（测试用）
```bash
# 生成最近 7 天的记录
for i in {0..6}; do
  DATE=$(date -v-${i}d +%Y-%m-%d)
  CALORIES=$((1500 + RANDOM % 1000))
  
  curl -X PUT "http://localhost:3001/api/user/records/$DATE" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{
      \"data\": {
        \"date\": \"$DATE\",
        \"meals\": {
          \"breakfast\": [{\"id\":\"b$i\",\"name\":\"早餐$i\",\"calories\":$((CALORIES/3)),\"protein\":20,\"carbs\":40,\"fat\":10}],
          \"lunch\": [{\"id\":\"l$i\",\"name\":\"午餐$i\",\"calories\":$((CALORIES/3)),\"protein\":25,\"carbs\":50,\"fat\":12}],
          \"dinner\": [{\"id\":\"d$i\",\"name\":\"晚餐$i\",\"calories\":$((CALORIES/3)),\"protein\":22,\"carbs\":45,\"fat\":11}],
          \"snacks\": []
        },
        \"exercises\": [],
        \"water\": [{\"amount\":2000,\"time\":\"全天\"}]
      }
    }"
done

echo "已生成 7 天测试记录"
```

## 🔍 性能监控

### 检查数据库大小
```bash
ls -lh data/calorie.db
```

### 查看记录数量
```bash
sqlite3 data/calorie.db "SELECT COUNT(*) FROM daily_records;"
```

### 查看用户数量
```bash
sqlite3 data/calorie.db "SELECT COUNT(*) FROM users;"
```

## 📝 日志查看

```bash
# 实时查看服务器日志
tail -f server.log

# 查看最近 50 行日志
tail -50 server.log

# 搜索错误日志
grep "Error" server.log
```

## 🔄 更新代码

```bash
# 拉取最新代码
git pull

# 重新安装依赖
npm install

# 重新构建
npm run build

# 重启服务器
pm2 restart calorie-server  # 如果使用 pm2
# 或
pkill -f "node dist/index.js" && npm start
```

## 💡 提示

1. **开发时**: 使用 `npm run dev` 自动重启
2. **生产时**: 使用 `pm2` 或 `systemd` 管理进程
3. **备份**: 定期备份 `data/calorie.db`
4. **安全**: 生产环境修改 `JWT_SECRET` 和 `ADMIN_PASSWORD`
5. **监控**: 使用 pm2 或 Docker 监控服务器状态
