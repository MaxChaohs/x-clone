import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import Pusher from 'pusher-js';

export default function Messages() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageContent, setMessageContent] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef(null);
  const pusherRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    // 即使沒有 userID，只要有 email 也可以獲取對話（處理相同 email 但不同 provider 的情況）
    if (status === 'authenticated' && (session?.user?.userID || session?.user?.email)) {
      fetchConversations();
    }
  }, [status, session]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    // 初始化 Pusher（如果配置了）
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PUSHER_KEY) {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
      });

      pusherRef.current = pusher;

      // 訂閱當前用戶的消息頻道
      if (session?.user?.userID) {
        const channel = pusher.subscribe(`user-${session.user.userID}`);
        
        channel.bind('new-message', (data) => {
          // 如果當前正在查看發送者的對話，添加新消息
          if (selectedConversation === data.sender.userID) {
            setMessages((prev) => [...prev, {
              id: data.id,
              senderID: data.senderID,
              receiverID: data.receiverID,
              content: data.content,
              read: data.read,
              createdAt: data.createdAt,
            }]);
          }
          // 更新對話列表
          fetchConversations();
        });

        return () => {
          pusher.disconnect();
        };
      }
    }
  }, [session?.user?.userID, selectedConversation]);

  useEffect(() => {
    // 滾動到底部
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/messages');
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userID) => {
    try {
      const response = await fetch(`/api/messages/${userID}`);
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverID: selectedConversation,
          content: messageContent,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessageContent('');
        // 添加新消息到列表
        setMessages((prev) => [...prev, {
          id: data.message.id,
          senderID: data.message.senderID,
          receiverID: data.message.receiverID,
          content: data.message.content,
          read: data.message.read,
          createdAt: data.message.createdAt,
        }]);
        // 更新對話列表
        fetchConversations();
      } else {
        alert(data.message || '發送失敗');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('發送失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  const getConversationUser = (conversation) => {
    return conversations.find(c => c.userID === conversation) || null;
  };

  // 搜索用戶
  const handleSearchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/users/list?search=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.success) {
        // 過濾掉當前用戶
        const currentUserID = session?.user?.userID;
        const filteredResults = data.users.filter(
          (user) => user.userID !== currentUserID
        );
        setSearchResults(filteredResults);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  // 開始新對話
  const handleStartConversation = (userID) => {
    setSelectedConversation(userID);
    setSearchQuery('');
    setSearchResults([]);
  };

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

  return (
    <Layout>
      <div className="page-content">
        <div style={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
          {/* 對話列表 */}
          <div
            style={{
              width: '350px',
              borderRight: '1px solid #2f3336',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {/* 標題和搜索 */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #2f3336',
                position: 'sticky',
                top: 0,
                backgroundColor: '#000000',
                zIndex: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                  Messages
                </h1>
                {/* 新對話按鈕 */}
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    // 聚焦搜索框
                    const searchInput = document.querySelector('input[placeholder="搜索用戶..."]');
                    if (searchInput) {
                      searchInput.focus();
                    }
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1d9bf0',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '24px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1a8cd8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1d9bf0';
                  }}
                  title="開始新對話"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  新對話
                </button>
              </div>
              {/* 搜索框 */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="搜索用戶以開始新對話..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchUsers(e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    backgroundColor: '#000000',
                    border: '1px solid #2f3336',
                    borderRadius: '24px',
                    color: '#ffffff',
                    fontSize: '15px',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.borderColor = '#1d9bf0';
                  }}
                  onBlur={(e) => {
                    e.target.borderColor = '#2f3336';
                  }}
                />
              </div>
              {/* 搜索結果 */}
              {searchQuery.trim() && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '16px',
                    right: '16px',
                    marginTop: '8px',
                    backgroundColor: '#000000',
                    border: '1px solid #2f3336',
                    borderRadius: '12px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {searching ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#71767b' }}>
                      <p>搜索中...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((user) => (
                      <div
                        key={user.userID}
                        onClick={() => handleStartConversation(user.userID)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          borderBottom: '1px solid #2f3336',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#181818';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name}
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
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                            {user.name}
                          </div>
                          <div style={{ fontSize: '13px', color: '#71767b' }}>
                            @{user.userID}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#71767b' }}>
                      <p>未找到用戶</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 對話列表 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {conversations.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: '#71767b' }}>
                  <p>尚無對話</p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.userID}
                    onClick={() => setSelectedConversation(conversation.userID)}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid #2f3336',
                      cursor: 'pointer',
                      backgroundColor: selectedConversation === conversation.userID ? '#181818' : 'transparent',
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedConversation !== conversation.userID) {
                        e.currentTarget.style.backgroundColor = '#080808';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedConversation !== conversation.userID) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {/* 用戶頭像 */}
                    <div style={{ flexShrink: 0 }}>
                      {conversation.image ? (
                        <img
                          src={conversation.image}
                          alt={conversation.name}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: '#1d9bf0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '20px',
                            fontWeight: '700',
                          }}
                        >
                          {conversation.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>

                    {/* 對話信息 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <strong
                          style={{
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#ffffff',
                            marginRight: '8px',
                          }}
                        >
                          {conversation.name}
                        </strong>
                        {conversation.unreadCount > 0 && (
                          <span
                            style={{
                              backgroundColor: '#1d9bf0',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: '700',
                              padding: '2px 6px',
                              borderRadius: '12px',
                              minWidth: '18px',
                              textAlign: 'center',
                            }}
                          >
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: '15px',
                          color: '#71767b',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {conversation.lastMessage.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 消息區域 */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {selectedConversation ? (
              <>
                {/* 對話標題 */}
                <div
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #2f3336',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {(() => {
                    const user = getConversationUser(selectedConversation);
                    return (
                      <>
                        {user?.image ? (
                          <img
                            src={user.image}
                            alt={user.name}
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
                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div>
                          <strong style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
                            {user?.name || 'Unknown'}
                          </strong>
                          <p style={{ fontSize: '13px', color: '#71767b', margin: 0 }}>
                            @{selectedConversation}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 消息列表 */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  {messages.map((message) => {
                    // 判斷是否為自己的消息（考慮 userID 和 email 匹配）
                    const isOwnMessage = 
                      (session?.user?.userID && message.senderID === session.user.userID) ||
                      (session?.user?.email && message.senderEmail === session.user.email);
                    return (
                      <div
                        key={message.id}
                        style={{
                          display: 'flex',
                          justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '70%',
                            padding: '12px 16px',
                            backgroundColor: isOwnMessage ? '#1d9bf0' : '#181818',
                            borderRadius: '18px',
                            color: '#ffffff',
                            fontSize: '15px',
                            wordBreak: 'break-word',
                          }}
                        >
                          {message.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* 發送消息表單 */}
                <form
                  onSubmit={handleSendMessage}
                  style={{
                    padding: '16px',
                    borderTop: '1px solid #2f3336',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="輸入消息..."
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
                    onFocus={(e) => {
                      e.target.borderColor = '#1d9bf0';
                    }}
                    onBlur={(e) => {
                      e.target.borderColor = '#2f3336';
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!messageContent.trim() || sending}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: messageContent.trim() ? '#1d9bf0' : '#1d9bf050',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '24px',
                      fontSize: '15px',
                      fontWeight: '700',
                      cursor: messageContent.trim() && !sending ? 'pointer' : 'not-allowed',
                      opacity: sending ? 0.6 : 1,
                    }}
                  >
                    {sending ? '發送中...' : '發送'}
                  </button>
                </form>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#71767b',
                  padding: '40px',
                }}
              >
                <p style={{ marginBottom: '24px', fontSize: '20px' }}>選擇一個對話開始聊天</p>
                <p style={{ marginBottom: '24px', fontSize: '15px', color: '#71767b' }}>
                  或使用上方搜索框搜索用戶開始新對話
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
