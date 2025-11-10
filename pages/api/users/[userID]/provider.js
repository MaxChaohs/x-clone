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

    // 查找所有匹配該 userID 的用戶（可能有多個，因為不同 provider 可以使用相同的 userID）
    const matchingUsers = await users.find({ userID }).toArray();

    if (matchingUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在',
      });
    }

    // 如果只有一個匹配的用戶，直接返回
    if (matchingUsers.length === 1) {
      const user = matchingUsers[0];
      
      // 檢查用戶是否已完成 OAuth
      if (!user.oauthCompleted) {
        return res.status(200).json({
          success: true,
          provider: user.provider,
          name: user.name,
          oauthCompleted: false,
          message: '用戶尚未完成 OAuth 認證，請先完成 OAuth 登入',
        });
      }

      return res.status(200).json({
        success: true,
        provider: user.provider,
        name: user.name,
        oauthCompleted: true,
      });
    }

    // 如果有多個匹配的用戶（不同 provider），返回所有匹配的用戶
    // 過濾出已完成 OAuth 的用戶
    const completedUsers = matchingUsers.filter(u => u.oauthCompleted);
    
    if (completedUsers.length === 0) {
      // 如果沒有已完成 OAuth 的用戶，返回第一個未完成的
      const user = matchingUsers[0];
      return res.status(200).json({
        success: true,
        provider: user.provider,
        name: user.name,
        oauthCompleted: false,
        message: '用戶尚未完成 OAuth 認證，請先完成 OAuth 登入',
      });
    }

    // 如果有多個已完成 OAuth 的用戶，返回所有匹配的用戶列表
    return res.status(200).json({
      success: true,
      multiple: true,
      users: completedUsers.map(user => ({
        provider: user.provider,
        name: user.name,
        email: user.email,
        image: user.image,
        oauthCompleted: true,
      })),
      message: '找到多個匹配的用戶，請選擇要使用的 OAuth Provider',
    });
  } catch (error) {
    console.error('Get user provider error:', error);
    return res.status(500).json({
      success: false,
      message: '獲取用戶信息失敗',
    });
  }
}

