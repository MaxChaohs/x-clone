# 环境变量设置指南

## 问题排查

如果您遇到 "註冊失敗，請稍後再試" 的错误，请检查以下内容：

### 1. 创建 .env.local 文件

在项目根目录（与 `package.json` 同级）创建 `.env.local` 文件。

**重要：** `.env.local` 文件应该被添加到 `.gitignore` 中，不要提交到 Git。

### 2. 必需的环境变量

在 `.env.local` 文件中添加以下内容：

```env
# NextAuth 配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-this-in-production

# MongoDB 数据库连接
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/x-clone?retryWrites=true&w=majority

# Google OAuth 配置
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. 获取 Google OAuth 凭证

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 前往 "凭据" > "创建凭据" > "OAuth 客户端 ID"
5. 应用类型选择 "Web 应用"
6. 添加授权的重定向 URI：
   - `http://localhost:3000/api/auth/callback/google`
   - 如果是生产环境，添加您的生产域名
7. 复制 Client ID 和 Client Secret 到 `.env.local`

### 4. 获取 MongoDB 连接字符串

#### 使用 MongoDB Atlas（推荐）

1. 前往 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 创建免费集群
3. 创建数据库用户
4. 设置网络访问（允许所有 IP 或添加您的 IP）
5. 点击 "Connect" > "Connect your application"
6. 复制连接字符串，替换 `<username>` 和 `<password>`

#### 使用本地 MongoDB

```env
MONGODB_URI=mongodb://localhost:27017/x-clone
```

### 5. 生成 NEXTAUTH_SECRET

运行以下命令生成一个安全的密钥：

```bash
openssl rand -base64 32
```

或者使用在线工具生成随机字符串。

### 6. 验证环境变量

设置完成后，**重启开发服务器**：

```bash
npm run dev
```

检查控制台输出，应该看到：
- 没有 "警告: GOOGLE_CLIENT_ID 或 GOOGLE_CLIENT_SECRET 未設置" 的警告
- 没有 "錯誤: MONGODB_URI 未設置" 的错误
- 没有 "警告: NEXTAUTH_SECRET 未設置" 的警告

### 7. 常见问题

#### 问题：仍然显示 "註冊失敗，請稍後再試"

**解决方案：**
1. 检查 `.env.local` 文件是否在项目根目录
2. 确认所有环境变量都已正确设置（没有多余的空格）
3. **重启开发服务器**（环境变量更改后必须重启）
4. 检查浏览器控制台和服务器控制台的错误信息

#### 问题：MongoDB 连接失败

**解决方案：**
1. 检查 MongoDB URI 格式是否正确
2. 确认用户名和密码已正确替换（注意特殊字符需要 URL 编码）
3. 检查 MongoDB Atlas 的网络访问设置
4. 确认数据库名称（如 `x-clone`）已添加到 URI 中

#### 问题：Google OAuth 失败

**解决方案：**
1. 确认 Client ID 和 Client Secret 正确
2. 检查重定向 URI 是否已添加到 Google Cloud Console
3. 确认已启用 Google+ API
4. 检查 OAuth 同意屏幕是否已配置

### 8. 调试技巧

在开发环境中，错误信息会显示在：
- **浏览器控制台**（F12 > Console）
- **服务器控制台**（运行 `npm run dev` 的终端）

查看这些错误信息可以帮助您快速定位问题。

