import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

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

    // 獲取貼文
    const post = await posts.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    // 檢查是否已經加入書籤
    const bookmarks = post.bookmarks || [];
    
    // 檢查是否已加入書籤（考慮 userID 和 email 匹配）
    const isBookmarked = bookmarks.some(
      (bookmark) =>
        (currentUserID && String(bookmark.userID) === String(currentUserID)) ||
        (currentUserEmail && String(bookmark.email) === String(currentUserEmail))
    );

    if (isBookmarked) {
      // 移除書籤
      const updatedBookmarks = bookmarks.filter(
        (bookmark) =>
          !(currentUserID && String(bookmark.userID) === String(currentUserID)) &&
          !(currentUserEmail && String(bookmark.email) === String(currentUserEmail))
      );

      await posts.updateOne(
        { _id: new ObjectId(postId) },
        { $set: { bookmarks: updatedBookmarks } }
      );

      return res.status(200).json({
        success: true,
        bookmarked: false,
        message: '已移除書籤',
      });
    } else {
      // 加入書籤
      const newBookmark = {
        userID: currentUserID,
        email: currentUserEmail || null,
        name: session.user.name || null,
        createdAt: new Date(),
      };

      await posts.updateOne(
        { _id: new ObjectId(postId) },
        { $push: { bookmarks: newBookmark } }
      );

      return res.status(200).json({
        success: true,
        bookmarked: true,
        message: '已加入書籤',
      });
    }
  } catch (error) {
    console.error('Bookmark error:', error);
    return res.status(500).json({
      success: false,
      message: '書籤操作失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

