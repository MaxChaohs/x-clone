import { useState, useEffect } from 'react';

export default function SignInPage({
  onRegisterStep1, // 选择 Provider
  onRegisterStep2, // 输入 userID 和名称
  onLoginWithUserID, // 通过 userID 登录
  registeredUsers, // 已注册用户列表（搜索结果）
  loadingUsers,
  onSearchUser, // 搜索用户
  selectedProvider,
  setSelectedProvider,
  userID,
  setUserID,
  name,
  setName,
  error,
  registerStep, // 'select-provider' | 'enter-info'
}) {
  const [searchTerm, setSearchTerm] = useState('');

  // 搜索用户（使用防抖）
  useEffect(() => {
    if (registerStep === 'login') {
      const timeoutId = setTimeout(() => {
        if (onSearchUser) {
          onSearchUser(searchTerm);
        }
      }, 300); // 300ms 防抖

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, registerStep, onSearchUser]);

  // 使用搜索結果作為過濾後的用戶列表
  const filteredUsers = registeredUsers || [];

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-box">
          <div className="auth-logo">
            <div className="logo-large">VAS</div>
          </div>
          <h1 className="auth-title">加入 VAS</h1>

          {/* 註冊流程 */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${registerStep === 'select-provider' ? 'active' : ''}`}
              onClick={() => onRegisterStep1 && onRegisterStep1()}
            >
              註冊
            </button>
            <button
              className={`auth-tab ${registerStep === 'login' ? 'active' : ''}`}
              onClick={() => onLoginWithUserID && onLoginWithUserID()}
            >
              登入
            </button>
          </div>

          {registerStep === 'select-provider' && (
            <div className="register-flow">
              <h2 style={{ fontSize: '20px', marginBottom: '24px', textAlign: 'center' }}>
                選擇 OAuth Provider
              </h2>
              <div className="oauth-section">
                <button
                  className={`oauth-btn google-btn ${selectedProvider === 'google' ? 'selected' : ''}`}
                  onClick={() => setSelectedProvider('google')}
                >
                  <svg className="oauth-icon" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  className={`oauth-btn github-btn ${selectedProvider === 'github' ? 'selected' : ''}`}
                  onClick={() => setSelectedProvider('github')}
                >
                  <svg className="oauth-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span>GitHub</span>
                </button>

                <button
                  className={`oauth-btn facebook-btn ${selectedProvider === 'facebook' ? 'selected' : ''}`}
                  onClick={() => setSelectedProvider('facebook')}
                >
                  <svg className="oauth-icon" viewBox="0 0 24 24" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  <span>Facebook</span>
                </button>
              </div>

              {selectedProvider && (
                <button
                  className="auth-submit-btn"
                  onClick={() => onRegisterStep2 && onRegisterStep2()}
                  style={{ marginTop: '24px' }}
                >
                  下一步
                </button>
              )}
            </div>
          )}

          {registerStep === 'enter-info' && (
            <form className="auth-form" onSubmit={(e) => {
              e.preventDefault();
              onRegisterStep2 && onRegisterStep2();
            }}>
              <h2 style={{ fontSize: '20px', marginBottom: '24px', textAlign: 'center' }}>
                輸入用戶信息
              </h2>
              <div className="form-group">
                <label htmlFor="registerUserID">用戶ID</label>
                <input
                  type="text"
                  id="registerUserID"
                  value={userID}
                  onChange={(e) => setUserID(e.target.value)}
                  placeholder="輸入您想要的用戶ID"
                  required
                />
                <small className="form-hint">
                  用戶ID 規則：3-20 個字符，只能包含字母、數字、底線和連字符
                </small>
                {error && <span className="error-message">{error}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="registerName">顯示名稱</label>
                <input
                  type="text"
                  id="registerName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入您的顯示名稱"
                  required
                />
                <small className="form-hint">
                  顯示名稱可以與其他人重複
                </small>
              </div>
              <button type="submit" className="auth-submit-btn">
                繼續註冊
              </button>
            </form>
          )}

          {/* 登入流程 */}
          {registerStep === 'login' && (
            <div className="login-flow">
              <h2 style={{ fontSize: '20px', marginBottom: '24px', textAlign: 'center' }}>
                登入您的帳號
              </h2>
              
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <input
                  type="text"
                  placeholder="搜尋用戶ID 或名稱以登入..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchTerm.trim()) {
                      // 如果只有一個結果，直接登入
                      if (filteredUsers.length === 1) {
                        onLoginWithUserID && onLoginWithUserID(filteredUsers[0].userID);
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: '#000000',
                    border: '1px solid #2f3336',
                    borderRadius: '4px',
                    color: '#ffffff',
                    fontSize: '15px',
                  }}
                />
                <small className="form-hint" style={{ marginTop: '8px', display: 'block', color: '#71767b' }}>
                  輸入用戶ID或名稱進行搜索，然後點擊用戶登入
                </small>
              </div>

              {loadingUsers ? (
                <div style={{ textAlign: 'center', color: '#71767b' }}>搜索中...</div>
              ) : !searchTerm.trim() ? (
                <div style={{ textAlign: 'center', color: '#71767b', padding: '40px 0' }}>
                  <p>請在上方搜索框中輸入用戶ID或名稱</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>
                    為了保護隱私，我們不會顯示所有用戶列表
                  </p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#71767b', padding: '40px 0' }}>
                  找不到匹配的用戶
                </div>
              ) : (
                <div className="users-list">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.userID}
                      className="user-item"
                      onClick={() => onLoginWithUserID && onLoginWithUserID(user.userID)}
                      style={{
                        padding: '16px',
                        border: '1px solid #2f3336',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#181818'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {user.image && (
                        <img
                          src={user.image}
                          alt={user.name}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', marginBottom: '4px' }}>
                          {user.name}
                        </div>
                        <div style={{ color: '#71767b', fontSize: '14px' }}>
                          @{user.userID}
                        </div>
                      </div>
                      <div style={{ color: '#71767b', fontSize: '12px' }}>
                        {user.provider === 'google' && '🔵 Google'}
                        {user.provider === 'github' && '⚫ GitHub'}
                        {user.provider === 'facebook' && '🔵 Facebook'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
