import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';
import { pusherServer } from '@/lib/pusher';

/**
 * 管理 API：删除当前用户的所有帖子
 * 这是一个临时解决方案，用于删除旧帖子（没有正确保存 author 信息的帖子）
 */
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
    const posts = db.collection('posts');
    const users = db.collection('users');

    // 获取当前用户信息
    let currentUserID = session.user?.userID;
    let currentUserEmail = session.user?.email;
    let currentUserName = session.user?.name;

    // 从数据库查找用户信息
    if (currentUserEmail) {
      const dbUser = await users.findOne({ email: currentUserEmail });
      if (dbUser) {
        if (dbUser.userID && !currentUserID) {
          currentUserID = dbUser.userID;
        }
        if (dbUser.email && !currentUserEmail) {
          currentUserEmail = dbUser.email;
        }
        if (dbUser.name && !currentUserName) {
          currentUserName = dbUser.name;
        }
      }
    }

    if (!currentUserEmail) {
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    // 查找所有匹配的帖子（通过 userID、email 或 name）
    const query = {
      $or: [
        ...(currentUserID ? [{ 'author.userID': currentUserID }] : []),
        ...(currentUserEmail ? [{ 'author.email': currentUserEmail }] : []),
        ...(currentUserName ? [{ 'author.name': currentUserName }] : []),
      ],
    };

    // 如果没有任何匹配条件，返回错误
    if (query.$or.length === 0) {
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    // 查找匹配的帖子
    const matchingPosts = await posts.find(query).toArray();
    
    if (matchingPosts.length === 0) {
      return res.status(200).json({
        success: true,
        message: '沒有找到可刪除的貼文',
        deletedCount: 0,
      });
    }

    // 删除所有匹配的帖子
    const result = await posts.deleteMany(query);

    // 使用 Pusher 推送删除事件（如果配置了 Pusher）
    try {
      if (pusherServer) {
        for (const post of matchingPosts) {
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
      message: `已刪除 ${result.deletedCount} 篇貼文`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Delete my posts error:', error);
    return res.status(500).json({
      success: false,
      message: '刪除貼文失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

