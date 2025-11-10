import clientPromise from '@/lib/mongodb';
import { z } from 'zod';

const userIDSchema = z.string().regex(/^[a-zA-Z0-9_-]{3,20}$/, {
  message: '用戶ID 必須是 3-20 個字符，只能包含字母、數字、底線和連字符',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { userID, name, provider } = req.body;

    // 驗證用戶ID格式
    const validation = userIDSchema.safeParse(userID);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.errors[0].message,
      });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '顯示名稱不能為空',
      });
    }

    if (!provider || !['google', 'github'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: '請選擇 OAuth Provider',
      });
    }

    const client = await clientPromise;
    const db = client.db();
    const users = db.collection('users');

    // 檢查該 provider 下該 userID 是否已存在
    // 允許同一個 userID 被不同的 provider 使用，因為它們是不同的賬戶
    const existingUser = await users.findOne({ 
      userID,
      provider,
      oauthCompleted: true,
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '此用戶ID 在此 OAuth Provider 下已被使用',
      });
    }

    // 檢查是否有未完成的註冊記錄（同一 provider 和 userID）
    const pendingUser = await users.findOne({
      userID,
      provider,
      oauthCompleted: false,
    });
    if (pendingUser) {
      return res.status(409).json({
        success: false,
        message: '此用戶ID 在此 OAuth Provider 下已有待完成的註冊記錄',
      });
    }

    // 創建新用戶（尚未完成 OAuth，等待用戶完成 OAuth 後關聯）
    const newUser = {
      userID,
      name: name.trim(),
      provider, // 綁定的 OAuth Provider
      providerId: null, // OAuth 完成後才會填入
      email: null,
      image: null,
      oauthCompleted: false, // 標記 OAuth 是否完成
      createdAt: new Date(),
    };

    const result = await users.insertOne(newUser);

    return res.status(200).json({
      success: true,
      user: {
        id: result.insertedId.toString(),
        userID: newUser.userID,
        name: newUser.name,
        provider: newUser.provider,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    // 返回更详细的错误信息以便调试
    const errorMessage = error.message || '註冊失敗，請稍後再試';
    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
