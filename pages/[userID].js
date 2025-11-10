import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

export default function UserProfile() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { userID } = router.query;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    bio: '',
    bannerImage: '',
    avatarImage: '',
  });
  const [saving, setSaving] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [savingPost, setSavingPost] = useState(false);
  const [relatedUserIDs, setRelatedUserIDs] = useState([userID]);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'replies' | 'highlights' | 'articles' | 'media' | 'likes'
  const [likedPosts, setLikedPosts] = useState([]);
  const [loadingLikedPosts, setLoadingLikedPosts] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [checkingFollow, setCheckingFollow] = useState(false);

  const isOwnProfile = session?.user?.userID === userID;

  useEffect(() => {
    if (userID) {
      console.log('Profile page - userID from router:', userID);
      fetchUserProfile();
      fetchUserPosts();
      if (isOwnProfile) {
        fetchLikedPosts();
        setCheckingFollow(false);
        setIsFollowing(false);
      } else {
        // 延迟检查关注状态，确保 session 已加载
        setCheckingFollow(true);
        setTimeout(() => {
          checkFollowStatus();
        }, 100);
      }
    }
  }, [userID]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 当切换到"喜歡的內容"标签时，如果是自己的资料，加载点赞的帖子
    if (activeTab === 'likes' && isOwnProfile && likedPosts.length === 0 && !loadingLikedPosts) {
      fetchLikedPosts();
    }
    
    // 如果查看他人页面，且切换到非 posts 或 replies 的标签，自动切换回 posts
    if (!isOwnProfile && activeTab !== 'posts' && activeTab !== 'replies') {
      setActiveTab('posts');
    }
  }, [activeTab, isOwnProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // 当 session 变化时，重新检查关注状态
  useEffect(() => {
    // 只有在 status 不是 loading 时才检查
    if (status === 'loading') {
      return;
    }
    
    if (userID && !isOwnProfile) {
      if (status === 'authenticated' && session) {
        console.log('Session changed, checking follow status...', { userID, isOwnProfile, hasSession: !!session, status });
        setCheckingFollow(true);
        checkFollowStatus();
      } else {
        // 如果没有登录，直接设置为 false
        console.log('No session or not authenticated, setting checkingFollow to false', { status, hasSession: !!session });
        setCheckingFollow(false);
        setIsFollowing(false);
      }
    }
  }, [status, session, userID, isOwnProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/${userID}`);
      const data = await response.json();
      if (data.success) {
        console.log('Profile page - user data:', {
          userID: data.user.userID,
          name: data.user.name,
          email: data.user.email,
          followers: data.user.followers,
          following: data.user.following,
        });
        setUser(data.user);
        setEditForm({
          name: data.user.name || '',
          bio: data.user.bio || '',
          bannerImage: data.user.bannerImage || '',
          avatarImage: data.user.image || '',
        });
      } else {
        console.error('Profile page - failed to fetch user:', data.message);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    if (!userID) return;
    
    try {
      // 获取所有帖子
      const response = await fetch('/api/posts');
      const data = await response.json();
      if (data.success) {
        // 只过滤出该用户的帖子（严格匹配 userID）
        const userPosts = data.posts.filter((post) => {
          const postAuthorUserID = post.author?.userID;
          
          // 如果没有 author.userID，跳过
          if (!postAuthorUserID) {
            return false;
          }
          
          // 严格匹配：只显示 author.userID 完全等于当前 userID 的帖子
          return String(postAuthorUserID).toLowerCase() === String(userID).toLowerCase();
        });
        
        setPosts(userPosts);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setEditPostContent(post.content);
  };

  const handleCancelEdit = () => {
    setEditingPost(null);
    setEditPostContent('');
  };

  const handleSaveEdit = async () => {
    if (!editPostContent.trim()) {
      alert('貼文內容不能為空');
      return;
    }

    setSavingPost(true);
    try {
      const response = await fetch(`/api/posts/${editingPost.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editPostContent }),
      });

      const data = await response.json();
      if (data.success) {
        // 更新帖子列表
        setPosts((prev) =>
          prev.map((post) =>
            post.id === editingPost.id
              ? { ...post, content: data.post.content }
              : post
          )
        );
        setEditingPost(null);
        setEditPostContent('');
      } else {
        alert(data.message || '更新失敗');
      }
    } catch (error) {
      console.error('Error updating post:', error);
      alert('更新失敗，請稍後再試');
    } finally {
      setSavingPost(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!confirm('確定要刪除此貼文嗎？')) {
      return;
    }

    try {
      const response = await fetch(`/api/posts/${postId}/delete`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        // 从列表中移除已删除的帖子
        setPosts((prev) => prev.filter((post) => post.id !== postId));
        // 刷新帖子列表
        fetchUserPosts();
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  const fetchLikedPosts = async () => {
    if (!isOwnProfile || !session?.user?.userID) return;
    
    setLoadingLikedPosts(true);
    try {
      const response = await fetch('/api/posts');
      const data = await response.json();
      if (data.success) {
        // 过滤出当前用户点赞的帖子
        const currentUserID = session.user.userID;
        const userLikedPosts = data.posts.filter((post) => {
          const likes = post.likes || [];
          return likes.some(like => String(like) === String(currentUserID));
        });
        setLikedPosts(userLikedPosts);
      }
    } catch (error) {
      console.error('Error fetching liked posts:', error);
    } finally {
      setLoadingLikedPosts(false);
    }
  };

  const checkFollowStatus = async () => {
    console.log('checkFollowStatus called:', { userID, isOwnProfile, hasSession: !!session, status });
    
    if (!userID) {
      console.log('No userID, setting checkingFollow to false');
      setCheckingFollow(false);
      return;
    }

    // 如果是自己的页面，不需要检查关注状态
    if (isOwnProfile) {
      console.log('Own profile, setting checkingFollow to false');
      setCheckingFollow(false);
      setIsFollowing(false);
      return;
    }

    // 如果状态是 loading，等待
    if (status === 'loading') {
      console.log('Status is loading, waiting...');
      return;
    }

    // 如果没有登录，也不显示关注按钮
    if (status !== 'authenticated' || !session) {
      console.log('No session or not authenticated, setting checkingFollow to false', { status, hasSession: !!session });
      setCheckingFollow(false);
      setIsFollowing(false);
      return;
    }

    console.log('Starting follow status check...');
    setCheckingFollow(true);
    try {
      const response = await fetch(`/api/users/${userID}/check-follow`);
      const data = await response.json();
      console.log('Follow status check response:', data);
      if (data.success) {
        setIsFollowing(data.following || false);
      } else {
        setIsFollowing(false);
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
      setIsFollowing(false);
    } finally {
      console.log('Follow status check completed, setting checkingFollow to false');
      setCheckingFollow(false);
    }
  };

  const handleFollow = async () => {
    if (!userID || !session) return;

    setLoadingFollow(true);
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/users/${userID}/follow`, {
        method,
      });

      const data = await response.json();
      if (data.success) {
        setIsFollowing(data.following);
        // 重新获取用户信息以更新 followers 数量
        await fetchUserProfile();
        // 如果当前页面是自己的个人首页，也需要更新自己的 following 数量
        // 因为 follow/unfollow 别人会影响自己的 following 数量
        if (isOwnProfile) {
          // 重新获取自己的用户信息
          const selfResponse = await fetch(`/api/users/${session.user.userID}`);
          const selfData = await selfResponse.json();
          if (selfData.success) {
            setUser(selfData.user);
          }
        }
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        const currentUserID = session?.user?.userID;
        
        // 更新帖子列表中的点赞状态
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id === postId) {
              let updatedLikes = [...(post.likes || [])];
              
              if (data.liked) {
                // 添加点赞 - 防止重复
                if (!updatedLikes.some(like => String(like) === String(currentUserID))) {
                  updatedLikes.push(currentUserID);
                }
              } else {
                // 移除点赞
                updatedLikes = updatedLikes.filter(
                  (id) => String(id) !== String(currentUserID)
                );
              }
              
              return {
                ...post,
                likes: updatedLikes,
              };
            }
            return post;
          })
        );

        // 更新点赞的帖子列表（如果是自己的资料）
        if (isOwnProfile) {
          if (data.liked) {
            // 添加点赞的帖子到列表
            const response = await fetch('/api/posts');
            const postsData = await response.json();
            if (postsData.success) {
              const likedPost = postsData.posts.find(p => p.id === postId);
              if (likedPost) {
                setLikedPosts((prev) => {
                  // 检查是否已存在
                  if (!prev.some(p => p.id === postId)) {
                    return [...prev, likedPost];
                  }
                  return prev;
                });
              }
            }
          } else {
            // 从点赞列表中移除
            setLikedPosts((prev) => prev.filter((post) => post.id !== postId));
          }
        }
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleSaveProfile = async () => {
    // 检查是否有 session 和 userID
    if (!session?.user?.userID) {
      console.error('No session or userID:', { session });
      alert('請先登入');
      return;
    }

    // 检查是否是自己的资料
    if (session.user.userID !== userID) {
      console.error('Permission check failed:', {
        sessionUserID: session.user.userID,
        requestUserID: userID,
      });
      alert('無權限更新此用戶資料');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${userID}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      // 检查响应状态
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '更新失敗');
      }

      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        setShowEditModal(false);
        // 刷新页面数据
        fetchUserProfile();
      } else {
        alert(data.message || '更新失敗');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(error.message || '更新失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading' || loading) {
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

  if (!user) {
    return (
      <Layout>
        <div className="page-content">
          <div className="content-placeholder">
            <p>用戶不存在</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-content">
        <div className="profile-page">
          {/* 顶部导航栏 */}
          <div className="profile-header">
            <Link href="/home" className="back-button">
              <svg viewBox="0 0 24 24" fill="#ffffff" width="20" height="20">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
              </svg>
            </Link>
            <div className="profile-header-info">
              <h2 className="profile-header-name">{user.name}</h2>
              <span className="profile-header-posts">{posts.length} posts</span>
            </div>
          </div>

          {/* 背景图 */}
          <div className="profile-banner">
            {user.bannerImage && user.bannerImage.trim() ? (
              <img 
                src={user.bannerImage} 
                alt="Banner" 
                className="profile-banner-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const placeholder = e.target.nextElementSibling;
                  if (placeholder) {
                    placeholder.style.display = 'block';
                  }
                }} 
              />
            ) : null}
            <div 
              className="profile-banner-placeholder" 
              style={{ 
                display: (user.bannerImage && user.bannerImage.trim()) ? 'none' : 'block',
              }} 
            />
            {isOwnProfile ? (
              <button
                className="edit-profile-button"
                onClick={() => setShowEditModal(true)}
              >
                Edit profile
              </button>
            ) : null}
          </div>

          {/* 操作按钮容器 - 移到 banner 外面 */}
          {!isOwnProfile && (
            <div className="profile-action-buttons">
              {/* 更多选项 */}
              <button
                type="button"
                className="profile-action-button"
                title="更多選項"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {/* 訊息 */}
              <Link href="/messages" className="profile-action-button" title="訊息">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </Link>
              {/* 跟隨/取消跟隨 */}
              {(() => {
                console.log('Follow button render check:', {
                  isOwnProfile,
                  status,
                  hasSession: !!session,
                  checkingFollow,
                  isFollowing,
                  userID,
                  sessionUserID: session?.user?.userID,
                });
                
                if (isOwnProfile) {
                  console.log('Own profile, not showing follow button');
                  return null;
                }
                
                if (status === 'authenticated' && session) {
                  if (checkingFollow) {
                    return (
                      <button
                        type="button"
                        className="follow-button"
                        disabled
                        style={{ opacity: 0.5, cursor: 'wait' }}
                      >
                        載入中...
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      className={`follow-button ${isFollowing ? 'following' : ''}`}
                      onClick={handleFollow}
                      disabled={loadingFollow}
                    >
                      {loadingFollow ? '處理中...' : isFollowing ? '正在跟隨' : '跟隨'}
                    </button>
                  );
                }
                
                if (status === 'unauthenticated') {
                  return (
                    <Link href="/auth/signin" className="follow-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
                      登入以跟隨
                    </Link>
                  );
                }
                
                // 如果 status 是 loading，不显示按钮
                return null;
              })()}
            </div>
          )}

          {/* 用户信息区域 */}
          <div className="profile-info">
            {/* 大头贴 */}
            <div className="profile-avatar-container">
              {user.image ? (
                <img src={user.image} alt={user.name} className="profile-avatar" />
              ) : (
                <div className="profile-avatar-placeholder">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* 用户基本信息 */}
            <div className="profile-details">
              <div className="profile-name-section">
                <h1 className="profile-name">{user.name}</h1>
              </div>
              <p className="profile-handle">@{user.userID}</p>
              
              {user.bio && (
                <p className="profile-bio">{user.bio}</p>
              )}

              <div className="profile-stats">
                <span className="profile-stat">
                  <strong>{user.following?.length || 0}</strong> Following
                </span>
                <span className="profile-stat">
                  <strong>{user.followers?.length || 0}</strong> Followers
                </span>
              </div>
            </div>

            {/* 标签页 */}
            <div className="profile-tabs">
              <button 
                className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                貼文
              </button>
              <button 
                className={`profile-tab ${activeTab === 'replies' ? 'active' : ''}`}
                onClick={() => setActiveTab('replies')}
              >
                回覆
              </button>
              {/* 只有自己的页面才显示其他标签 */}
              {isOwnProfile && (
                <>
                  <button 
                    className={`profile-tab ${activeTab === 'highlights' ? 'active' : ''}`}
                    onClick={() => setActiveTab('highlights')}
                  >
                    精選內容
                  </button>
                  <button 
                    className={`profile-tab ${activeTab === 'articles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('articles')}
                  >
                    文章
                  </button>
                  <button 
                    className={`profile-tab ${activeTab === 'media' ? 'active' : ''}`}
                    onClick={() => setActiveTab('media')}
                  >
                    媒體
                  </button>
                  <button 
                    className={`profile-tab ${activeTab === 'likes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('likes')}
                  >
                    喜歡的內容
                  </button>
                </>
              )}
            </div>

            {/* 内容区域 */}
            <div className="profile-posts">
              {activeTab === 'posts' && (
                <>
                  {posts.length === 0 ? (
                    <div className="empty-posts">
                      <p>尚無貼文</p>
                    </div>
                  ) : (
                    posts.map((post) => (
                      <div key={post.id} className="profile-post-item">
                    {editingPost?.id === post.id ? (
                      // 编辑模式
                      <div>
                        <textarea
                          value={editPostContent}
                          onChange={(e) => setEditPostContent(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '100px',
                            padding: '12px',
                            backgroundColor: '#000000',
                            border: '1px solid #2f3336',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontSize: '15px',
                            resize: 'vertical',
                            marginBottom: '12px',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleCancelEdit}
                            style={{
                              padding: '8px 16px',
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
                            onClick={handleSaveEdit}
                            disabled={savingPost || !editPostContent.trim()}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: editPostContent.trim() ? '#1d9bf0' : '#1d9bf050',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '24px',
                              fontSize: '15px',
                              fontWeight: '700',
                              cursor: editPostContent.trim() ? 'pointer' : 'not-allowed',
                              opacity: savingPost ? 0.6 : 1,
                            }}
                          >
                            {savingPost ? '儲存中...' : '儲存'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // 显示模式
                      <div
                        style={{
                          display: 'flex',
                          gap: '12px',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#080808'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* 用户头像 */}
                        <div style={{ flexShrink: 0 }}>
                          {post.author?.image ? (
                            <img
                              src={post.author.image}
                              alt={post.author.name}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: '#1d9bf0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: '18px',
                                fontWeight: '700',
                              }}
                            >
                              {post.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                          )}
                        </div>

                        {/* 帖子内容 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 用户信息和时间戳 */}
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginRight: '4px' }}>
                              {post.author?.name || 'Unknown'}
                            </strong>
                            <span style={{ color: '#71767b', fontSize: '15px', marginRight: '4px' }}>
                              @{post.author?.userID || 'unknown'}
                            </span>
                            {post.createdAt && (
                              <>
                                <span style={{ color: '#71767b', fontSize: '15px', margin: '0 4px' }}>·</span>
                                <span style={{ color: '#71767b', fontSize: '15px' }}>
                                  {new Date(post.createdAt).toLocaleDateString('zh-TW', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </>
                            )}
                            {/* 更多选项（右上角） */}
                            <div style={{ marginLeft: 'auto' }}>
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#71767b',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#1d9bf0';
                                  e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = '#71767b';
                                }}
                                title="更多選項"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* 帖子内容 */}
                          <p
                            style={{
                              fontSize: '15px',
                              color: '#ffffff',
                              marginBottom: '12px',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {post.content}
                          </p>

                          {/* 交互按钮 */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              maxWidth: '425px',
                              marginTop: '12px',
                            }}
                          >
                            {/* 评论 */}
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#71767b',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#1d9bf0';
                                e.currentTarget.style.backgroundColor = '#1d9bf010';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#71767b';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="回覆"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            </button>

                            {/* 转发 */}
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#71767b',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#00ba7c';
                                e.currentTarget.style.backgroundColor = '#00ba7c10';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#71767b';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="轉推"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 1l4 4-4 4" />
                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <path d="M7 23l-4-4 4-4" />
                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                              </svg>
                            </button>

                            {/* 点赞 */}
                            <button
                              onClick={() => handleLike(post.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: (post.likes || []).includes(session?.user?.userID)
                                  ? '#f4212e'
                                  : '#71767b',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                if (!(post.likes || []).includes(session?.user?.userID)) {
                                  e.currentTarget.style.color = '#f4212e';
                                  e.currentTarget.style.backgroundColor = '#f4212e10';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!(post.likes || []).includes(session?.user?.userID)) {
                                  e.currentTarget.style.color = '#71767b';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              title="喜歡"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill={(post.likes || []).includes(session?.user?.userID) ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                              {(post.likes || []).length > 0 && (
                                <span style={{ fontSize: '13px' }}>{(post.likes || []).length}</span>
                              )}
                            </button>

                            {/* 分析 */}
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#71767b',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#1d9bf0';
                                e.currentTarget.style.backgroundColor = '#1d9bf010';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#71767b';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="查看分析"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                              </svg>
                            </button>

                            {/* 收藏 */}
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#71767b',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#1d9bf0';
                                e.currentTarget.style.backgroundColor = '#1d9bf010';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#71767b';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="書籤"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                              </svg>
                            </button>

                            {/* 分享 */}
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#71767b',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#1d9bf0';
                                e.currentTarget.style.backgroundColor = '#1d9bf010';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#71767b';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="分享"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                              </svg>
                            </button>

                            {/* 编辑和删除按钮（只有作者可见） */}
                            {post.author?.userID && 
                             session?.user?.userID &&
                             String(post.author.userID).toLowerCase() === String(session.user.userID).toLowerCase() && (
                              <>
                                <button
                                  onClick={() => handleEdit(post)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#71767b',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'color 0.2s',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#1d9bf0';
                                    e.currentTarget.style.backgroundColor = '#1d9bf010';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#71767b';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                  title="編輯"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDelete(post.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#71767b',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'color 0.2s',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#f4212e';
                                    e.currentTarget.style.backgroundColor = '#f4212e10';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#71767b';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                  title="刪除"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'replies' && (
                <div className="empty-posts">
                  <p>尚無回覆</p>
                </div>
              )}

              {activeTab === 'highlights' && (
                <div className="empty-posts">
                  <p>尚無精選內容</p>
                </div>
              )}

              {activeTab === 'articles' && (
                <div className="empty-posts">
                  <p>尚無文章</p>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="empty-posts">
                  <p>尚無媒體</p>
                </div>
              )}

              {activeTab === 'likes' && (
                <>
                  {!isOwnProfile ? (
                    <div className="empty-posts">
                      <p>只能查看自己的喜歡內容</p>
                    </div>
                  ) : loadingLikedPosts ? (
                    <div className="empty-posts">
                      <p>載入中...</p>
                    </div>
                  ) : likedPosts.length === 0 ? (
                    <div className="empty-posts">
                      <p>尚無喜歡的內容</p>
                    </div>
                  ) : (
                    likedPosts.map((post) => (
                      <div key={post.id} className="profile-post-item">
                        <div
                          style={{
                            display: 'flex',
                            gap: '12px',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#080808'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {/* 用户头像 */}
                          <div style={{ flexShrink: 0 }}>
                            {post.author?.image ? (
                              <img
                                src={post.author.image}
                                alt={post.author.name}
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  backgroundColor: '#1d9bf0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontSize: '18px',
                                  fontWeight: '700',
                                }}
                              >
                                {post.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                            )}
                          </div>

                          {/* 帖子内容 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* 用户信息和时间戳 */}
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginRight: '4px' }}>
                                {post.author?.name || 'Unknown'}
                              </strong>
                              <span style={{ color: '#71767b', fontSize: '15px', marginRight: '4px' }}>
                                @{post.author?.userID || 'unknown'}
                              </span>
                              {post.createdAt && (
                                <>
                                  <span style={{ color: '#71767b', fontSize: '15px', margin: '0 4px' }}>·</span>
                                  <span style={{ color: '#71767b', fontSize: '15px' }}>
                                    {new Date(post.createdAt).toLocaleDateString('zh-TW', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* 帖子内容 */}
                            <p
                              style={{
                                fontSize: '15px',
                                color: '#ffffff',
                                marginBottom: '12px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                              }}
                            >
                              {post.content}
                            </p>

                            {/* 交互按钮 */}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                maxWidth: '425px',
                                marginTop: '12px',
                              }}
                            >
                              {/* 评论 */}
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#71767b',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#1d9bf0';
                                  e.currentTarget.style.backgroundColor = '#1d9bf010';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#71767b';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="回覆"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                              </button>

                              {/* 转发 */}
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#71767b',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#00ba7c';
                                  e.currentTarget.style.backgroundColor = '#00ba7c10';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#71767b';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="轉推"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M17 1l4 4-4 4" />
                                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                  <path d="M7 23l-4-4 4-4" />
                                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                </svg>
                              </button>

                              {/* 点赞 */}
                              <button
                                onClick={() => handleLike(post.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: (post.likes || []).includes(session?.user?.userID)
                                    ? '#f4212e'
                                    : '#71767b',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  if (!(post.likes || []).includes(session?.user?.userID)) {
                                    e.currentTarget.style.color = '#f4212e';
                                    e.currentTarget.style.backgroundColor = '#f4212e10';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!(post.likes || []).includes(session?.user?.userID)) {
                                    e.currentTarget.style.color = '#71767b';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }
                                }}
                                title="喜歡"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill={(post.likes || []).includes(session?.user?.userID) ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                                {(post.likes || []).length > 0 && (
                                  <span style={{ fontSize: '13px' }}>{(post.likes || []).length}</span>
                                )}
                              </button>

                              {/* 分析 */}
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#71767b',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#1d9bf0';
                                  e.currentTarget.style.backgroundColor = '#1d9bf010';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#71767b';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="查看分析"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <line x1="18" y1="20" x2="18" y2="10" />
                                  <line x1="12" y1="20" x2="12" y2="4" />
                                  <line x1="6" y1="20" x2="6" y2="14" />
                                </svg>
                              </button>

                              {/* 收藏 */}
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#71767b',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#1d9bf0';
                                  e.currentTarget.style.backgroundColor = '#1d9bf010';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#71767b';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="書籤"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                </svg>
                              </button>

                              {/* 分享 */}
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#71767b',
                                  cursor: 'pointer',
                                  padding: '8px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = '#1d9bf0';
                                  e.currentTarget.style.backgroundColor = '#1d9bf010';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = '#71767b';
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="分享"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                  <polyline points="16 6 12 2 8 6" />
                                  <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 编辑个人资料模态窗口 */}
        {showEditModal && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <button
                  className="modal-close"
                  onClick={() => setShowEditModal(false)}
                >
                  ✕
                </button>
                <h2 className="modal-title">編輯個人資料</h2>
                <button
                  className="modal-save"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? '儲存中...' : '儲存'}
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>姓名</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="輸入您的姓名"
                  />
                </div>

                <div className="form-group">
                  <label>簡介</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="輸入您的簡介"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>背景圖 URL</label>
                  <input
                    type="text"
                    value={editForm.bannerImage}
                    onChange={(e) => setEditForm({ ...editForm, bannerImage: e.target.value })}
                    placeholder="輸入背景圖 URL"
                  />
                </div>

                <div className="form-group">
                  <label>大頭貼 URL</label>
                  <input
                    type="text"
                    value={editForm.avatarImage}
                    onChange={(e) => setEditForm({ ...editForm, avatarImage: e.target.value })}
                    placeholder="輸入大頭貼 URL"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .profile-page {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          border-left: 1px solid #2f3336;
          border-right: 1px solid #2f3336;
          min-height: 100vh;
          position: relative;
        }

        .profile-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #2f3336;
          position: sticky;
          top: 0;
          background-color: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(12px);
          z-index: 10;
        }

        .back-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: #ffffff;
          text-decoration: none;
          margin-right: 20px;
          margin-left: -8px;
          transition: background-color 0.2s;
        }

        .back-button:hover {
          background-color: #181818;
        }

        .profile-header-info {
          display: flex;
          flex-direction: column;
          margin-left: 8px;
        }

        .profile-header-name {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .profile-header-posts {
          font-size: 13px;
          color: #71767b;
        }

        .profile-banner {
          width: 100%;
          height: 200px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .profile-banner img,
        .profile-banner-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          z-index: 1;
        }

        .profile-banner-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: absolute;
          top: 0;
          left: 0;
          z-index: 0;
        }

        .edit-profile-button {
          position: absolute;
          bottom: 16px;
          right: 16px;
          padding: 8px 16px;
          background-color: #000000;
          color: #ffffff;
          border: 1px solid #2f3336;
          border-radius: 24px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s;
          z-index: 100;
          pointer-events: auto;
        }

        .edit-profile-button:hover {
          background-color: #181818;
        }

        .profile-action-buttons {
          position: absolute;
          top: 290px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 100;
        }

        .profile-action-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background-color: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          cursor: pointer;
          transition: background-color 0.2s;
          text-decoration: none;
        }

        .profile-action-button:hover {
          background-color: rgba(0, 0, 0, 0.8);
        }

        .follow-button {
          padding: 8px 24px;
          border-radius: 24px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s;
          border: 1px solid #2f3336;
          background-color: #000000;
          color: #ffffff;
          white-space: nowrap;
          display: inline-block;
        }

        .follow-button:hover:not(:disabled) {
          background-color: #181818;
        }

        .follow-button.following {
          background-color: #000000;
          color: #ffffff;
          border-color: #2f3336;
        }

        .follow-button.following:hover:not(:disabled) {
          background-color: #181818;
        }

        .follow-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .profile-info {
          padding: 0 16px;
        }

        .profile-avatar-container {
          margin-top: -60px;
          margin-bottom: 12px;
          display: flex;
          justify-content: flex-start;
          padding-left: 16px;
          position: relative;
          z-index: 1;
        }

        .profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid #000000;
          object-fit: cover;
        }

        .profile-avatar-placeholder {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid #000000;
          background-color: #1d9bf0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: 700;
          color: #ffffff;
        }

        .profile-details {
          margin-bottom: 16px;
        }

        .profile-name-section {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
        }

        .profile-name {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .profile-handle {
          font-size: 15px;
          color: #71767b;
          margin: 0 0 12px 0;
        }

        .profile-bio {
          font-size: 15px;
          color: #ffffff;
          margin: 0 0 12px 0;
          white-space: pre-wrap;
        }

        .profile-stats {
          display: flex;
          gap: 20px;
          margin-top: 12px;
        }

        .profile-stat {
          font-size: 15px;
          color: #71767b;
        }

        .profile-stat strong {
          color: #ffffff;
          font-weight: 700;
        }

        .profile-tabs {
          display: flex;
          border-bottom: 1px solid #2f3336;
          margin-bottom: 0;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .profile-tabs::-webkit-scrollbar {
          display: none;
        }

        .profile-tab {
          flex: 1;
          min-width: fit-content;
          padding: 16px;
          background: none;
          border: none;
          color: #71767b;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: color 0.2s, background-color 0.2s;
          white-space: nowrap;
        }

        .profile-tab.active {
          color: #ffffff;
          border-bottom-color: #1d9bf0;
        }

        .profile-tab:hover {
          background-color: #181818;
          color: #ffffff;
        }

        .profile-posts {
          min-height: 200px;
        }

        .empty-posts {
          padding: 40px 16px;
          text-align: center;
          color: #71767b;
        }

        .profile-post-item {
          padding: 16px;
          border-bottom: 1px solid #2f3336;
        }

        .post-content {
          font-size: 15px;
          color: #ffffff;
          margin: 0 0 12px 0;
          white-space: pre-wrap;
        }

        .post-actions {
          display: flex;
          gap: 24px;
        }

        .post-likes {
          color: #71767b;
          font-size: 13px;
        }

        /* 模态窗口样式 */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: #000000;
          border-radius: 16px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          border: 1px solid #2f3336;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #2f3336;
        }

        .modal-close {
          background: none;
          border: none;
          color: #ffffff;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .modal-close:hover {
          background-color: #181818;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          flex: 1;
          text-align: center;
        }

        .modal-save {
          padding: 8px 16px;
          background-color: #ffffff;
          color: #000000;
          border: none;
          border-radius: 24px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .modal-save:hover:not(:disabled) {
          opacity: 0.9;
        }

        .modal-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .modal-body {
          padding: 16px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 12px;
          background-color: #000000;
          border: 1px solid #2f3336;
          border-radius: 4px;
          color: #ffffff;
          font-size: 15px;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #1d9bf0;
        }

        .form-group textarea {
          resize: vertical;
        }
      `}</style>
    </Layout>
  );
}

