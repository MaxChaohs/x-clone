import clientPromise from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';

// 这个 API 用于修复使用相同 userID 但不同 provider 的用户记录
// 它会为每个 provider 创建唯一的 userID
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res);
    if (!session) {
      return res.status(401).json({ success: false, message: '未登入' });
    }

    const client = await clientPromise;
    const db = client.db();
    const users = db.collection('users');

    // 查找所有使用相同 userID 但不同 provider 的用户记录
    const allUsers = await users.find({ oauthCompleted: true }).toArray();
    
    // 按 userID 分组
    const userIDGroups = {};
    allUsers.forEach(user => {
      if (user.userID) {
        if (!userIDGroups[user.userID]) {
          userIDGroups[user.userID] = [];
        }
        userIDGroups[user.userID].push(user);
      }
    });

    // 找出有多个 provider 的 userID
    const duplicateUserIDs = Object.keys(userIDGroups).filter(
      userID => userIDGroups[userID].length > 1
    );

    if (duplicateUserIDs.length === 0) {
      return res.status(200).json({
        success: true,
        message: '沒有發現重複的 userID',
        fixed: 0,
      });
    }

    // 修复每个重复的 userID
    let fixedCount = 0;
    for (const userID of duplicateUserIDs) {
      const userGroup = userIDGroups[userID];
      
      // 保留第一个 provider 的 userID，为其他 provider 创建新的 userID
      for (let i = 1; i < userGroup.length; i++) {
        const user = userGroup[i];
        const newUserID = `${user.provider}_${user.providerId}`;
        
        // 检查新 userID 是否已存在
        const existingUser = await users.findOne({ userID: newUserID });
        if (existingUser) {
          // 如果新 userID 已存在，使用更长的格式
          const alternativeUserID = `${user.provider}_${user.providerId}_${user._id.toString().slice(-6)}`;
          await users.updateOne(
            { _id: user._id },
            { $set: { userID: alternativeUserID } }
          );
          console.log(`修复用户记录: ${userID} -> ${alternativeUserID} (provider: ${user.provider})`);
        } else {
          await users.updateOne(
            { _id: user._id },
            { $set: { userID: newUserID } }
          );
          console.log(`修复用户记录: ${userID} -> ${newUserID} (provider: ${user.provider})`);
        }
        fixedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `已修复 ${fixedCount} 个重复的 userID`,
      fixed: fixedCount,
      duplicateUserIDs: duplicateUserIDs,
    });
  } catch (error) {
    console.error('Fix duplicate userIDs error:', error);
    return res.status(500).json({
      success: false,
      message: '修复失败',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

