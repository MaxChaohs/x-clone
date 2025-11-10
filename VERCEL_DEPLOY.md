# Vercel 部署指南

## 1. 准备工作

### 1.1 确保项目已推送到 Git

Vercel 需要从 Git 仓库部署，所以首先确保你的项目已经推送到 GitHub、GitLab 或 Bitbucket。

```bash
# 如果还没有初始化 Git
git init
git add .
git commit -m "Initial commit"

# 推送到远程仓库（以 GitHub 为例）
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### 1.2 检查项目配置

确保 `package.json` 中有正确的脚本：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

## 2. 注册 Vercel 账号

1. 访问 [Vercel 官网](https://vercel.com/)
2. 点击 "Sign Up"
3. 使用 GitHub、GitLab 或 Bitbucket 账号登录（推荐，方便连接仓库）

## 3. 部署项目

### 方法一：通过 Vercel Dashboard 部署（推荐）

1. **登录 Vercel Dashboard**
   - 访问 https://vercel.com/dashboard
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **导入项目**
   - 点击 "Add New..." → "Project"
   - 选择你的 Git 仓库
   - 如果看不到仓库，点击 "Adjust GitHub App Permissions" 授权访问

3. **配置项目**
   - **Framework Preset**: 选择 "Next.js"（Vercel 会自动检测）
   - **Root Directory**: 如果项目在子目录，填写子目录路径；否则留空
   - **Build Command**: 留空（使用默认 `next build`）
   - **Output Directory**: 留空（使用默认 `.next`）
   - **Install Command**: 留空（使用默认 `npm install`）

4. **设置环境变量**
   - 在 "Environment Variables" 部分，添加所有需要的环境变量：
   
   ```
   # NextAuth
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-secret-key
   
   # Database
   MONGODB_URI=your-mongodb-uri
   
   # OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   FACEBOOK_CLIENT_ID=your-facebook-app-id
   FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
   
   # Pusher
   PUSHER_APP_ID=your-pusher-app-id
   PUSHER_KEY=your-pusher-key
   PUSHER_SECRET=your-pusher-secret
   PUSHER_CLUSTER=your-pusher-cluster
   NEXT_PUBLIC_PUSHER_KEY=your-pusher-key
   NEXT_PUBLIC_PUSHER_CLUSTER=your-pusher-cluster
   ```

   **重要提示：**
   - `NEXT_PUBLIC_` 前缀的变量会自动暴露给前端
   - 每个环境变量可以选择应用到哪些环境（Production、Preview、Development）
   - 对于生产环境，建议所有变量都设置为 Production

5. **部署**
   - 点击 "Deploy" 按钮
   - Vercel 会自动构建和部署你的应用
   - 部署完成后，你会得到一个 URL（例如：`https://your-app.vercel.app`）

### 方法二：使用 Vercel CLI 部署

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署项目**
   ```bash
   # 在项目根目录执行
   vercel
   ```
   
   首次部署会提示：
   - 是否链接到现有项目？选择 "No"
   - 项目名称：输入你的项目名称
   - 目录：直接回车（使用当前目录）
   - 是否覆盖设置：选择 "No"

4. **设置环境变量**
   ```bash
   # 设置环境变量（生产环境）
   vercel env add NEXTAUTH_URL production
   vercel env add NEXTAUTH_SECRET production
   vercel env add MONGODB_URI production
   # ... 添加其他环境变量
   ```

5. **部署到生产环境**
   ```bash
   vercel --prod
   ```

## 4. 更新 OAuth 回调 URL

部署后，需要更新 OAuth 提供商的回调 URL：

### Google OAuth
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 进入你的项目 → "APIs & Services" → "Credentials"
3. 编辑你的 OAuth 2.0 Client ID
4. 在 "Authorized redirect URIs" 中添加：
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```

### GitHub OAuth
1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. 编辑你的 OAuth App
3. 在 "Authorization callback URL" 中添加：
   ```
   https://your-app.vercel.app/api/auth/callback/github
   ```

### Facebook OAuth
1. 访问 [Facebook Developers](https://developers.facebook.com/)
2. 进入你的应用 → "Settings" → "Basic"
3. 在 "Valid OAuth Redirect URIs" 中添加：
   ```
   https://your-app.vercel.app/api/auth/callback/facebook
   ```

## 5. 更新 NEXTAUTH_URL

部署后，在 Vercel Dashboard 中更新 `NEXTAUTH_URL` 环境变量：

```
NEXTAUTH_URL=https://your-app.vercel.app
```

## 6. 自动部署

Vercel 会自动监听 Git 仓库的推送：
- 推送到 `main`/`master` 分支 → 自动部署到生产环境
- 推送到其他分支 → 自动创建预览部署

## 7. 查看部署状态

- 在 Vercel Dashboard 中查看部署历史
- 每个部署都有独立的 URL
- 可以查看构建日志和错误信息

## 8. 自定义域名（可选）

1. 在 Vercel Dashboard 中进入项目设置
2. 点击 "Domains"
3. 添加你的自定义域名
4. 按照提示配置 DNS 记录

## 9. 环境变量管理

### 在 Vercel Dashboard 中管理
1. 进入项目 → "Settings" → "Environment Variables"
2. 可以添加、编辑、删除环境变量
3. 可以为不同环境设置不同的值

### 使用 Vercel CLI 管理
```bash
# 查看所有环境变量
vercel env ls

# 添加环境变量
vercel env add VARIABLE_NAME production

# 删除环境变量
vercel env rm VARIABLE_NAME production
```

## 10. 故障排除

### 构建失败
- 检查构建日志中的错误信息
- 确保所有依赖都已正确安装
- 检查 `package.json` 中的脚本是否正确

### 环境变量未生效
- 确保环境变量已添加到 Vercel
- 检查变量名是否正确（区分大小写）
- 重新部署项目（环境变量更改后需要重新部署）

### OAuth 回调失败
- 检查回调 URL 是否正确配置
- 确保 `NEXTAUTH_URL` 环境变量设置为正确的域名
- 检查 OAuth 提供商中的回调 URL 是否匹配

### 数据库连接失败
- 确保 MongoDB URI 正确
- 检查 MongoDB Atlas 的 IP 白名单（如果使用 Atlas）
- 确保网络访问权限已正确配置

## 11. 性能优化建议

1. **启用 Edge Functions**（如果适用）
2. **使用 Vercel Analytics** 监控性能
3. **配置 CDN** 缓存静态资源
4. **优化图片** 使用 Next.js Image 组件

## 12. 安全建议

1. **不要提交敏感信息**
   - 确保 `.env.local` 在 `.gitignore` 中
   - 不要在代码中硬编码密钥

2. **使用环境变量**
   - 所有敏感信息都通过环境变量管理
   - 定期轮换密钥和密码

3. **启用 HTTPS**
   - Vercel 默认提供 HTTPS
   - 确保所有 API 调用都使用 HTTPS

## 常见问题

**Q: 部署后如何查看日志？**
A: 在 Vercel Dashboard 中，进入项目 → "Deployments" → 选择部署 → "Functions" 标签页

**Q: 如何回滚到之前的版本？**
A: 在 Vercel Dashboard 中，进入 "Deployments"，找到之前的部署，点击 "..." → "Promote to Production"

**Q: 免费套餐有什么限制？**
A: Vercel 免费套餐包括：
- 100GB 带宽/月
- 100 次构建/天
- 无限制的预览部署
- 自动 HTTPS

**Q: 如何设置自定义构建命令？**
A: 在项目根目录创建 `vercel.json` 文件：
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install"
}
```

