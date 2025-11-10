import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';
import { pusherServer } from '@/lib/pusher';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const session = await getServerSession(req, res);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: '未登入',
        });
      }

      const client = await clientPromise;
      const db = client.db();
      const messages = db.collection('messages');
      const users = db.collection('users');

      // 獲取當前用戶的 userID
      let currentUserID = session.user?.userID;
      if (!currentUserID && session.user?.email) {
        const currentUser = await users.findOne({ email: session.user.email });
        if (currentUser && currentUser.userID) {
          currentUserID = currentUser.userID;
        }
      }

      if (!currentUserID) {
        return res.status(400).json({
          success: false,
          message: '無法識別用戶身份',
        });
      }

      // 獲取所有與當前用戶相關的對話
      const conversations = await messages
        .find({
          $or: [
            { senderID: currentUserID },
            { receiverID: currentUserID },
          ],
        })
        .sort({ createdAt: -1 })
        .toArray();

      // 組織對話：每個對話包含兩個用戶之間的所有消息
      const conversationMap = new Map();

      for (const message of conversations) {
        const otherUserID = message.senderID === currentUserID 
          ? message.receiverID 
          : message.senderID;
        
        if (!conversationMap.has(otherUserID)) {
          conversationMap.set(otherUserID, {
            userID: otherUserID,
            lastMessage: message,
            unreadCount: 0,
          });
        }

        const conversation = conversationMap.get(otherUserID);
        if (message.createdAt > conversation.lastMessage.createdAt) {
          conversation.lastMessage = message;
        }
        if (!message.read && message.receiverID === currentUserID) {
          conversation.unreadCount++;
        }
      }

      // 獲取對話中其他用戶的信息
      const conversationList = await Promise.all(
        Array.from(conversationMap.values()).map(async (conversation) => {
          const otherUser = await users.findOne({ userID: conversation.userID });
          return {
            userID: conversation.userID,
            name: otherUser?.name || 'Unknown',
            image: otherUser?.image || null,
            lastMessage: {
              content: conversation.lastMessage.content,
              createdAt: conversation.lastMessage.createdAt,
              senderID: conversation.lastMessage.senderID,
            },
            unreadCount: conversation.unreadCount,
          };
        })
      );

      // 按最後消息時間排序
      conversationList.sort((a, b) => 
        new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
      );

      return res.status(200).json({
        success: true,
        conversations: conversationList,
      });
    } catch (error) {
      console.error('Get messages error:', error);
      return res.status(500).json({
        success: false,
        message: '獲取消息失敗',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } else if (req.method === 'POST') {
    try {
      const session = await getServerSession(req, res);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: '未登入',
        });
      }

      const { receiverID, content } = req.body;

      if (!receiverID || !content || content.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '接收者和消息內容不能為空',
        });
      }

      const client = await clientPromise;
      const db = client.db();
      const messages = db.collection('messages');
      const users = db.collection('users');

      // 獲取當前用戶的 userID
      let senderUserID = session.user?.userID;
      if (!senderUserID && session.user?.email) {
        const senderUser = await users.findOne({ email: session.user.email });
        if (senderUser && senderUser.userID) {
          senderUserID = senderUser.userID;
        }
      }

      if (!senderUserID) {
        return res.status(400).json({
          success: false,
          message: '無法識別用戶身份',
        });
      }

      // 檢查接收者是否存在
      const receiver = await users.findOne({ userID: receiverID });
      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: '接收者不存在',
        });
      }

      // 創建消息
      const newMessage = {
        senderID: senderUserID,
        receiverID: receiverID,
        content: content.trim(),
        read: false,
        createdAt: new Date(),
      };

      const result = await messages.insertOne(newMessage);
      const messageId = result.insertedId.toString();

      // Pusher 推送新消息
      try {
        if (pusherServer) {
          await pusherServer.trigger(`user-${receiverID}`, 'new-message', {
            id: messageId,
            ...newMessage,
            sender: {
              userID: senderUserID,
              name: session.user.name || 'Unknown',
              image: session.user.image || null,
            },
            createdAt: newMessage.createdAt.toISOString(),
          });
        }
      } catch (pusherError) {
        console.warn('Pusher error:', pusherError);
      }

      return res.status(200).json({
        success: true,
        message: {
          id: messageId,
          ...newMessage,
          createdAt: newMessage.createdAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Create message error:', error);
      return res.status(500).json({
        success: false,
        message: '發送消息失敗',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } else {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }
}

