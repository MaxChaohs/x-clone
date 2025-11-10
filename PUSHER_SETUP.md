# Pusher 设置指南

## 1. 注册 Pusher 账号

1. 访问 [Pusher 官网](https://pusher.com/)
2. 点击 "Sign Up" 注册账号（可以使用 GitHub、Google 等账号快速注册）
3. 完成注册后，登录到 Pusher Dashboard

## 2. 创建 Pusher App

1. 登录后，点击 "Create app" 或 "Channels" → "Create app"
2. 填写应用信息：
   - **App name**: 给你的应用起个名字（例如：`x-clone`）
   - **Cluster**: 选择离你最近的区域（例如：`us2`、`eu`、`ap1` 等）
   - **Front-end tech**: 选择 "React"
   - **Back-end tech**: 选择 "Node.js"
3. 点击 "Create app"

## 3. 获取 Pusher 配置信息

创建应用后，你会看到应用的配置信息页面，包含：

- **App ID**: 例如 `1234567`
- **Key**: 例如 `abc123def456`
- **Secret**: 例如 `xyz789uvw012`
- **Cluster**: 例如 `us2`

## 4. 在项目中设置环境变量

### 方法一：创建 `.env.local` 文件（推荐）

在项目根目录创建 `.env.local` 文件（如果不存在），添加以下内容：

```env
# Pusher 配置
PUSHER_APP_ID=你的_APP_ID
PUSHER_KEY=你的_KEY
PUSHER_SECRET=你的_SECRET
PUSHER_CLUSTER=你的_CLUSTER

# 前端也需要这些配置（用于客户端连接）
NEXT_PUBLIC_PUSHER_KEY=你的_KEY
NEXT_PUBLIC_PUSHER_CLUSTER=你的_CLUSTER
```

**重要提示：**
- `.env.local` 文件应该被添加到 `.gitignore` 中，不要提交到 Git
- `PUSHER_SECRET` 是敏感信息，只能在后端使用，不要暴露给前端
- `NEXT_PUBLIC_` 前缀的变量会被暴露给前端，所以只放 KEY 和 CLUSTER

### 方法二：在系统环境变量中设置

如果你使用部署平台（如 Vercel、Heroku 等），可以在平台的环境变量设置中添加这些变量。

## 5. 验证设置

设置完成后，重启开发服务器：

```bash
npm run dev
```

如果配置正确，你应该在控制台看到：
```
Pusher 初始化成功
```

如果看到警告信息，请检查：
1. 环境变量是否正确设置
2. 值是否包含占位符（如 `your-pusher-app-id`）
3. `.env.local` 文件是否在项目根目录

## 6. 测试实时功能

1. 使用两个不同的账号登录
2. 在一个账号中按赞或留言
3. 另一个账号应该实时看到更新

## 注意事项

- **免费套餐限制**：Pusher 免费套餐有连接数和消息数限制
- **安全性**：确保 `PUSHER_SECRET` 不会暴露给前端
- **Cluster 选择**：选择离你用户最近的 cluster 以获得更好的性能

## 故障排除

如果 Pusher 无法工作：

1. 检查环境变量是否正确设置
2. 确认 `.env.local` 文件在项目根目录
3. 重启开发服务器
4. 检查浏览器控制台是否有错误信息
5. 确认 Pusher Dashboard 中的应用状态是 "Active"

