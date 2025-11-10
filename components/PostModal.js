import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// 字符计数逻辑
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

// 格式化内容，识别链接并转换为超链接
const formatContent = (text) => {
  if (!text) return text;
  
  // 识别 http(s):// 或 www. 开头的链接
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  
  return text.replace(urlRegex, (url) => {
    let href = url;
    if (url.startsWith('www.')) {
      href = 'http://' + url;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #1d9bf0; text-decoration: none;">${url}</a>`;
  });
};

export default function PostModal({ isOpen, onClose, onPostSuccess }) {
  const { data: session } = useSession();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const MAX_CHARS = 280;

  // 获取草稿列表
  const fetchDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const response = await fetch('/api/drafts');
      const data = await response.json();
      if (data.success) {
        setDrafts(data.drafts || []);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
    } finally {
      setLoadingDrafts(false);
    }
  };

  // 保存草稿
  const saveDraft = async () => {
    if (!content.trim()) return;

    try {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (data.success) {
        setContent('');
        setShowDiscardConfirm(false);
        onClose();
        alert('草稿已保存');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('保存草稿失敗');
    }
  };

  // 加载草稿
  const loadDraft = (draft) => {
    setContent(draft.content);
    setShowDrafts(false);
  };

  // 删除草稿
  const deleteDraft = async (draftId) => {
    try {
      const response = await fetch(`/api/drafts?id=${draftId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        fetchDrafts();
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  // 提交帖子
  const handleSubmit = async (e) => {
    e.preventDefault();
    const charCount = calculateCharCount(content);
    
    if (!content.trim() || charCount > MAX_CHARS) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (data.success) {
        setContent('');
        onClose();
        if (onPostSuccess) {
          onPostSuccess();
        }
      } else {
        alert(data.message || '發文失敗');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('發文失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  // 处理关闭
  const handleClose = () => {
    if (content.trim()) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // 处理放弃
  const handleDiscard = () => {
    setContent('');
    setShowDiscardConfirm(false);
    onClose();
  };

  // 当打开时获取草稿列表
  useEffect(() => {
    if (isOpen) {
      fetchDrafts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#000000',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid #2f3336',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid #2f3336',
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#181818';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDrafts(!showDrafts);
              if (!showDrafts) {
                fetchDrafts();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#1d9bf0',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '15px',
              fontWeight: '700',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1d9bf010';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Drafts
          </button>
        </div>

        {/* 草稿列表 */}
        {showDrafts && (
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #2f3336',
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            {loadingDrafts ? (
              <p style={{ color: '#71767b', textAlign: 'center' }}>載入中...</p>
            ) : drafts.length === 0 ? (
              <p style={{ color: '#71767b', textAlign: 'center' }}>沒有草稿</p>
            ) : (
              <div>
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    style={{
                      padding: '12px',
                      marginBottom: '8px',
                      backgroundColor: '#181818',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        cursor: 'pointer',
                      }}
                      onClick={() => loadDraft(draft)}
                    >
                      <p
                        style={{
                          color: '#ffffff',
                          fontSize: '15px',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {draft.content.substring(0, 50)}
                        {draft.content.length > 50 ? '...' : ''}
                      </p>
                      <p
                        style={{
                          color: '#71767b',
                          fontSize: '13px',
                          margin: '4px 0 0 0',
                        }}
                      >
                        {new Date(draft.createdAt).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteDraft(draft.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f4212e',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '50%',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f4212e10';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 内容区域 */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '16px' }}>
            {/* 用户信息 */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
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
              <div>
                <p style={{ margin: 0, color: '#ffffff', fontSize: '15px', fontWeight: '700' }}>
                  {session?.user?.name || 'User'}
                </p>
                <p style={{ margin: 0, color: '#71767b', fontSize: '13px' }}>
                  @{session?.user?.userID || 'user'}
                </p>
              </div>
            </div>

            {/* 文本输入 */}
            <textarea
              value={content}
              onChange={(e) => {
                const newContent = e.target.value;
                const newCharCount = calculateCharCount(newContent);
                if (newCharCount <= MAX_CHARS) {
                  setContent(newContent);
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

            {/* 字符计数和按钮 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #2f3336',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: calculateCharCount(content) > MAX_CHARS ? '#f4212e' : '#71767b',
                }}
              >
                {calculateCharCount(content)}/280
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={!content.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: content.trim() ? '#1d9bf0' : '#1d9bf050',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: content.trim() ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s',
                  }}
                >
                  Save
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || calculateCharCount(content) > MAX_CHARS || submitting}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: (content.trim() && calculateCharCount(content) <= MAX_CHARS) ? '#1d9bf0' : '#1d9bf050',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: (content.trim() && calculateCharCount(content) <= MAX_CHARS) ? 'pointer' : 'not-allowed',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? '發送中...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* 放弃确认对话框 */}
        {showDiscardConfirm && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#000000',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #2f3336',
                minWidth: '300px',
              }}
            >
              <h3 style={{ color: '#ffffff', margin: '0 0 16px 0', fontSize: '20px' }}>
                放棄發文？
              </h3>
              <p style={{ color: '#71767b', margin: '0 0 24px 0', fontSize: '15px' }}>
                您有未保存的內容，確定要放棄嗎？
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={saveDraft}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1d9bf0',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f4212e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

