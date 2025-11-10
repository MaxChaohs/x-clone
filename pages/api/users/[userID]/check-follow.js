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
      return res.status(200).json({
        success: true,
        following: false,
      });
    }

    const { userID } = req.query; // 要检查的用户ID

    if (!userID) {
      return res.status(400).json({
        success: false,
        message: '用戶ID 不能為空',
      });
    }

    const client = await clientPromise;
    const db = client.db();
    const users = db.collection('users');

    // 获取当前用户信息
    let currentUserID = session.user?.userID;
    let currentUserEmail = session.user?.email;

    // 从数据库查找当前用户信息
    if (currentUserEmail) {
      const dbUser = await users.findOne({ email: currentUserEmail });
      if (dbUser && dbUser.userID && !currentUserID) {
        currentUserID = dbUser.userID;
      }
    }

    if (!currentUserID) {
      return res.status(200).json({
        success: true,
        following: false,
      });
    }

    // 不能关注自己
    if (currentUserID === userID) {
      return res.status(200).json({
        success: true,
        following: false,
        isOwnProfile: true,
      });
    }

    // 获取当前用户
    const currentUser = await users.findOne({ userID: currentUserID });
    if (!currentUser) {
      return res.status(200).json({
        success: true,
        following: false,
      });
    }

    const isFollowing = (currentUser.following || []).includes(userID);

    return res.status(200).json({
      success: true,
      following: isFollowing,
    });
  } catch (error) {
    console.error('Check follow error:', error);
    return res.status(500).json({
      success: false,
      message: '檢查失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

