import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { pusherServer } from '@/lib/pusher';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { postId } = req.query;
    const { content } = req.body;

    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({
        success: false,
        message: '貼文ID 無效',
      });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '留言內容不能為空',
      });
    }

    const client = await clientPromise;
    const db = client.db();
    const posts = db.collection('posts');
    const users = db.collection('users');

    // 获取帖子信息
    const post = await posts.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    // 确保 userID 存在
    let currentUserID = session.user?.userID;
    let currentUserEmail = session.user?.email;
    let currentUserName = session.user?.name;
    let currentUserImage = session.user?.image;

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
        if (dbUser.image && !currentUserImage) {
          currentUserImage = dbUser.image;
        }
      }
    }

    if (!currentUserID && !currentUserEmail) {
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    // 创建留言对象
    const newComment = {
      id: new ObjectId().toString(),
      content: content.trim(),
      author: {
        userID: currentUserID || null,
        name: currentUserName || 'Unknown',
        email: currentUserEmail || null,
        image: currentUserImage || null,
      },
      createdAt: new Date(),
    };

    // 添加留言到帖子
    const result = await posts.updateOne(
      { _id: new ObjectId(postId) },
      { $push: { comments: newComment } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    // 获取更新后的帖子
    const updatedPost = await posts.findOne({ _id: new ObjectId(postId) });

    // 使用 Pusher 推送新留言（如果配置了 Pusher）
    try {
      if (pusherServer) {
        // 推送到 posts 频道，让所有用户都能实时看到评论数变化
        await pusherServer.trigger('posts', 'new-comment', {
          postId,
          comment: newComment,
          commentsCount: (updatedPost.comments || []).length,
        });
      }
    } catch (pusherError) {
      console.warn('Pusher error:', pusherError);
    }

    return res.status(200).json({
      success: true,
      comment: newComment,
      comments: updatedPost.comments || [],
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({
      success: false,
      message: '添加留言失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

