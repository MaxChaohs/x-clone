import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const users = db.collection('users');

    // 獲取所有已註冊的用戶（只返回已完成 OAuth 的用戶）
    const allUsers = await users
      .find(
        { oauthCompleted: true },
        { projection: { userID: 1, name: 1, provider: 1, image: 1 } }
      )
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      users: allUsers.map((user) => ({
        userID: user.userID,
        name: user.name,
        provider: user.provider,
        image: user.image,
      })),
    });
  } catch (error) {
    console.error('Get users list error:', error);
    return res.status(500).json({
      success: false,
      message: '獲取用戶列表失敗',
    });
  }
}

