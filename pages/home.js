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

