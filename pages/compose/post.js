import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';

export default function ComposePost() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (data.success) {
        router.push('/home');
      } else {
        alert(data.message || '發文失敗');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('發文失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 style={{ marginBottom: '24px' }}>發文</h1>
          <form onSubmit={handleSubmit}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '12px',
                backgroundColor: '#000000',
                border: '1px solid #2f3336',
                borderRadius: '4px',
                color: '#ffffff',
                fontSize: '15px',
                resize: 'vertical',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => router.push('/home')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: '#ffffff',
                  border: '1px solid #2f3336',
                  borderRadius: '24px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: content.trim() ? '#1d9bf0' : '#1d9bf050',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '24px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: content.trim() ? 'pointer' : 'not-allowed',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? '發送中...' : '發文'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

