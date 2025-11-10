import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';
import { pusherServer } from '@/lib/pusher';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

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
    const users = db.collection('users');
    const posts = db.collection('posts');
    const messages = db.collection('messages');
    const accounts = db.collection('accounts');
    const sessions = db.collection('sessions');

    // 獲取當前用戶信息
    let currentUserID = session.user?.userID;
    let currentUserEmail = session.user?.email;

    // 從數據庫查找用戶信息
    if (currentUserEmail) {
      const dbUser = await users.findOne({ email: currentUserEmail });
      if (dbUser) {
        if (dbUser.userID && !currentUserID) {
          currentUserID = dbUser.userID;
        }
        if (dbUser.email && !currentUserEmail) {
          currentUserEmail = dbUser.email;
        }
      }
    }

    if (!currentUserID && !currentUserEmail) {
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    // 查找要刪除的用戶
    const userQuery = {
      $or: [
        ...(currentUserID ? [{ userID: currentUserID }] : []),
        ...(currentUserEmail ? [{ email: currentUserEmail }] : []),
      ],
    };

    const userToDelete = await users.findOne(userQuery);

    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在',
      });
    }

    const finalUserID = userToDelete.userID || currentUserID;
    const finalEmail = userToDelete.email || currentUserEmail;

    // 刪除用戶的所有貼文
    const postsQuery = {
      $or: [
        ...(finalUserID ? [{ 'author.userID': finalUserID }] : []),
        ...(finalEmail ? [{ 'author.email': finalEmail }] : []),
      ],
    };

    const userPosts = await posts.find(postsQuery).toArray();
    const postsDeleteResult = await posts.deleteMany(postsQuery);

    // 刪除用戶的所有消息（作為發送者和接收者）
    const messagesDeleteResult = await messages.deleteMany({
      $or: [
        { senderID: finalUserID },
        { receiverID: finalUserID },
      ],
    });

    // 刪除 NextAuth 相關記錄
    // 刪除 accounts（通過 userId）
    const accountsDeleteResult = await accounts.deleteMany({
      userId: userToDelete._id,
    });

    // 刪除 sessions（通過 userId，注意 NextAuth 的 sessions 集合可能使用不同的格式）
    let sessionsDeleteResult = { deletedCount: 0 };
    try {
      // 嘗試通過 userId 刪除
      sessionsDeleteResult = await sessions.deleteMany({
        userId: userToDelete._id,
      });
    } catch (sessionsError) {
      // 如果失敗，嘗試通過 userId 字符串刪除
      try {
        sessionsDeleteResult = await sessions.deleteMany({
          userId: userToDelete._id.toString(),
        });
      } catch (error) {
        console.warn('Could not delete sessions:', error);
      }
    }

    // 更新其他用戶的 following 和 followers 列表
    await users.updateMany(
      { following: finalUserID },
      { $pull: { following: finalUserID } }
    );

    await users.updateMany(
      { followers: finalUserID },
      { $pull: { followers: finalUserID } }
    );

    // 刪除用戶記錄
    const userDeleteResult = await users.deleteOne({ _id: userToDelete._id });

    // 使用 Pusher 推送刪除事件（如果配置了 Pusher）
    try {
      if (pusherServer) {
        for (const post of userPosts) {
          await pusherServer.trigger('posts', 'delete-post', {
            postId: post._id.toString(),
          });
        }
      }
    } catch (pusherError) {
      console.warn('Pusher error:', pusherError);
    }

    return res.status(200).json({
      success: true,
      message: '帳號已成功刪除',
      deletedCount: {
        user: userDeleteResult.deletedCount,
        posts: postsDeleteResult.deletedCount,
        messages: messagesDeleteResult.deletedCount,
        accounts: accountsDeleteResult.deletedCount,
        sessions: sessionsDeleteResult.deletedCount,
      },
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      success: false,
      message: '刪除帳號失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

