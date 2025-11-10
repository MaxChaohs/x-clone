import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/Layout';

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

export default function PostDetail() {
  const { data: session } = useSession();
  const router = useRouter();
  const { postId } = router.query;
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComments, setSubmittingComments] = useState({});

  useEffect(() => {
    if (!postId) return;

    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}`);
        const data = await response.json();
        if (data.success) {
          setPost(data.post);
          setComments(data.post.comments || []);
        }
      } catch (error) {
        console.error('Error fetching post:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const handleLike = async (postId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        const currentUserID = session?.user?.userID;
        setPost((prev) => {
          if (!prev) return prev;
          let updatedLikes = [...(prev.likes || [])];
          
          if (data.liked) {
            if (!updatedLikes.some(like => String(like) === String(currentUserID))) {
              updatedLikes.push(currentUserID);
            }
          } else {
            updatedLikes = updatedLikes.filter(
              (id) => String(id) !== String(currentUserID)
            );
          }
          
          return {
            ...prev,
            likes: updatedLikes,
          };
        });
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleRepost = async (postId) => {
    try {
      const response = await fetch(`/api/posts/${postId}/repost`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        // 刷新帖子
        const response = await fetch(`/api/posts/${postId}`);
        const data = await response.json();
        if (data.success) {
          setPost(data.post);
        }
      } else {
        alert(data.message || '轉發失敗');
      }
    } catch (error) {
      console.error('Error reposting:', error);
      alert('轉發失敗，請稍後再試');
    }
  };

  const handleCommentSubmit = async (e, postId) => {
    e.preventDefault();
    const content = commentInputs[postId]?.trim();
    if (!content) return;

    setSubmittingComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (data.success) {
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
        // 刷新帖子以获取最新留言
        const response = await fetch(`/api/posts/${postId}`);
        const data = await response.json();
        if (data.success) {
          setPost(data.post);
          setComments(data.post.comments || []);
        }
      } else {
        alert(data.message || '留言失敗');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('留言失敗，請稍後再試');
    } finally {
      setSubmittingComments((prev) => ({ ...prev, [postId]: false }));
    }
  };

  if (loading) {
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

  if (!post) {
    return (
      <Layout>
        <div className="page-content">
          <div className="content-placeholder">
            <p>貼文不存在</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-content">
        <div className="content-placeholder">
          {/* 文章内容 */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #2f3336',
              display: 'flex',
              gap: '12px',
            }}
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
                  onClick={() => setExpandedComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
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
                  {comments.length > 0 && (
                    <span style={{ fontSize: '13px', minWidth: '12px', textAlign: 'left' }}>
                      {comments.length}
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
                    color: post.repostCount > 0 ? '#00ba7c' : '#71767b',
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
                    e.currentTarget.style.color = post.repostCount > 0 ? '#00ba7c' : '#71767b';
                  }}
                  title="轉推"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  {comments.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      {comments.map((comment) => (
                        <div
                          key={comment.id || comment._id}
                          style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '12px 0',
                            borderBottom: '1px solid #2f3336',
                            cursor: 'pointer',
                          }}
                          onClick={() => router.push(`/posts/${comment.id || comment._id}`)}
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
                                    {getRelativeTime(comment.createdAt)}
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
                              {formatPostContent(comment.content).map((part, index) => {
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
        </div>
      </div>
    </Layout>
  );
}

