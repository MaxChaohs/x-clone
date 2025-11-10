import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import Link from 'next/link';
import PostModal from '@/components/PostModal';

export default function Layout({ children }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  const handleDeleteAccount = async () => {
    if (!confirm('確定要刪除您的帳號嗎？此操作將永久刪除：\n\n- 您的所有貼文\n- 您的所有消息\n- 您的帳號資料\n\n此操作不可恢復！')) {
      return;
    }

    if (!confirm('再次確認：您真的要刪除帳號嗎？\n\n這將永久刪除您的所有數據，無法恢復！')) {
      return;
    }

    try {
      const response = await fetch('/api/users/delete-account', {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        alert(`帳號已成功刪除！\n\n已刪除：\n- ${data.deletedCount.user} 個帳號\n- ${data.deletedCount.posts} 篇貼文\n- ${data.deletedCount.messages} 條消息`);
        // 登出並跳轉到登入頁面
        window.location.href = '/auth/signin';
      } else {
        alert(data.message || '刪除帳號失敗');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('刪除帳號失敗，請稍後再試');
    }
  };

  const navItems = [
    { href: '/home', label: 'Home', icon: 'home' },
    { href: '/messages', label: 'Messages', icon: 'messages' },
    { href: session?.user?.userID ? `/${session.user.userID}` : '/profile', label: 'Profile', icon: 'profile' },
  ];

  return (
    <div className="container">
      <aside className="sidebar">
        <div className="logo-container">
          <Link href="/home" className="logo">VAS</Link>
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${router.pathname === item.href ? 'active' : ''}`}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {item.icon === 'home' && (
                  <>
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </>
                )}
                {item.icon === 'messages' && (
                  <>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </>
                )}
                {item.icon === 'profile' && (
                  <>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </>
                )}
              </svg>
              <span className="nav-text">{item.label}</span>
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setShowPostModal(true)}
            className="nav-item post-button"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            <span className="post-text">Post</span>
          </button>
        </nav>

        {session && (
          <div className="user-section">
            <div className="user-info" onClick={() => setShowLogout(!showLogout)}>
              <div className="user-avatar">
                <img
                  src={session.user.image || 'https://via.placeholder.com/40'}
                  alt={session.user.name}
                />
              </div>
              <div className="user-details">
                <div className="user-name">{session.user.name}</div>
                <div className="user-handle">@{session.user.userID}</div>
              </div>
              <svg className="more-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </div>

            {showLogout && (
              <div className="logout-popup show">
                <button className="logout-button" onClick={handleLogout}>
                  登出
                </button>
                <button 
                  className="logout-button delete-account-button" 
                  onClick={handleDeleteAccount}
                  style={{
                    color: '#f4212e',
                    borderTop: '1px solid #2f3336',
                  }}
                >
                  刪除帳號
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <main className="main-content">{children}</main>

      {/* Post Modal */}
      <PostModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
        onPostSuccess={() => {
          setShowPostModal(false);
          // 可以在这里触发页面刷新或其他操作
          if (router.pathname === '/home') {
            router.reload();
          }
        }}
      />
    </div>
  );
}

