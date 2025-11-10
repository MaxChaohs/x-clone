import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';

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

      const { userID } = req.query; // 對話的另一方用戶ID

      if (!userID) {
        return res.status(400).json({
          success: false,
          message: '用戶ID 不能為空',
        });
      }

      const client = await clientPromise;
      const db = client.db();
      const messages = db.collection('messages');
      const users = db.collection('users');

      // 獲取當前用戶的 userID（處理相同 email 但不同 provider 的情況）
      let currentUserID = session.user?.userID;
      let currentUserEmail = session.user?.email;

      // 如果 session 中没有 userID，從數據庫查找（查找所有使用相同 email 的用戶記錄）
      if (!currentUserID && currentUserEmail) {
        const dbUsers = await users.find({ email: currentUserEmail }).toArray();
        if (dbUsers.length > 0) {
          // 使用第一個找到的 userID（通常相同 email 的用戶會有相同的 userID）
          currentUserID = dbUsers[0].userID;
        }
      }

      if (!currentUserID && !currentUserEmail) {
        return res.status(400).json({
          success: false,
          message: '無法識別用戶身份',
        });
      }

      // 獲取兩個用戶之間的所有消息（考慮相同 email 但不同 provider 的情況）
      // 構建查詢條件：同時檢查 userID 和 email
      const messageQuery = {
        $or: [
          ...(currentUserID ? [
            { senderID: currentUserID, receiverID: userID },
            { senderID: userID, receiverID: currentUserID },
          ] : []),
          ...(currentUserEmail ? [
            { senderEmail: currentUserEmail, receiverID: userID },
            { senderID: userID, receiverEmail: currentUserEmail },
          ] : []),
        ],
      };

      const conversationMessages = await messages
        .find(messageQuery)
        .sort({ createdAt: 1 }) // 按時間順序排列
        .toArray();

      // 標記消息為已讀（考慮 userID 和 email 匹配）
      const readQuery = {
        read: false,
        $or: [
          ...(currentUserID ? [
            { senderID: userID, receiverID: currentUserID },
          ] : []),
          ...(currentUserEmail ? [
            { senderID: userID, receiverEmail: currentUserEmail },
          ] : []),
        ],
      };

      await messages.updateMany(
        readQuery,
        {
          $set: { read: true },
        }
      );

      return res.status(200).json({
        success: true,
        messages: conversationMessages.map((msg) => ({
          id: msg._id.toString(),
          senderID: msg.senderID,
          receiverID: msg.receiverID,
          content: msg.content,
          read: msg.read,
          createdAt: msg.createdAt,
        })),
      });
    } catch (error) {
      console.error('Get conversation error:', error);
      return res.status(500).json({
        success: false,
        message: '獲取對話失敗',
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

