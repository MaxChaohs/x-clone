# MongoDB Atlas 設置指南

## 步驟 1：創建 MongoDB Atlas 賬戶

1. 前往 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. 點擊 "Try Free" 或 "Sign Up"
3. 使用 Google/GitHub 賬戶登入，或創建新賬戶

## 步驟 2：創建免費集群

1. 登入後，點擊 "Build a Database"
2. 選擇 **FREE (M0)** 選項
3. 選擇雲提供商和區域（建議選擇離您最近的區域，如 `aws ap-northeast-1` 東京）
4. 集群名稱可以保持默認或自定義
5. 點擊 "Create Cluster"

## 步驟 3：創建數據庫用戶

1. 在 "Database Access" 頁面，點擊 "Add New Database User"
2. 選擇 "Password" 認證方式
3. 設置用戶名和密碼（**請記住這些信息！**）
4. 用戶權限選擇 "Atlas admin" 或 "Read and write to any database"
5. 點擊 "Add User"

## 步驟 4：設置網絡訪問

1. 在 "Network Access" 頁面，點擊 "Add IP Address"
2. 開發環境：點擊 "Allow Access from Anywhere"（允許所有 IP）
   - 或添加您的具體 IP 地址
3. 點擊 "Confirm"

## 步驟 5：獲取連接字符串

1. 回到 "Database" 頁面，點擊 "Connect"
2. 選擇 "Connect your application"
3. 選擇驅動程序：**Node.js**，版本：**5.5 or later**
4. 複製連接字符串，格式類似：
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## 步驟 6：更新 .env.local 文件

在項目根目錄創建 `.env.local` 文件（如果不存在），並填入以下內容：

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-key-change-this-in-production

# Database - MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/x-clone?retryWrites=true&w=majority
```

**重要提示：**
- 將 `<username>` 替換為您在第 3 步創建的數據庫用戶名
- 將 `<password>` 替換為您在第 3 步創建的數據庫密碼
- 將 `cluster0.xxxxx.mongodb.net` 替換為您實際的集群地址
- 將 `x-clone` 替換為您想要的數據庫名稱（或保持默認）

**示例：**
```env
MONGODB_URI=mongodb+srv://myuser:mypassword123@cluster0.abc123.mongodb.net/x-clone?retryWrites=true&w=majority
```

## 步驟 7：測試連接

1. 確保 `.env.local` 文件已正確配置
2. 啟動開發服務器：
   ```bash
   npm run dev
   ```
3. 如果連接成功，應用應該能正常運行
4. 如果出現連接錯誤，請檢查：
   - 用戶名和密碼是否正確
   - 網絡訪問是否已設置
   - 連接字符串格式是否正確

## 常見問題

### 1. 連接被拒絕
- 檢查 "Network Access" 是否已添加您的 IP 地址
- 確認數據庫用戶名和密碼是否正確

### 2. 認證失敗
- 確認用戶名和密碼中沒有特殊字符需要 URL 編碼
- 如果密碼包含特殊字符，請使用 URL 編碼（如 `@` 改為 `%40`）

### 3. 找不到數據庫
- 確認連接字符串中的數據庫名稱（`x-clone`）是否正確
- MongoDB Atlas 會自動創建不存在的數據庫

## 下一步

設置好 MongoDB Atlas 後，您可以：
1. 測試應用是否能正常運行
2. 嘗試註冊和登入功能
3. 測試發文和按讚功能
4. 後續再添加 OAuth 和 Pusher 配置

