# X Clone - Next.js Social Media Platform

一個使用 Next.js 構建的 X (Twitter) 克隆社交媒體平台，支持實時消息、帖子互動和用戶社交功能。

## 功能特色

### 核心功能
- ✅ **用戶認證** - 支持 Google、GitHub、Facebook OAuth 登錄
- ✅ **帖子系統** - 發布、編輯、刪除帖子
- ✅ **社交互動** - 點讚、評論、轉發、收藏
- ✅ **實時消息** - 基於 Pusher 的實時消息系統
- ✅ **用戶關注** - 關注/取消關注其他用戶
- ✅ **個人資料** - 自定義個人資料和頭像
- ✅ **動態更新** - 實時推送新帖子和互動通知

### 技術特性
- 🚀 **Next.js 14** - 最新的 React 框架
- 🗄️ **MongoDB** - NoSQL 數據庫存儲
- 🔐 **NextAuth.js** - 安全的身份驗證系統
- ⚡ **Pusher** - 實時 WebSocket 通信
- 🎨 **響應式設計** - 適配各種設備

## 技術棧

- **前端框架**: Next.js 14, React 18
- **後端**: Next.js API Routes
- **數據庫**: MongoDB (支持 MongoDB Atlas)
- **身份驗證**: NextAuth.js
- **實時通信**: Pusher
- **語言**: JavaScript/TypeScript
- **部署**: Vercel (推薦)

## 開始使用

### 前置要求

- Node.js 18+ 
- npm 或 yarn
- MongoDB 數據庫（本地或 MongoDB Atlas）
- Google/GitHub/Facebook OAuth 應用（可選）
- Pusher 賬戶（用於實時功能）

### 安裝步驟

1. **克隆項目**

```bash
git clone <repository-url>
cd wphw5
```

2. **安裝依賴**

```bash
npm install
```

3. **配置環境變量**

複製 `env.template` 文件並創建 `.env.local`：

```bash
cp env.template .env.local
```

編輯 `.env.local` 並填入必要的配置：

```env
# NextAuth 配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-this-in-production

# MongoDB 數據庫連接
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/x-clone

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# OAuth - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# OAuth - Facebook
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret

# Pusher
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=your-pusher-cluster
```

4. **生成 NEXTAUTH_SECRET**

```bash
openssl rand -base64 32
```

將生成的字符串填入 `.env.local` 中的 `NEXTAUTH_SECRET`。

5. **運行開發服務器**

```bash
npm run dev
```

打開瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

## 詳細設置指南

### MongoDB 設置

詳細的 MongoDB Atlas 設置指南請參考：[MONGODB_ATLAS_SETUP.md](./MONGODB_ATLAS_SETUP.md)

### OAuth 設置

#### Google OAuth
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新項目或選擇現有項目
3. 啟用 Google+ API
4. 創建 OAuth 2.0 客戶端 ID
5. 添加授權的重定向 URI：`http://localhost:3000/api/auth/callback/google`

詳細指南請參考：[ENV_SETUP.md](./ENV_SETUP.md) 和 [OAUTH_REDIRECT_URI_FIX.md](./OAUTH_REDIRECT_URI_FIX.md)

### Pusher 設置

詳細的 Pusher 設置指南請參考：[PUSHER_SETUP.md](./PUSHER_SETUP.md)

### Vercel 部署

詳細的部署指南請參考：[VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md)

## 項目結構

```
wphw5/
├── components/          # React 組件
│   ├── HomePage.js      # 主頁組件
│   ├── Layout.js        # 布局組件
│   ├── PostModal.js     # 帖子模態框
│   └── SignInPage.js    # 登錄頁面
├── pages/               # Next.js 頁面
│   ├── api/             # API 路由
│   │   ├── auth/        # 認證相關
│   │   ├── posts/       # 帖子相關
│   │   ├── users/       # 用戶相關
│   │   ├── messages/    # 消息相關
│   │   └── pusher/      # Pusher 認證
│   ├── [userID].js      # 用戶個人資料頁
│   ├── home.js          # 主頁
│   ├── messages.js      # 消息頁面
│   └── compose/post.js  # 發布帖子頁面
├── lib/                 # 工具庫
│   ├── mongodb.js       # MongoDB 連接
│   └── pusher.js        # Pusher 配置
├── styles/              # 樣式文件
└── public/              # 靜態資源
```

