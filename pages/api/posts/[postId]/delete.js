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

    // 确保 userID 和 email 存在
    let currentUserID = session.user?.userID;
    let currentUserEmail = session.user?.email;
    let currentUserName = session.user?.name;
    
    // 收集所有可能的 userID（處理不同 provider 但同一個 email 的情況）
    let allPossibleUserIDs = [];
    if (currentUserID) {
      allPossibleUserIDs.push(currentUserID);
    }
    
    // 从数据库查找用户信息（查找所有使用相同 email 的用戶記錄）
    if (currentUserEmail) {
      // 查找所有使用相同 email 的用戶記錄（處理不同 provider 但同一個 email 的情況）
      const dbUsers = await users.find({ email: currentUserEmail }).toArray();
      if (dbUsers.length > 0) {
        // 收集所有可能的 userID
        dbUsers.forEach(user => {
          if (user.userID && !allPossibleUserIDs.includes(user.userID)) {
            allPossibleUserIDs.push(user.userID);
          }
        });
        
        // 如果 session 中沒有 userID，使用第一個找到的
        if (!currentUserID && allPossibleUserIDs.length > 0) {
          currentUserID = allPossibleUserIDs[0];
        }
        
        // 確保 email 正確
        if (!currentUserEmail) {
          currentUserEmail = dbUsers[0].email;
        }
        
        // 確保 name 正確
        if (!currentUserName) {
          currentUserName = dbUsers[0].name;
        }
      }
    }

    // 检查是否是帖子的作者
    const postAuthorUserID = post.author?.userID;
    const postAuthorEmail = post.author?.email;
    const postAuthorName = post.author?.name;
    
    // 通過 userID 匹配（檢查貼文的 author.userID 是否與任何使用相同 email 的用戶的 userID 匹配）
    // 這是關鍵：即使當前 session 的 userID 不同，只要貼文的 author.userID 與任何使用相同 email 的用戶的 userID 匹配，就認為是同一個人
    const isAuthorByUserID = postAuthorUserID && 
                             allPossibleUserIDs.length > 0 &&
                             allPossibleUserIDs.some(userID => 
                               String(userID).toLowerCase() === String(postAuthorUserID).toLowerCase()
                             );
    
    // 通過 email 匹配（即使 userID 存在也檢查，因為可能使用不同 provider 但同一個 email）
    // 這是關鍵：即使 userID 不同，只要 email 相同，就認為是同一個人
    const isAuthorByEmail = postAuthorEmail && 
                            currentUserEmail &&
                            String(postAuthorEmail).toLowerCase() === String(currentUserEmail).toLowerCase();
    
    // 通過 name 匹配（當 userID 和 email 都不匹配時，作為後備方案）
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
          allPossibleUserIDs: allPossibleUserIDs,
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

