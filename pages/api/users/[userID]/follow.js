import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
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

    const { userID } = req.query; // 要关注/取消关注的用户ID

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
      return res.status(400).json({
        success: false,
        message: '無法識別用戶身份',
      });
    }

    // 不能关注自己
    if (currentUserID === userID) {
      return res.status(400).json({
        success: false,
        message: '不能關注自己',
      });
    }

    // 获取目标用户
    const targetUser = await users.findOne({ userID });
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在',
      });
    }

    // 获取当前用户
    const currentUser = await users.findOne({ userID: currentUserID });
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: '當前用戶不存在',
      });
    }

    const isFollowing = (currentUser.following || []).includes(userID);

    if (req.method === 'POST') {
      // 关注
      if (isFollowing) {
        return res.status(200).json({
          success: true,
          message: '已經關注此用戶',
          following: true,
        });
      }

      // 更新当前用户的 following 列表
      await users.updateOne(
        { userID: currentUserID },
        { $addToSet: { following: userID } }
      );

      // 更新目标用户的 followers 列表
      await users.updateOne(
        { userID },
        { $addToSet: { followers: currentUserID } }
      );

      return res.status(200).json({
        success: true,
        message: '關注成功',
        following: true,
      });
    } else if (req.method === 'DELETE') {
      // 取消关注
      if (!isFollowing) {
        return res.status(200).json({
          success: true,
          message: '尚未關注此用戶',
          following: false,
        });
      }

      // 更新当前用户的 following 列表
      await users.updateOne(
        { userID: currentUserID },
        { $pull: { following: userID } }
      );

      // 更新目标用户的 followers 列表
      await users.updateOne(
        { userID },
        { $pull: { followers: currentUserID } }
      );

      return res.status(200).json({
        success: true,
        message: '取消關注成功',
        following: false,
      });
    }
  } catch (error) {
    console.error('Follow/Unfollow error:', error);
    return res.status(500).json({
      success: false,
      message: '操作失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

