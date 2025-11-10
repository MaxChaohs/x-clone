import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
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

    // 检查是否是帖子的作者
    const postAuthorUserID = post.author?.userID;
    const postAuthorEmail = post.author?.email;
    const postAuthorName = post.author?.name;
    
    // 通过 userID 匹配（優先檢查）
    const isAuthorByUserID = postAuthorUserID && 
                             currentUserID &&
                             (String(postAuthorUserID).toLowerCase() === String(currentUserID).toLowerCase());
    
    // 通过 email 匹配（即使 userID 存在也檢查，因為可能使用不同 provider 但同一個 email）
    const isAuthorByEmail = postAuthorEmail && 
                            currentUserEmail &&
                            String(postAuthorEmail).toLowerCase() === String(currentUserEmail).toLowerCase();
    
    // 通过 name 匹配（當 userID 和 email 都不匹配時，作為後備方案）
    const isAuthorByName = !isAuthorByUserID && 
                          !isAuthorByEmail &&
                          postAuthorName && 
                          currentUserName &&
                          String(postAuthorName).toLowerCase() === String(currentUserName).toLowerCase();
    
    const isAuthor = isAuthorByUserID || isAuthorByEmail || isAuthorByName;
    
    if (!isAuthor) {
      // 添加调试日志
      console.log('Delete permission check failed:', {
        postId,
        postAuthor: {
          userID: postAuthorUserID,
          email: postAuthorEmail,
          name: postAuthorName,
        },
        currentUser: {
          userID: currentUserID,
          email: currentUserEmail,
          name: currentUserName,
        },
        isAuthorByUserID,
        isAuthorByEmail,
        isAuthorByName,
      });
      
      return res.status(403).json({
        success: false,
        message: '無權限刪除此貼文',
      });
    }

    // 删除帖子
    const result = await posts.deleteOne({ _id: new ObjectId(postId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    // 使用 Pusher 推送删除事件（如果配置了 Pusher）
    try {
      if (pusherServer) {
        await pusherServer.trigger('posts', 'delete-post', {
          postId,
        });
      }
    } catch (pusherError) {
      console.warn('Pusher error:', pusherError);
    }

    return res.status(200).json({
      success: true,
      message: '貼文已刪除',
    });
  } catch (error) {
    console.error('Delete post error:', error);
    return res.status(500).json({
      success: false,
      message: '刪除貼文失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

