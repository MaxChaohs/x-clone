import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Layout from '@/components/Layout';

export default function Messages() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <Layout>
        <div className="page-content">
          <div className="content-placeholder">
            <p>載入中...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-content">
        <div className="content-placeholder">
          <h1>Messages</h1>
          <p style={{ color: '#71767b', marginTop: '16px' }}>消息功能即將推出</p>
        </div>
      </div>
    </Layout>
  );
}

