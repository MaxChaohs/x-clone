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

    const user = await users.findOne({ userID });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        userID: user.userID,
        name: user.name,
        email: user.email,
        image: user.image,
        bio: user.bio || '',
        bannerImage: user.bannerImage || '',
        following: user.following || [],
        followers: user.followers || [],
        provider: user.provider,
        oauthCompleted: user.oauthCompleted,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      message: '獲取用戶信息失敗',
    });
  }
}

