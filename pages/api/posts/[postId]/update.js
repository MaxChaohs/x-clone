import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { pusherServer } from '@/lib/pusher';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
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
        message: '貼文內容不能為空',
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
    if (!currentUserID && session.user?.email) {
      // 如果 session 中没有 userID，从数据库查找
      const dbUser = await users.findOne({ email: session.user.email });
      if (dbUser && dbUser.userID) {
        currentUserID = dbUser.userID;
      }
    }

    if (!currentUserID) {
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    // 检查是否是帖子的作者
    const postAuthorUserID = post.author?.userID;
    const isAuthor = postAuthorUserID === currentUserID || 
                     String(postAuthorUserID) === String(currentUserID);
    
    if (!isAuthor) {
      return res.status(403).json({
        success: false,
        message: '無權限編輯此貼文',
      });
    }

    // 更新帖子
    const result = await posts.updateOne(
      { _id: new ObjectId(postId) },
      { 
        $set: { 
          content: content.trim(),
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    // 获取更新后的帖子
    const updatedPost = await posts.findOne({ _id: new ObjectId(postId) });

    // 使用 Pusher 推送更新事件（如果配置了 Pusher）
    try {
      if (pusherServer) {
        await pusherServer.trigger('posts', 'update-post', {
          postId,
          content: updatedPost.content,
        });
      }
    } catch (pusherError) {
      console.warn('Pusher error:', pusherError);
    }

    return res.status(200).json({
      success: true,
      post: {
        id: updatedPost._id.toString(),
        content: updatedPost.content,
        author: updatedPost.author,
        likes: updatedPost.likes || [],
        comments: updatedPost.comments || [],
        createdAt: updatedPost.createdAt,
        updatedAt: updatedPost.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update post error:', error);
    return res.status(500).json({
      success: false,
      message: '更新貼文失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

