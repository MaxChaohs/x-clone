import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { userID } = req.query;

    if (!userID) {
      return res.status(400).json({
        success: false,
        message: '用戶ID 不能為空',
      });
    }

    const client = await clientPromise;
    const db = client.db();
    const users = db.collection('users');

    // 获取用户信息
    const user = await users.findOne({ userID });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在',
      });
    }

    // 如果用户有 email，查找所有使用相同 email 的用户（可能有多个 userID）
    const relatedUserIDs = [userID];
    if (user.email) {
      const relatedUsers = await users.find({ email: user.email }).toArray();
      relatedUsers.forEach(relatedUser => {
        if (relatedUser.userID && relatedUser.userID !== userID) {
          relatedUserIDs.push(relatedUser.userID);
        }
      });
    }

    return res.status(200).json({
      success: true,
      userID: userID,
      email: user.email,
      relatedUserIDs: relatedUserIDs,
    });
  } catch (error) {
    console.error('Get related userIDs error:', error);
    return res.status(500).json({
      success: false,
      message: '獲取相關用戶ID失敗',
    });
  }
}

