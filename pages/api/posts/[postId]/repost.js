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

    // 获取原始文章
    const originalPost = await posts.findOne({ _id: new ObjectId(postId) });

    if (!originalPost) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    // 确保 userID 存在（先獲取 userID，再檢查是否已轉發）
    let authorUserID = session.user?.userID;
    let authorEmail = session.user?.email;

    // 如果 session 中没有 userID，从数据库查找
    if (!authorUserID && session.user?.email) {
      const dbUser = await users.findOne({ email: session.user.email });
      if (dbUser && dbUser.userID) {
        authorUserID = dbUser.userID;
      }
    }

    if (!authorUserID) {
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    // 檢查是否已經轉發過（考慮使用不同 provider 但同一個 email 的情況）
    // 先通過 userID 檢查
    let existingRepost = await posts.findOne({
      'repost.originalPostId': postId,
      'author.userID': authorUserID,
    });

    // 如果沒有找到，且有用 email，也通過 email 檢查（處理不同 provider 但同一個 email 的情況）
    if (!existingRepost && authorEmail) {
      existingRepost = await posts.findOne({
        'repost.originalPostId': postId,
        'author.email': authorEmail,
      });
    }

    if (existingRepost) {
      // 如果已经转发过，取消转发（删除转发）
      await posts.deleteOne({ _id: existingRepost._id });

      // 更新原始文章的转发数（确保不会小于0）
      const originalPost = await posts.findOne({ _id: new ObjectId(postId) });
      const currentRepostCount = originalPost?.repostCount || 0;
      await posts.updateOne(
        { _id: new ObjectId(postId) },
        { $set: { repostCount: Math.max(0, currentRepostCount - 1) } }
      );

      // Pusher 推送
      try {
        if (pusherServer) {
          await pusherServer.trigger('posts', 'delete-post', {
            postId: existingRepost._id.toString(),
          });
        }
      } catch (pusherError) {
        console.warn('Pusher error:', pusherError);
      }

      return res.status(200).json({
        success: true,
        reposted: false,
        message: '取消轉發成功',
      });
    }

    // authorUserID 已經在上面獲取了，這裡不需要重複獲取

    // 创建转发文章
    const repost = {
      content: '', // 转发没有内容
      author: {
        userID: authorUserID,
        name: session.user.name || 'Unknown',
        email: authorEmail || null,
        image: session.user.image || null,
      },
      repost: {
        originalPostId: postId,
        originalAuthor: originalPost.author,
        originalContent: originalPost.content,
        originalCreatedAt: originalPost.createdAt,
      },
      likes: [],
      comments: [],
      repostCount: 0,
      createdAt: new Date(),
    };

    const result = await posts.insertOne(repost);
    const repostId = result.insertedId.toString();

    // 更新原始文章的转发数
    const originalPostUpdated = await posts.findOne({ _id: new ObjectId(postId) });
    const currentRepostCount = originalPostUpdated?.repostCount || 0;
    await posts.updateOne(
      { _id: new ObjectId(postId) },
      { $set: { repostCount: currentRepostCount + 1 } }
    );

    // Pusher 推送
    try {
      if (pusherServer) {
        await pusherServer.trigger('posts', 'new-post', {
          id: repostId,
          ...repost,
          createdAt: repost.createdAt.toISOString(),
        });
      }
    } catch (pusherError) {
      console.warn('Pusher error:', pusherError);
    }

    return res.status(200).json({
      success: true,
      reposted: true,
      message: '轉發成功',
      repost: {
        id: repostId,
        ...repost,
        createdAt: repost.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Repost error:', error);
    return res.status(500).json({
      success: false,
      message: '轉發失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

