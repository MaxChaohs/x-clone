import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Pusher from 'pusher-js';

// 相对时间显示函数
const getRelativeTime = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const postDate = new Date(date);
  const diffInSeconds = Math.floor((now - postDate) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}秒前`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分鐘前`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}小時前`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}天前`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return postDate.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
  }
  
  return postDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
};

// 格式化帖子内容，识别链接、hashtag 和 mention
const formatPostContent = (text) => {
  if (!text) return [];

  const parts = [];
  let lastIndex = 0;

  // 同时识别链接和 @mention
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const mentionRegex = /@(\w+)/g;
  
  const matches = [];
  
  // 收集所有链接
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'link',
      content: match[0],
    });
  }
  
  // 收集所有 mention
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      type: 'mention',
      content: match[0],
      userID: match[1], // @ 后面的用户名
    });
  }
  
  // 按位置排序
  matches.sort((a, b) => a.index - b.index);
  
  // 处理重叠（如果 mention 和链接重叠，优先处理链接）
  const processedMatches = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    let overlap = false;
    
    for (let j = 0; j < processedMatches.length; j++) {
      const prev = processedMatches[j];
      // 检查是否重叠
      if (
        (current.index >= prev.index && current.index < prev.index + prev.length) ||
        (current.index + current.length > prev.index && current.index + current.length <= prev.index + prev.length) ||
        (current.index <= prev.index && current.index + current.length >= prev.index + prev.length)
      ) {
        overlap = true;
        break;
      }
    }
    
    if (!overlap) {
      processedMatches.push(current);
    }
  }
  
  // 按位置重新排序
  processedMatches.sort((a, b) => a.index - b.index);
  
  // 构建 parts
  for (const match of processedMatches) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }
    
    // 添加匹配的内容
    if (match.type === 'link') {
      let url = match.content;
      if (url.startsWith('www.')) {
        url = 'http://' + url;
      }
      parts.push({
        type: 'link',
        content: match.content,
        url: url,
      });
    } else if (match.type === 'mention') {
      parts.push({
        type: 'mention',
        content: match.content,
        userID: match.userID,
      });
    }
    
    lastIndex = match.index + match.length;
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' or 'following'
  const [showDeleteMenu, setShowDeleteMenu] = useState(null); // 存储要显示删除菜单的帖子ID
  const [expandedComments, setExpandedComments] = useState({}); // 存储展开留言的帖子ID
  const [commentInputs, setCommentInputs] = useState({}); // 存储每个帖子的留言输入
  const [submittingComments, setSubmittingComments] = useState({}); // 存储正在提交留言的帖子ID
  const [inlinePostExpanded, setInlinePostExpanded] = useState(false); // inline 发帖是否展开
  const [inlinePostContent, setInlinePostContent] = useState(''); // inline 发帖内容
  const [submittingPost, setSubmittingPost] = useState(false); // 是否正在提交帖子
  const [newPostNotices, setNewPostNotices] = useState([]); // 存储新帖通知（最多3个）
  const [followingList, setFollowingList] = useState([]); // 存储当前用户 follow 的用户列表

  // 点击外部关闭菜单
  useEffect(() => {
    if (!showDeleteMenu) return;

    const handleClickOutside = (event) => {
      // 检查点击是否在菜单容器外部
      const menuContainer = event.target.closest('[data-menu-container]');
      if (!menuContainer) {
        setShowDeleteMenu(null);
      }
    };

    // 延迟添加事件监听器，确保点击事件先执行
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeleteMenu]);

  const fetchPosts = async () => {
    try {
      const filter = activeFilter === 'following' ? 'following' : 'all';
      const response = await fetch(`/api/posts?filter=${filter}`);
      const data = await response.json();
      if (data.success) {
        // 确保按创建时间从新到旧排序
        const sortedPosts = data.posts.sort((a, b) => {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          return dateB - dateA; // 从新到旧
        });
        setPosts(sortedPosts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取当前用户的 following 列表
  const fetchFollowingList = async () => {
    if (!session?.user?.userID) return;
    
    try {
      const response = await fetch(`/api/users/${session.user.userID}`);
      const data = await response.json();
      if (data.success && data.user) {
        setFollowingList(data.user.following || []);
      }
    } catch (error) {
      console.error('Error fetching following list:', error);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchFollowingList();
  }, [activeFilter, session?.user?.userID]);

  useEffect(() => {
    // 初始化 Pusher（只有在配置了 Pusher 時才初始化）
    let pusher = null;
    if (process.env.NEXT_PUBLIC_PUSHER_KEY) {
      try {
        pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
        });

        // 訂閱新貼文頻道
        const channel = pusher.subscribe('posts');
        
        // 监听新帖
        channel.bind('new-post', (data) => {
          // 检查是否来自 follow 的用户
          const isFromFollowing = followingList.includes(data.author?.userID);
          
          // 如果是 follow 的用户发的新帖，显示 New post notice
          if (isFromFollowing && data.author) {
            setNewPostNotices((prev) => {
              // 检查是否已经存在（避免重复）
              if (prev.some(notice => notice.postId === data.id)) {
                return prev;
              }
              
              // 最多显示3个
              const newNotices = [
                {
                  postId: data.id,
                  author: {
                    userID: data.author.userID,
                    name: data.author.name,
                    image: data.author.image,
                  },
                },
                ...prev,
              ].slice(0, 3);
              
              return newNotices;
            });
          }
          
          // 如果当前是 "all" 模式，直接添加
          // 如果是 "following" 模式，需要检查是否 follow 了作者
          setPosts((prev) => {
            // 检查是否已存在（避免重复）
            if (prev.some(p => p.id === data.id)) {
              return prev;
            }
            
            // 如果当前是 "all" 模式，直接添加
            if (activeFilter === 'all') {
              const newPosts = [data, ...prev];
              // 确保按创建时间从新到旧排序
              return newPosts.sort((a, b) => {
                const dateA = new Date(a.createdAt);
                const dateB = new Date(b.createdAt);
                return dateB - dateA;
              });
            } else {
              // Following 模式：需要重新获取，因为需要检查 follow 状态
              fetchPosts();
              return prev;
            }
          });
        });
        
        // 监听点赞更新
        channel.bind('update-like', (data) => {
          setPosts((prev) =>
            prev.map((post) => {
              if (post.id === data.postId) {
                const currentUserID = session?.user?.userID;
                let updatedLikes = [...(post.likes || [])];
                
                if (data.liked) {
                  // 添加点赞
                  if (!updatedLikes.some(like => String(like) === String(data.userID))) {
                    updatedLikes.push(data.userID);
                  }
                } else {
                  // 移除点赞
                  updatedLikes = updatedLikes.filter(
                    (id) => String(id) !== String(data.userID)
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
        });
        
        // 监听新评论
        channel.bind('new-comment', (data) => {
          setPosts((prev) =>
            prev.map((post) => {
              if (post.id === data.postId) {
                const updatedComments = [...(post.comments || []), data.comment];
                return {
                  ...post,
                  comments: updatedComments,
                };
              }
              return post;
            })
          );
        });
        
        channel.bind('delete-post', (data) => {
          setPosts((prev) => prev.filter((post) => post.id !== data.postId));
        });
      } catch (error) {
        console.warn('Pusher 初始化失敗:', error);
      }
    }

    return () => {
      if (pusher) {
        pusher.unsubscribe('posts');
        pusher.disconnect();
      }
    };
  }, [activeFilter, followingList, session?.user?.userID]);

  // 字符计数逻辑（用于 inline 发帖）
  const calculateCharCount = (text) => {
    if (!text) return 0;

    // 提取链接（每个链接占23字符）
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const urls = text.match(urlRegex) || [];
    
    // 先移除链接
    let textWithoutUrls = text;
    urls.forEach(url => {
      textWithoutUrls = textWithoutUrls.replace(url, '');
    });
    
    // 提取 hashtag 和 mention（不计入字符数）
    const hashtagRegex = /#\w+/g;
    const mentionRegex = /@\w+/g;
    
    // 移除 hashtag 和 mention
    let textWithoutSpecial = textWithoutUrls
      .replace(hashtagRegex, '')
      .replace(mentionRegex, '');
    
    // 计算剩余文本的字符数
    const textChars = textWithoutSpecial.trim().length;
    
    // 每个链接占23字符
    const urlChars = urls.length * 23;
    
    return textChars + urlChars;
  };

  // 提交 inline 发帖
  const handleInlinePostSubmit = async (e) => {
    e.preventDefault();
    const MAX_CHARS = 280;
    const charCount = calculateCharCount(inlinePostContent);
    
    if (!inlinePostContent.trim() || charCount > MAX_CHARS) {
      return;
    }

    setSubmittingPost(true);
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inlinePostContent }),
      });

      const data = await response.json();
      if (data.success) {
        setInlinePostContent('');
        setInlinePostExpanded(false);
        // 刷新帖子列表
        fetchPosts();
      } else {
        alert(data.message || '發文失敗');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('發文失敗，請稍後再試');
    } finally {
      setSubmittingPost(false);
    }
  };

  // 转发功能
  const handleRepost = async (postId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/repost`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        // 更新本地狀態，而不是重新獲取所有貼文
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id === postId) {
              return {
                ...post,
                isReposted: data.reposted,
                repostCount: data.reposted
                  ? (post.repostCount || 0) + 1
                  : Math.max(0, (post.repostCount || 0) - 1),
              };
            }
            return post;
          })
        );
      } else {
        alert(data.message || '轉發失敗');
      }
    } catch (error) {
      console.error('Error reposting:', error);
      alert('轉發失敗，請稍後再試');
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        // 使用服务器返回的点赞数，而不是本地计算
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id === postId) {
              const currentUserID = session?.user?.userID;
              let updatedLikes = [...(post.likes || [])];
              
              if (data.liked) {
                // 添加点赞 - 使用 $addToSet 逻辑，防止重复
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
      }
    } catch (error) {
      console.error('Error liking post:', error);
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
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('刪除失敗，請稍後再試');
    }
  };

  // 刪除帳號功能
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

  const handleToggleComments = (postId) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleCommentSubmit = async (e, postId) => {
    e.preventDefault();
    const commentContent = commentInputs[postId]?.trim();
    if (!commentContent) return;

    setSubmittingComments((prev) => ({ ...prev, [postId]: true }));

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentContent }),
      });

      const data = await response.json();
      if (data.success) {
        // 更新帖子中的留言列表
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, comments: data.comments }
              : post
          )
        );
        // 清空输入框
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
        // 展开留言区域
        setExpandedComments((prev) => ({ ...prev, [postId]: true }));
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="content-placeholder">
        <p>載入中...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="content-placeholder">
        <h1>Home</h1>

        {/* New Post Notice */}
        {newPostNotices.length > 0 && (
          <div
            style={{
              backgroundColor: '#1d9bf0',
              padding: '12px 16px',
              marginBottom: '16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onClick={() => {
              // 点击后清除通知并刷新帖子列表
              setNewPostNotices([]);
              fetchPosts();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {/* 向上箭头图标 */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: '#ffffff', flexShrink: 0 }}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            
            {/* 前三个人的 avatars */}
            <div style={{ display: 'flex', gap: '-4px', marginRight: '8px' }}>
              {newPostNotices.slice(0, 3).map((notice, index) => (
                <div
                  key={notice.postId}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid #1d9bf0',
                    marginLeft: index > 0 ? '-4px' : '0',
                    overflow: 'hidden',
                    backgroundColor: '#1d9bf0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3 - index,
                  }}
                >
                  {notice.author?.image ? (
                    <img
                      src={notice.author.image}
                      alt={notice.author.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: '700',
                      }}
                    >
                      {notice.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {/* "posted" 文字 */}
            <span style={{ color: '#ffffff', fontSize: '15px', fontWeight: '400' }}>
              posted
            </span>
          </div>
        )}

        {/* All/Following 切换 */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #2f3336',
            marginBottom: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setLoading(true);
            }}
            style={{
              flex: 1,
              padding: '16px',
              background: 'none',
              border: 'none',
              color: activeFilter === 'all' ? '#ffffff' : '#71767b',
              fontSize: '15px',
              fontWeight: activeFilter === 'all' ? '700' : '400',
              cursor: 'pointer',
              borderBottom: activeFilter === 'all' ? '2px solid #1d9bf0' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'all') {
                e.currentTarget.style.backgroundColor = '#181818';
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'all') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('following');
              setLoading(true);
            }}
            style={{
              flex: 1,
              padding: '16px',
              background: 'none',
              border: 'none',
              color: activeFilter === 'following' ? '#ffffff' : '#71767b',
              fontSize: '15px',
              fontWeight: activeFilter === 'following' ? '700' : '400',
              cursor: 'pointer',
              borderBottom: activeFilter === 'following' ? '2px solid #1d9bf0' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'following') {
                e.currentTarget.style.backgroundColor = '#181818';
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'following') {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            Following
          </button>
        </div>

        {/* Inline 发帖组件 */}
        {session && (
          <div
            style={{
              borderBottom: '1px solid #2f3336',
              padding: '12px 16px',
            }}
          >
            {!inlinePostExpanded ? (
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                {/* 用户头像 */}
                <div style={{ flexShrink: 0 }}>
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name}
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
                      {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>

                {/* 输入框 */}
                <div
                  style={{
                    flex: 1,
                    cursor: 'text',
                  }}
                  onClick={() => setInlinePostExpanded(true)}
                >
                  <input
                    type="text"
                    placeholder="What's happening?"
                    readOnly
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#000000',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#71767b',
                      fontSize: '20px',
                      outline: 'none',
                      fontFamily: 'inherit',
                      cursor: 'text',
                    }}
                  />
                </div>
              </div>
            ) : (
              <form onSubmit={handleInlinePostSubmit}>
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* 用户头像 */}
                  <div style={{ flexShrink: 0 }}>
                    {session?.user?.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name}
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
                        {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>

                  {/* 输入区域 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* 受众选择 */}
                    <div style={{ marginBottom: '12px' }}>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: '1px solid #2f3336',
                          color: '#1d9bf0',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: '400',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Everyone
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    {/* 文本输入 */}
                    <textarea
                      value={inlinePostContent}
                      onChange={(e) => {
                        const newContent = e.target.value;
                        const newCharCount = calculateCharCount(newContent);
                        const MAX_CHARS = 280;
                        if (newCharCount <= MAX_CHARS) {
                          setInlinePostContent(newContent);
                        }
                      }}
                      placeholder="What's happening?"
                      style={{
                        width: '100%',
                        minHeight: '200px',
                        padding: '12px',
                        backgroundColor: '#000000',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontSize: '20px',
                        resize: 'none',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                      autoFocus
                    />

                    {/* 回复设置 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '12px',
                        color: '#1d9bf0',
                        fontSize: '13px',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="16" y1="12" x2="12" y2="12" />
                      </svg>
                      <span>Everyone can reply</span>
                    </div>
                  </div>
                </div>

                {/* 底部栏 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid #2f3336',
                  }}
                >
                  {/* 附件按钮（暂时隐藏） */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* 可以在这里添加附件按钮 */}
                  </div>

                  {/* 字符计数和发布按钮 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        color: calculateCharCount(inlinePostContent) > 280 ? '#f4212e' : '#71767b',
                      }}
                    >
                      {calculateCharCount(inlinePostContent)}/280
                    </span>
                    <button
                      type="submit"
                      disabled={!inlinePostContent.trim() || calculateCharCount(inlinePostContent) > 280 || submittingPost}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: (inlinePostContent.trim() && calculateCharCount(inlinePostContent) <= 280) ? '#1d9bf0' : '#1d9bf050',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '20px',
                        fontSize: '15px',
                        fontWeight: '700',
                        cursor: (inlinePostContent.trim() && calculateCharCount(inlinePostContent) <= 280) ? 'pointer' : 'not-allowed',
                        opacity: submittingPost ? 0.6 : 1,
                      }}
                    >
                      {submittingPost ? '發送中...' : 'Post'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        <div>
          {posts.map((post) => (
            <div
              key={post.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #2f3336',
                display: 'flex',
                gap: '12px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#080808'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {/* 用户头像 */}
              {post.author?.userID ? (
                <Link href={`/${post.author.userID}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                  {post.author?.image ? (
                    <img
                      src={post.author.image}
                      alt={post.author.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer',
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
                        cursor: 'pointer',
                      }}
                    >
                      {post.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </Link>
              ) : (
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
              )}

              {/* 帖子内容 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 用户信息和时间戳 */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  {post.author?.userID ? (
                    <Link href={`/${post.author.userID}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                      <strong style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginRight: '4px', cursor: 'pointer' }}>
                        {post.author?.name || 'Unknown'}
                      </strong>
                      <span style={{ color: '#71767b', fontSize: '15px', marginRight: '4px', cursor: 'pointer' }}>
                        @{post.author.userID}
                      </span>
                    </Link>
                  ) : (
                    <>
                      <strong style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginRight: '4px' }}>
                        {post.author?.name || 'Unknown'}
                      </strong>
                      <span style={{ color: '#71767b', fontSize: '15px', marginRight: '4px' }}>
                        @{post.author?.userID || 'unknown'}
                      </span>
                    </>
                  )}
                  {post.createdAt && (
                    <>
                      <span style={{ color: '#71767b', fontSize: '15px', margin: '0 4px' }}>·</span>
                      <span style={{ color: '#71767b', fontSize: '15px' }}>
                        {getRelativeTime(post.createdAt)}
                      </span>
                    </>
                  )}
                  {/* 更多选项（右上角） */}
                  <div style={{ marginLeft: 'auto', position: 'relative' }} data-menu-container>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Menu button clicked, post.id:', post.id, 'current showDeleteMenu:', showDeleteMenu);
                        const newValue = showDeleteMenu === post.id ? null : post.id;
                        console.log('Setting showDeleteMenu to:', newValue);
                        setShowDeleteMenu(newValue);
                      }}
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
                        position: 'relative',
                        zIndex: 10,
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
                    
                    {/* 删除菜单（只有作者可见） */}
                    {showDeleteMenu === post.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: '8px',
                          backgroundColor: '#000000',
                          border: '1px solid #2f3336',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                          zIndex: 1000,
                          minWidth: '200px',
                          overflow: 'hidden',
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* 检查是否是作者，如果不是则显示提示 */}
                        {(() => {
                          // 如果是 repost，不能删除
                          if (post.repost) {
                            return (
                              <div
                                style={{
                                  width: '100%',
                                  padding: '16px',
                                  color: '#71767b',
                                  textAlign: 'left',
                                  fontSize: '15px',
                                }}
                              >
                                轉發的貼文不能刪除
                              </div>
                            );
                          }
                          
                          // 通过 userID 或 email 来判断是否是作者
                          const isAuthorByUserID = post.author?.userID === session?.user?.userID;
                          const isAuthorByEmail = !post.author?.userID && 
                                                 post.author?.email === session?.user?.email;
                          const isAuthor = isAuthorByUserID || isAuthorByEmail;
                          
                          return isAuthor ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Delete button clicked for post:', post.id);
                                handleDelete(post.id);
                                setShowDeleteMenu(null);
                              }}
                              style={{
                                width: '100%',
                                padding: '16px',
                                background: 'none',
                                border: 'none',
                                color: '#f4212e',
                                textAlign: 'left',
                                fontSize: '15px',
                                fontWeight: '400',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#181818';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              刪除
                            </button>
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                padding: '16px',
                                color: '#71767b',
                                textAlign: 'left',
                                fontSize: '15px',
                              }}
                            >
                              無權限刪除此貼文
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* 帖子内容 - 点击进入详情页 */}
                <div
                  style={{
                    cursor: 'pointer',
                    marginBottom: '12px',
                  }}
                  onClick={(e) => {
                    // 如果点击的是链接或 mention，不触发文章点击
                    if (e.target.tagName === 'A' || e.target.closest('a')) {
                      return;
                    }
                    router.push(`/posts/${post.id}`);
                  }}
                >
                  <p
                    style={{
                      fontSize: '15px',
                      color: '#ffffff',
                      marginBottom: '12px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {formatPostContent(post.content).map((part, index) => {
                    if (part.type === 'link') {
                      return (
                        <a
                          key={index}
                          href={part.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#1d9bf0',
                            textDecoration: 'none',
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          {part.content}
                        </a>
                      );
                    } else if (part.type === 'mention') {
                      return (
                        <Link
                          key={index}
                          href={`/${part.userID}`}
                          style={{
                            color: '#1d9bf0',
                            textDecoration: 'none',
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = 'underline';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = 'none';
                          }}
                        >
                          {part.content}
                        </Link>
                      );
                    }
                    return <span key={index}>{part.content}</span>;
                  })}
                  </p>
                </div>

                {/* 交互按钮 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0px',
                    marginTop: '12px',
                  }}
                >
                  {/* 评论 */}
                  <button
                    type="button"
                    onClick={() => handleToggleComments(post.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: expandedComments[post.id] ? '#1d9bf0' : '#71767b',
                      cursor: 'pointer',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginRight: '48px',
                      minWidth: '60px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#1d9bf0';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = expandedComments[post.id] ? '#1d9bf0' : '#71767b';
                    }}
                    title="回覆"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {(post.comments && post.comments.length > 0) && (
                      <span style={{ fontSize: '13px', minWidth: '12px', textAlign: 'left' }}>
                        {post.comments.length}
                      </span>
                    )}
                  </button>

                  {/* 转发 */}
                  <button
                    type="button"
                    onClick={() => handleRepost(post.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: post.isReposted ? '#00ba7c' : '#71767b',
                      cursor: 'pointer',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginRight: '48px',
                      minWidth: '60px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#00ba7c';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = post.isReposted ? '#00ba7c' : '#71767b';
                    }}
                    title={post.isReposted ? '取消轉發' : '轉發'}
                  >
                    <svg 
                      width="18" 
                      height="18" 
                      viewBox="0 0 24 24" 
                      fill={post.isReposted ? 'currentColor' : 'none'} 
                      stroke="currentColor" 
                      strokeWidth="2"
                    >
                      <path d="M17 1l4 4-4 4" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    {post.repostCount > 0 && (
                      <span style={{ fontSize: '13px', minWidth: '12px', textAlign: 'left' }}>
                        {post.repostCount}
                      </span>
                    )}
                  </button>

                  {/* 点赞 */}
                  <button
                    type="button"
                    onClick={() => handleLike(post.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: (post.likes || []).includes(session?.user?.userID)
                        ? '#f4212e'
                        : '#71767b',
                      cursor: 'pointer',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginRight: '48px',
                      minWidth: '60px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!(post.likes || []).includes(session?.user?.userID)) {
                        e.currentTarget.style.color = '#f4212e';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(post.likes || []).includes(session?.user?.userID)) {
                        e.currentTarget.style.color = '#71767b';
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
                      <span style={{ fontSize: '13px', minWidth: '12px', textAlign: 'left' }}>
                        {(post.likes || []).length}
                      </span>
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

                {/* 留言区域 */}
                {expandedComments[post.id] && (
                  <div
                    style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px solid #2f3336',
                    }}
                  >
                    {/* 留言列表 */}
                    {post.comments && post.comments.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        {post.comments.map((comment) => (
                          <div
                            key={comment.id || comment._id}
                            style={{
                              display: 'flex',
                              gap: '12px',
                              padding: '12px 0',
                              borderBottom: '1px solid #2f3336',
                            }}
                          >
                            {/* 留言者头像 */}
                            {comment.author?.userID ? (
                              <Link href={`/${comment.author.userID}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                                {comment.author?.image ? (
                                  <img
                                    src={comment.author.image}
                                    alt={comment.author.name}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      objectFit: 'cover',
                                      cursor: 'pointer',
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      backgroundColor: '#1d9bf0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ffffff',
                                      fontSize: '14px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {comment.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                                  </div>
                                )}
                              </Link>
                            ) : (
                              <div style={{ flexShrink: 0 }}>
                                {comment.author?.image ? (
                                  <img
                                    src={comment.author.image}
                                    alt={comment.author.name}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      objectFit: 'cover',
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      backgroundColor: '#1d9bf0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ffffff',
                                      fontSize: '14px',
                                      fontWeight: '700',
                                    }}
                                  >
                                    {comment.author?.name?.charAt(0)?.toUpperCase() || 'U'}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 留言内容 */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                {comment.author?.userID ? (
                                  <Link href={`/${comment.author.userID}`} style={{ textDecoration: 'none' }}>
                                    <strong style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginRight: '4px', cursor: 'pointer' }}>
                                      {comment.author?.name || 'Unknown'}
                                    </strong>
                                    <span style={{ color: '#71767b', fontSize: '15px', cursor: 'pointer' }}>
                                      @{comment.author.userID}
                                    </span>
                                  </Link>
                                ) : (
                                  <>
                                    <strong style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginRight: '4px' }}>
                                      {comment.author?.name || 'Unknown'}
                                    </strong>
                                    {comment.author?.userID && (
                                      <span style={{ color: '#71767b', fontSize: '15px' }}>
                                        @{comment.author.userID}
                                      </span>
                                    )}
                                  </>
                                )}
                                {comment.createdAt && (
                                  <>
                                    <span style={{ color: '#71767b', fontSize: '15px', margin: '0 4px' }}>·</span>
                                    <span style={{ color: '#71767b', fontSize: '15px' }}>
                                      {new Date(comment.createdAt).toLocaleDateString('zh-TW', {
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p
                                style={{
                                  fontSize: '15px',
                                  color: '#ffffff',
                                  margin: 0,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 添加留言表单 */}
                    {session && (
                      <form
                        onSubmit={(e) => handleCommentSubmit(e, post.id)}
                        style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <input
                          type="text"
                          placeholder="寫下你的留言..."
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          style={{
                            flex: 1,
                            padding: '12px 16px',
                            backgroundColor: '#000000',
                            border: '1px solid #2f3336',
                            borderRadius: '24px',
                            color: '#ffffff',
                            fontSize: '15px',
                            outline: 'none',
                          }}
                          disabled={submittingComments[post.id]}
                        />
                        <button
                          type="submit"
                          disabled={submittingComments[post.id] || !(commentInputs[post.id]?.trim())}
                          style={{
                            padding: '12px 24px',
                            backgroundColor: (commentInputs[post.id]?.trim()) ? '#1d9bf0' : '#1d9bf050',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '24px',
                            fontSize: '15px',
                            fontWeight: '700',
                            cursor: (commentInputs[post.id]?.trim()) ? 'pointer' : 'not-allowed',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          {submittingComments[post.id] ? '發送中...' : '回覆'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 帳號設置區域 */}
        {session && (
          <div
            style={{
              padding: '24px 16px',
              borderTop: '1px solid #2f3336',
              marginTop: '32px',
            }}
          >
            <div
              style={{
                maxWidth: '600px',
                margin: '0 auto',
              }}
            >
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#ffffff',
                  marginBottom: '16px',
                }}
              >
                帳號設置
              </h3>
              <button
                type="button"
                onClick={handleDeleteAccount}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  border: '1px solid #f4212e',
                  borderRadius: '24px',
                  color: '#f4212e',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f4212e20';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                刪除帳號
              </button>
              <p
                style={{
                  fontSize: '13px',
                  color: '#71767b',
                  marginTop: '8px',
                  textAlign: 'center',
                }}
              >
                此操作將永久刪除您的帳號和所有相關數據，無法恢復
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

