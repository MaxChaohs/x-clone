import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
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
        router.push('/home');
      } else {
        // 如果沒有 userID，等待一下再檢查
        console.warn('Session 沒有 userID，等待更新...');
      }
    }
  }, [status, session, router]);

  // 載入已註冊用戶列表
  useEffect(() => {
    if (registerStep === 'login') {
      loadRegisteredUsers();
    }
  }, [registerStep]);

  const loadRegisteredUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/users/list');
      const data = await response.json();
      if (data.success) {
        setRegisteredUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

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
    />
  );
}
