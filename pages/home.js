import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Layout from '@/components/Layout';
import HomePage from '@/components/HomePage';

export default function HomeRoute() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // 只有在明確未認證時才重定向，避免在 OAuth 回調過程中重定向
    if (status === 'unauthenticated' && !router.query.callbackUrl) {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // 當用戶成功登入時，保存帳號到 localStorage
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.userID) {
      try {
        if (typeof window !== 'undefined') {
          const localUsersJson = localStorage.getItem('vas_logged_in_users');
          const localUsers = localUsersJson ? JSON.parse(localUsersJson) : [];

          // 檢查是否已存在
          const existingIndex = localUsers.findIndex(u => u.userID === session.user.userID);
          
          const userData = {
            userID: session.user.userID,
            name: session.user.name || '',
            provider: session.user.provider || 'unknown',
            image: session.user.image || null,
            email: session.user.email || null,
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
        }
      } catch (error) {
        console.error('Error saving user to localStorage:', error);
      }
    }
  }, [status, session]);

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return <div>Redirecting to sign in...</div>;
  }

  if (!session) {
    return <div>Loading session...</div>;
  }

  return (
    <Layout>
      <HomePage />
    </Layout>
  );
}

