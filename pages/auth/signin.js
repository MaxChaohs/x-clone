import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { signIn } from 'next-auth/react';
import SignInPage from '@/components/SignInPage';

export default function SignIn() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [registerStep, setRegisterStep] = useState('select-provider'); // 'select-provider' | 'enter-info' | 'login'
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [userID, setUserID] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // 檢查 URL 中的錯誤參數
  useEffect(() => {
    const { error: urlError } = router.query;
    if (urlError) {
      if (urlError === 'OAuthAccountNotLinked') {
        setError('OAuth 賬戶未關聯，請先註冊或使用正確的賬戶登入');
      } else if (urlError === 'Configuration') {
        setError('OAuth 配置錯誤，請檢查環境變量設置');
      } else if (urlError === 'AccessDenied') {
        setError('訪問被拒絕，請重試');
      } else {
        setError(`登入錯誤: ${urlError}`);
      }
      // 清除 URL 中的錯誤參數
      router.replace('/auth/signin', undefined, { shallow: true });
    }
  }, [router]);

  useEffect(() => {
    // 只有在明確認證成功且不在 OAuth 回調過程中時才跳轉
    if (status === 'authenticated' && session) {
      // 檢查是否有有效的 userID
      if (session.user?.userID) {
        // 將當前登入的帳號保存到 localStorage
        saveUserToLocalStorage(session.user);
        router.push('/home');
      } else {
        // 如果沒有 userID，等待一下再檢查
        console.warn('Session 沒有 userID，等待更新...');
      }
    }
  }, [status, session, router]);

  // 將用戶保存到 localStorage
  const saveUserToLocalStorage = (user) => {
    try {
      if (!user?.userID) return;

      // 確保在瀏覽器環境中
      if (typeof window === 'undefined') return;

      const localUsersJson = localStorage.getItem('vas_logged_in_users');
      const localUsers = localUsersJson ? JSON.parse(localUsersJson) : [];

      // 檢查是否已存在
      const existingIndex = localUsers.findIndex(u => u.userID === user.userID);
      
      const userData = {
        userID: user.userID,
        name: user.name || '',
        provider: user.provider || 'unknown',
        image: user.image || null,
        email: user.email || null,
        lastLoginAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // 更新現有用戶（更新最後登入時間）
        localUsers[existingIndex] = userData;
      } else {
        // 添加新用戶
        localUsers.push(userData);
      }

      // 限制最多保存 10 個帳號
      const maxAccounts = 10;
      if (localUsers.length > maxAccounts) {
        // 按最後登入時間排序，保留最新的
        localUsers.sort((a, b) => {
          const timeA = new Date(a.lastLoginAt || 0).getTime();
          const timeB = new Date(b.lastLoginAt || 0).getTime();
          return timeB - timeA;
        });
        localUsers.splice(maxAccounts);
      }

      localStorage.setItem('vas_logged_in_users', JSON.stringify(localUsers));
    } catch (error) {
      console.error('Error saving user to localStorage:', error);
    }
  };

  // 載入本地存儲的帳號列表 - 使用 useCallback 確保函數引用穩定
  const loadLocalUsers = useCallback(async () => {
    try {
      // 確保在瀏覽器環境中
      if (typeof window === 'undefined') {
        setRegisteredUsers([]);
        return;
      }

      const localUsersJson = localStorage.getItem('vas_logged_in_users');
      if (!localUsersJson) {
        setRegisteredUsers([]);
        return;
      }

      const localUsers = JSON.parse(localUsersJson);
      
      // 如果沒有本地用戶，直接返回
      if (localUsers.length === 0) {
        setRegisteredUsers([]);
        return;
      }

      // 驗證本地用戶是否仍然存在於數據庫中
      try {
        const userIDs = localUsers.map(u => u.userID).filter(Boolean);
        
        if (userIDs.length > 0) {
          const response = await fetch('/api/users/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIDs }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const existingUserIDs = new Set(data.existingUserIDs);
              
              // 過濾出仍然存在的用戶
              const validUsers = localUsers.filter(u => 
                u.userID && existingUserIDs.has(u.userID)
              );

              // 更新 localStorage，移除已刪除的用戶
              if (validUsers.length !== localUsers.length) {
                localStorage.setItem('vas_logged_in_users', JSON.stringify(validUsers));
              }

              // 按最後登入時間排序（最新的在前）
              validUsers.sort((a, b) => {
                const timeA = new Date(a.lastLoginAt || 0).getTime();
                const timeB = new Date(b.lastLoginAt || 0).getTime();
                return timeB - timeA;
              });
              
              setRegisteredUsers(validUsers);
              return;
            }
          }
        }
      } catch (verifyError) {
        console.error('Error verifying users:', verifyError);
        // 如果驗證失敗，仍然顯示本地用戶（避免網絡問題導致無法顯示）
      }

      // 如果驗證失敗或沒有 userID，按最後登入時間排序（最新的在前）
      localUsers.sort((a, b) => {
        const timeA = new Date(a.lastLoginAt || 0).getTime();
        const timeB = new Date(b.lastLoginAt || 0).getTime();
        return timeB - timeA;
      });
      setRegisteredUsers(localUsers);
    } catch (error) {
      console.error('Error loading local users:', error);
      setRegisteredUsers([]);
    }
  }, []);

  // 從 localStorage 載入本地登入過的帳號列表
  useEffect(() => {
    if (registerStep === 'login') {
      loadLocalUsers();
    }
  }, [registerStep, loadLocalUsers]);

  // 使用 useRef 來追蹤當前的搜索請求，避免重複請求
  const searchTimeoutRef = useRef(null);
  const lastSearchTermRef = useRef('');

  // 搜索用戶（用於搜索其他用戶）- 使用 useCallback 確保函數引用穩定
  const searchUsers = useCallback(async (searchTerm) => {
    // 清除之前的定時器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 如果搜索詞與上次相同，不重複搜索
    if (searchTerm === lastSearchTermRef.current) {
      return;
    }

    // 如果沒有搜索條件，只顯示本地帳號
    if (!searchTerm || !searchTerm.trim()) {
      lastSearchTermRef.current = '';
      loadLocalUsers();
      return;
    }

    // 更新最後搜索詞
    lastSearchTermRef.current = searchTerm;

    // 使用防抖，避免頻繁請求
    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch(`/api/users/list?search=${encodeURIComponent(searchTerm.trim())}`);
        const data = await response.json();
        if (data.success) {
          // 合併搜索結果和本地帳號（去重）
          if (typeof window !== 'undefined') {
            const localUsersJson = localStorage.getItem('vas_logged_in_users');
            const localUsers = localUsersJson ? JSON.parse(localUsersJson) : [];
            
            // 驗證本地用戶是否仍然存在
            let validLocalUsers = localUsers;
            if (localUsers.length > 0) {
              try {
                const userIDs = localUsers.map(u => u.userID).filter(Boolean);
                if (userIDs.length > 0) {
                  const verifyResponse = await fetch('/api/users/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIDs }),
                  });
                  
                  if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    if (verifyData.success) {
                      const existingUserIDs = new Set(verifyData.existingUserIDs);
                      validLocalUsers = localUsers.filter(u => 
                        u.userID && existingUserIDs.has(u.userID)
                      );
                      
                      // 更新 localStorage，移除已刪除的用戶
                      if (validLocalUsers.length !== localUsers.length) {
                        localStorage.setItem('vas_logged_in_users', JSON.stringify(validLocalUsers));
                      }
                    }
                  }
                }
              } catch (verifyError) {
                console.error('Error verifying local users in search:', verifyError);
                // 如果驗證失敗，仍然使用本地用戶
              }
            }
            
            // 合併並去重（基於 userID）
            const allUsers = [...validLocalUsers];
            const localUserIDs = new Set(validLocalUsers.map(u => u.userID));
            
            data.users.forEach(user => {
              if (!localUserIDs.has(user.userID)) {
                allUsers.push(user);
              }
            });
            
            setRegisteredUsers(allUsers);
          } else {
            setRegisteredUsers(data.users || []);
          }
        }
      } catch (error) {
        console.error('Error searching users:', error);
        // 搜索失敗時，至少顯示本地帳號
        loadLocalUsers();
      } finally {
        setLoadingUsers(false);
      }
    }, 300); // 300ms 防抖
  }, [loadLocalUsers]);

  // 註冊步驟 1：選擇 Provider
  const handleRegisterStep1 = () => {
    setRegisterStep('select-provider');
    setSelectedProvider(null);
    setUserID('');
    setName('');
    setError('');
  };

  // 註冊步驟 2：輸入 userID 和名稱
  const handleRegisterStep2 = async () => {
    if (registerStep === 'select-provider') {
      // 從選擇 Provider 進入輸入信息
      if (!selectedProvider) {
        setError('請選擇 OAuth Provider');
        return;
      }
      setRegisterStep('enter-info');
      setError('');
    } else if (registerStep === 'enter-info') {
      // 提交註冊信息
      setError('');

      if (!userID.trim() || !name.trim()) {
        setError('請填寫所有欄位');
        return;
      }

      try {
        // 先註冊用戶（創建待關聯的記錄）
        const response = await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userID, name, provider: selectedProvider }),
        });

        // 檢查響應狀態和內容類型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          // 如果不是 JSON 響應，讀取文本內容
          const text = await response.text();
          console.error('非 JSON 響應:', text);
          setError('服務器返回了非預期的響應格式，請檢查服務器日誌');
          return;
        }

        // 解析 JSON 響應
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('JSON 解析錯誤:', jsonError);
          setError('無法解析服務器響應，請檢查服務器配置');
          return;
        }

        if (data.success) {
          // 註冊成功後，跳轉到 OAuth 登入
          // NextAuth 會在 OAuth 回調時查找該 Provider 下最近創建的待關聯記錄
          await signIn(selectedProvider, {
            callbackUrl: '/home',
            redirect: true,
          });
        } else {
          // 顯示服務器返回的錯誤信息
          const errorMsg = data.message || '註冊失敗';
          setError(errorMsg);
          console.error('註冊失敗:', data);
        }
      } catch (error) {
        // 顯示網絡錯誤或其他錯誤
        const errorMsg = error.message || '註冊失敗，請稍後再試';
        setError(errorMsg);
        console.error('註冊錯誤:', error);
      }
    }
  };

  // 登入：通過 userID 跳轉到對應的 Provider
  const handleLoginWithUserID = async (inputUserID) => {
    if (!inputUserID) {
      // 切換到登入模式
      setRegisterStep('login');
      setError('');
      return;
    }

    setError('');

    try {
      // 獲取用戶的 Provider 信息
      const response = await fetch(`/api/users/${inputUserID}/provider`);
      
      // 檢查響應狀態和內容類型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('非 JSON 響應:', text);
        setError('服務器返回了非預期的響應格式，請檢查服務器日誌');
        return;
      }

      const data = await response.json();

      if (data.success) {
        // 如果有多個匹配的用戶（不同 provider），讓用戶選擇
        if (data.multiple && data.users && data.users.length > 1) {
          // 暫時使用第一個找到的 provider（未來可以改進為讓用戶選擇）
          // 優先使用 Google，然後是 GitHub
          const sortedUsers = data.users.sort((a, b) => {
            if (a.provider === 'google') return -1;
            if (b.provider === 'google') return 1;
            if (a.provider === 'github') return -1;
            if (b.provider === 'github') return 1;
            return 0;
          });
          const selectedUser = sortedUsers[0];
          
          await signIn(selectedUser.provider, {
            callbackUrl: '/home',
            redirect: true,
          });
          return;
        }
        
        // 單一用戶的情況
        // 檢查用戶是否已完成 OAuth
        if (data.oauthCompleted === false) {
          // 用戶已註冊但未完成 OAuth，提示用戶完成 OAuth
          setError(data.message || '用戶尚未完成 OAuth 認證，請先完成 OAuth 登入');
          // 仍然允許跳轉到 OAuth，讓用戶完成認證
          await signIn(data.provider, {
            callbackUrl: '/home',
            redirect: true,
          });
        } else {
          // 用戶已完成 OAuth，直接登入
          await signIn(data.provider, {
            callbackUrl: '/home',
            redirect: true,
          });
        }
      } else {
        setError(data.message || '用戶不存在');
      }
    } catch (error) {
      const errorMsg = error.message || '登入失敗，請稍後再試';
      setError(errorMsg);
      console.error('登入錯誤:', error);
    }
  };


  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  return (
    <SignInPage
      registerStep={registerStep}
      selectedProvider={selectedProvider}
      setSelectedProvider={setSelectedProvider}
      userID={userID}
      setUserID={setUserID}
      name={name}
      setName={setName}
      error={error}
      registeredUsers={registeredUsers}
      loadingUsers={loadingUsers}
      onRegisterStep1={handleRegisterStep1}
      onRegisterStep2={handleRegisterStep2}
      onLoginWithUserID={handleLoginWithUserID}
      onSearchUsers={searchUsers}
    />
  );
}
