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
  const messagesEndRef = useRef(null);
  const pusherRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.userID) {
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
            {/* 標題 */}
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
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                Messages
              </h1>
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
                    const isOwnMessage = message.senderID === session?.user?.userID;
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
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#71767b',
                }}
              >
                <p>選擇一個對話開始聊天</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
