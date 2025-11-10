import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    // 查找所有被當前用戶加入書籤的貼文（考慮 userID 和 email 匹配）
    const bookmarkedPosts = await posts
      .find({
        bookmarks: {
          $elemMatch: {
            $or: [
              ...(currentUserID ? [{ userID: currentUserID }] : []),
              ...(currentUserEmail ? [{ email: currentUserEmail }] : []),
            ],
          },
        },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // 格式化貼文數據
    const formattedPosts = bookmarkedPosts.map((post) => ({
      id: post._id.toString(),
      content: post.content,
      author: post.author,
      likes: post.likes || [],
      comments: post.comments || [],
      repostCount: post.repostCount || 0,
      repost: post.repost || null,
      isReposted: false, // 書籤貼文不需要檢查是否已轉發
      createdAt: post.createdAt,
    }));

    return res.status(200).json({
      success: true,
      posts: formattedPosts,
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    return res.status(500).json({
      success: false,
      message: '獲取書籤失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

