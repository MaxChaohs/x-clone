import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { userIDs } = req.body;

    if (!userIDs || !Array.isArray(userIDs)) {
      return res.status(400).json({
        success: false,
        message: '請提供 userIDs 數組',
      });
    }

    const client = await clientPromise;
    const db = client.db();
    const users = db.collection('users');

    // 查找所有存在的 userID（已完成 OAuth 的）
    const existingUsers = await users
      .find({
        userID: { $in: userIDs },
        oauthCompleted: true,
      })
      .project({ userID: 1, provider: 1 })
      .toArray();

    const existingUserIDs = new Set(existingUsers.map(u => u.userID));

    // 返回存在的 userID 列表
    return res.status(200).json({
      success: true,
      existingUserIDs: Array.from(existingUserIDs),
    });
  } catch (error) {
    console.error('Verify users error:', error);
    return res.status(500).json({
      success: false,
      message: '驗證用戶失敗',
    });
  }
}