## 可用腳本

```bash
# 開發模式
npm run dev

# 構建生產版本
npm run build

# 啟動生產服務器
npm start

# 代碼檢查
npm run lint
```

## 主要功能說明

### 帖子功能
- 發布新帖子
- 編輯和刪除自己的帖子
- 點讚和取消點讚
- 評論帖子
- 轉發帖子
- 收藏帖子

### 用戶功能
- 註冊和登錄（OAuth）
- 查看個人資料
- 編輯個人資料
- 關注/取消關注其他用戶
- 查看關注者和關注列表

### 消息功能
- 發送私信
- 實時接收消息
- 查看消息歷史

### 實時功能
- 新帖子實時推送
- 新消息實時通知
- 互動實時更新

## 環境變量說明

| 變量名 | 說明 | 必需 |
|--------|------|------|
| `NEXTAUTH_URL` | NextAuth 回調 URL | ✅ |
| `NEXTAUTH_SECRET` | NextAuth 加密密鑰 | ✅ |
| `MONGODB_URI` | MongoDB 連接字符串 | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | ⚠️ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | ⚠️ |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | ⚠️ |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | ⚠️ |
| `FACEBOOK_CLIENT_ID` | Facebook App ID | ⚠️ |
| `FACEBOOK_CLIENT_SECRET` | Facebook App Secret | ⚠️ |
| `PUSHER_APP_ID` | Pusher App ID | ⚠️ |
| `PUSHER_KEY` | Pusher Key | ⚠️ |
| `PUSHER_SECRET` | Pusher Secret | ⚠️ |
| `PUSHER_CLUSTER` | Pusher Cluster | ⚠️ |

⚠️ 標記的變量為可選，但某些功能可能需要它們。

## 常見問題

### 問題：註冊失敗，請稍後再試

**解決方案：**
1. 檢查 `.env.local` 文件是否在項目根目錄
2. 確認所有環境變量都已正確設置
3. **重啟開發服務器**（環境變量更改後必須重啟）
4. 檢查瀏覽器控制台和服務器控制台的錯誤信息

詳細排查指南請參考：[ENV_SETUP.md](./ENV_SETUP.md)

### 問題：MongoDB 連接失敗

**解決方案：**
1. 檢查 MongoDB URI 格式是否正確
2. 確認用戶名和密碼已正確替換（注意特殊字符需要 URL 編碼）
3. 檢查 MongoDB Atlas 的網絡訪問設置
4. 確認數據庫名稱已添加到 URI 中

### 問題：OAuth 登錄失敗

**解決方案：**
1. 確認 Client ID 和 Client Secret 正確
2. 檢查重定向 URI 是否已添加到 OAuth 提供商控制台
3. 確認已啟用相應的 API
4. 檢查 OAuth 同意屏幕是否已配置

## 開發指南

### 添加新功能

1. 在 `pages/api/` 下創建新的 API 路由
2. 在 `components/` 或 `pages/` 下創建對應的前端組件
3. 更新數據庫模型（如需要）
4. 添加必要的環境變量（如需要）

### 數據庫模型

主要集合：
- `users` - 用戶信息
- `posts` - 帖子內容
- `messages` - 私信消息
- `accounts` - OAuth 賬戶關聯（NextAuth）

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 許可證

本項目僅供學習使用。

## 相關文檔

- [環境變量設置指南](./ENV_SETUP.md)
- [MongoDB Atlas 設置指南](./MONGODB_ATLAS_SETUP.md)
- [Pusher 設置指南](./PUSHER_SETUP.md)
- [OAuth 重定向 URI 修復指南](./OAUTH_REDIRECT_URI_FIX.md)
- [Vercel 部署指南](./VERCEL_DEPLOY.md)

## 聯繫方式

如有問題，請提交 Issue 或聯繫項目維護者。

---

**注意：** 這是一個學習項目，請勿用於生產環境，除非您已充分了解安全性和性能優化。

