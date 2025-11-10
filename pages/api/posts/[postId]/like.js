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

    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({
        success: false,
        message: '貼文ID 無效',
      });
    }

    const client = await clientPromise;
    const db = client.db();
    const posts = db.collection('posts');
    const users = db.collection('users');

    // 确保 userID 存在
    let userID = session.user?.userID;
    if (!userID && session.user?.email) {
      // 如果 session 中没有 userID，从数据库查找
      const dbUser = await users.findOne({ email: session.user.email });
      if (dbUser && dbUser.userID) {
        userID = dbUser.userID;
      }
    }

    if (!userID) {
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    const post = await posts.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    const likes = post.likes || [];
    // 使用字符串比较，确保类型一致
    const isLiked = likes.some(like => String(like) === String(userID));

    if (isLiked) {
      // 取消按讚 - 移除所有匹配的 userID（处理类型问题）
      // 先获取当前点赞列表，然后过滤掉匹配的 userID
      const filteredLikes = likes.filter(like => String(like) !== String(userID));
      await posts.updateOne(
        { _id: new ObjectId(postId) },
        { $set: { likes: filteredLikes } }
      );

      // 获取更新后的帖子，确保点赞数正确
      const updatedPost = await posts.findOne({ _id: new ObjectId(postId) });
      const updatedLikes = updatedPost?.likes || [];

      // Pusher 推送（如果配置了 Pusher）
      try {
        if (pusherServer) {
          // 推送到 posts 频道，让所有用户都能实时看到点赞数变化
          await pusherServer.trigger('posts', 'update-like', {
            postId,
            userID,
            liked: false,
            likesCount: updatedLikes.length,
          });
        }
      } catch (pusherError) {
        console.warn('Pusher error:', pusherError);
      }

      return res.status(200).json({
        success: true,
        liked: false,
        likesCount: updatedLikes.length,
      });
    } else {
      // 按讚 - 使用 $addToSet 防止重复
      await posts.updateOne(
        { _id: new ObjectId(postId) },
        { $addToSet: { likes: userID } }
      );

      // 获取更新后的帖子，确保点赞数正确
      const updatedPost = await posts.findOne({ _id: new ObjectId(postId) });
      const updatedLikes = updatedPost?.likes || [];

      // Pusher 推送（如果配置了 Pusher）
      try {
        if (pusherServer) {
          // 推送到 posts 频道，让所有用户都能实时看到点赞数变化
          await pusherServer.trigger('posts', 'update-like', {
            postId,
            userID,
            liked: true,
            likesCount: updatedLikes.length,
          });
        }
      } catch (pusherError) {
        console.warn('Pusher error:', pusherError);
      }

      return res.status(200).json({
        success: true,
        liked: true,
        likesCount: updatedLikes.length,
      });
    }
  } catch (error) {
    console.error('Like post error:', error);
    return res.status(500).json({
      success: false,
      message: '操作失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

