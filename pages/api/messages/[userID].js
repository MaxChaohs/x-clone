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

      // 獲取兩個用戶之間的所有消息
      const conversationMessages = await messages
        .find({
          $or: [
            { senderID: currentUserID, receiverID: userID },
            { senderID: userID, receiverID: currentUserID },
          ],
        })
        .sort({ createdAt: 1 }) // 按時間順序排列
        .toArray();

      // 標記消息為已讀
      await messages.updateMany(
        {
          senderID: userID,
          receiverID: currentUserID,
          read: false,
        },
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

