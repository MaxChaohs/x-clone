import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: '未登入',
      });
    }

    const { userID } = req.query;
    const { name, bio, bannerImage, avatarImage } = req.body;

    const client = await clientPromise;
    const db = client.db();
    const users = db.collection('users');

    // 调试日志
    console.log('Update profile check:', {
      sessionUserID: session.user?.userID,
      requestUserID: userID,
      sessionEmail: session.user?.email,
    });

    // 如果 session 中没有 userID，尝试从数据库查找
    let currentUserID = session.user?.userID;
    if (!currentUserID && session.user?.email) {
      // 尝试通过 email 查找用户
      const dbUser = await users.findOne({ email: session.user.email });
      if (dbUser && dbUser.userID) {
        currentUserID = dbUser.userID;
        console.log('Found userID from database by email:', currentUserID);
      } else {
        // 如果通过 email 找不到，尝试查找所有匹配的账户记录
        // 通过 NextAuth 的 accounts 集合查找
        const accounts = db.collection('accounts');
        const account = await accounts.findOne({ 
          provider: { $in: ['google', 'github'] },
          // 这里需要通过其他方式查找，因为 accounts 表可能没有 email
        });
        
        // 如果还是找不到，尝试通过 providerId 查找
        // 但我们需要更多信息
        console.warn('Cannot find userID from database:', {
          email: session.user.email,
          dbUser: dbUser ? { hasUserID: !!dbUser.userID, userID: dbUser.userID } : null,
        });
      }
    }

    // 调试：检查请求的 userID 是否存在于数据库中
    const requestedUser = await users.findOne({ userID });
    console.log('Requested user check:', {
      userID,
      exists: !!requestedUser,
      requestedUserEmail: requestedUser?.email,
      sessionEmail: session.user?.email,
    });

    // 如果请求的 userID 不存在，返回 404
    if (!requestedUser) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在',
      });
    }

    // 如果请求的 userID 的 email 与 session 的 email 匹配，也允许更新
    const emailMatch = requestedUser.email === session.user?.email;
    
    // 只能更新自己的资料（通过 userID 或 email 匹配）
    if (!currentUserID && !emailMatch) {
      console.warn('Permission denied:', {
        currentUserID,
        requestUserID: userID,
        emailMatch,
        sessionUser: session.user,
        requestedUserEmail: requestedUser.email,
      });
      return res.status(403).json({
        success: false,
        message: '無權限更新此用戶資料',
      });
    }

    // 如果通过 email 匹配，使用请求的 userID
    if (!currentUserID && emailMatch) {
      currentUserID = userID;
      console.log('Permission granted by email match:', currentUserID);
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (bannerImage !== undefined) updateData.bannerImage = bannerImage;
    if (avatarImage !== undefined) updateData.image = avatarImage;

    updateData.updatedAt = new Date();

    const result = await users.updateOne(
      { userID },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在',
      });
    }

    // 获取更新后的用户信息
    const updatedUser = await users.findOne({ userID });

    return res.status(200).json({
      success: true,
      user: {
        id: updatedUser._id.toString(),
        userID: updatedUser.userID,
        name: updatedUser.name,
        email: updatedUser.email,
        image: updatedUser.image,
        bio: updatedUser.bio || '',
        bannerImage: updatedUser.bannerImage || '',
        provider: updatedUser.provider,
        oauthCompleted: updatedUser.oauthCompleted,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({
      success: false,
      message: '更新用戶資料失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

