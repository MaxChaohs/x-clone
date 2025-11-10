# 修復 OAuth redirect_uri_mismatch 錯誤

## 錯誤說明

`redirect_uri_mismatch` 錯誤表示 OAuth 提供者（Google、GitHub、Facebook）中配置的重定向 URI 與應用程式實際使用的 URI 不匹配。

## 解決步驟

### 1. 確認 NEXTAUTH_URL 環境變數

首先，確認你的 `.env.local` 文件中設定了正確的 `NEXTAUTH_URL`：

**本地開發環境：**
```env
NEXTAUTH_URL=http://localhost:3000
```

**生產環境（Vercel）：**
```env
NEXTAUTH_URL=https://your-app.vercel.app
```

### 2. 修復 Google OAuth 重定向 URI

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇你的專案
3. 前往 **APIs & Services** → **Credentials**
4. 點擊你的 OAuth 2.0 Client ID
5. 在 **Authorized redirect URIs** 區塊中，添加以下 URI：

   **本地開發：**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

   **生產環境：**
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```

6. 點擊 **Save** 儲存變更

### 3. 修復 GitHub OAuth 重定向 URI

1. 前往 [GitHub Developer Settings](https://github.com/settings/developers)
2. 點擊你的 OAuth App（或創建新的）
3. 在 **Authorization callback URL** 欄位中，輸入：

   **本地開發：**
   ```
   http://localhost:3000/api/auth/callback/github
   ```

   **生產環境：**
   ```
   https://your-app.vercel.app/api/auth/callback/github
   ```

4. 點擊 **Update application** 儲存變更

### 4. 修復 Facebook OAuth 重定向 URI

1. 前往 [Facebook Developers](https://developers.facebook.com/)
2. 選擇你的應用程式
3. 前往 **Settings** → **Basic**
4. 在 **Valid OAuth Redirect URIs** 區塊中，添加：

   **本地開發：**
   ```
   http://localhost:3000/api/auth/callback/facebook
   ```

   **生產環境：**
   ```
   https://your-app.vercel.app/api/auth/callback/facebook
   ```

5. 點擊 **Save Changes** 儲存變更

### 5. 重要注意事項

#### URI 格式必須完全匹配

- ✅ 正確：`http://localhost:3000/api/auth/callback/google`
- ❌ 錯誤：`http://localhost:3000/api/auth/callback/google/`（多了一個斜線）
- ❌ 錯誤：`http://localhost:3000/api/auth/callback/Google`（大小寫不同）

#### 本地開發 vs 生產環境

- 如果你在本地開發，確保添加了 `http://localhost:3000/api/auth/callback/[provider]`
- 如果你部署到 Vercel，確保添加了 `https://your-app.vercel.app/api/auth/callback/[provider]`
- 兩者可以同時存在，不會衝突

#### 變更生效時間

- Google：通常立即生效
- GitHub：通常立即生效
- Facebook：可能需要幾分鐘才能生效

### 6. 驗證修復

1. **重啟開發伺服器**（如果正在本地開發）：
   ```bash
   # 停止當前伺服器（Ctrl+C）
   npm run dev
   ```

2. **清除瀏覽器快取和 Cookie**：
   - 清除瀏覽器快取
   - 清除與 OAuth 相關的 Cookie

3. **重新嘗試登入**：
   - 使用 OAuth 提供者登入
   - 應該不再出現 `redirect_uri_mismatch` 錯誤

### 7. 常見問題排查

#### 問題：仍然出現 redirect_uri_mismatch

**解決方案：**
1. 確認 URI 完全匹配（包括協議 http/https、端口號、路徑）
2. 確認在 OAuth 提供者中保存了變更
3. 等待幾分鐘讓變更生效
4. 清除瀏覽器快取並重試

#### 問題：本地可以，但生產環境不行

**解決方案：**
1. 確認 Vercel 環境變數中設定了正確的 `NEXTAUTH_URL`
2. 確認在 OAuth 提供者中添加了生產環境的重定向 URI
3. 確認生產環境的 URL 是正確的（沒有多餘的斜線）

#### 問題：多個環境（開發、預覽、生產）

**解決方案：**
在 OAuth 提供者中添加所有環境的重定向 URI：
- `http://localhost:3000/api/auth/callback/[provider]`
- `https://your-app-git-branch.vercel.app/api/auth/callback/[provider]`（預覽環境）
- `https://your-app.vercel.app/api/auth/callback/[provider]`（生產環境）

### 8. 快速檢查清單

- [ ] `.env.local` 中設定了正確的 `NEXTAUTH_URL`
- [ ] Google OAuth 中添加了正確的重定向 URI
- [ ] GitHub OAuth 中設定了正確的回調 URL
- [ ] Facebook OAuth 中添加了有效的重定向 URI
- [ ] 所有 URI 格式正確（沒有多餘斜線、大小寫正確）
- [ ] 已重啟開發伺服器
- [ ] 已清除瀏覽器快取

完成以上步驟後，`redirect_uri_mismatch` 錯誤應該就會解決了！

