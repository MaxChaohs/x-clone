import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  const session = await getServerSession(req, res);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: '未登入',
    });
  }

  const client = await clientPromise;
  const db = client.db();
  const drafts = db.collection('drafts');
  const users = db.collection('users');

  // 确保 userID 存在
  let userID = session.user?.userID;
  let userEmail = session.user?.email;

  // 如果 session 中没有 userID，从数据库查找
  if (!userID && userEmail) {
    const dbUser = await users.findOne({ email: userEmail });
    if (dbUser && dbUser.userID) {
      userID = dbUser.userID;
    }
  }

  if (!userID && !userEmail) {
    return res.status(400).json({
      success: false,
      message: '無法識別用戶身份',
    });
  }

  if (req.method === 'POST') {
    // 保存草稿
    try {
      const { content } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '草稿內容不能為空',
        });
      }

      const draft = {
        content: content.trim(),
        author: {
          userID: userID || null,
          email: userEmail || null,
        },
        createdAt: new Date(),
      };

      const result = await drafts.insertOne(draft);

      return res.status(200).json({
        success: true,
        draft: {
          id: result.insertedId.toString(),
          ...draft,
          createdAt: draft.createdAt.toISOString(),
        },
      });
    } catch (error) {
      console.error('Save draft error:', error);
      return res.status(500).json({
        success: false,
        message: '保存草稿失敗',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } else if (req.method === 'GET') {
    // 获取草稿列表
    try {
      const query = userID
        ? { 'author.userID': userID }
        : { 'author.email': userEmail };

      const allDrafts = await drafts
        .find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return res.status(200).json({
        success: true,
        drafts: allDrafts.map((draft) => ({
          id: draft._id.toString(),
          content: draft.content,
          createdAt: draft.createdAt,
        })),
      });
    } catch (error) {
      console.error('Get drafts error:', error);
      return res.status(500).json({
        success: false,
        message: '獲取草稿失敗',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } else if (req.method === 'DELETE') {
    // 删除草稿
    try {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          message: '草稿ID 無效',
        });
      }

      const query = userID
        ? { _id: new ObjectId(id), 'author.userID': userID }
        : { _id: new ObjectId(id), 'author.email': userEmail };

      const result = await drafts.deleteOne(query);

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: '草稿不存在或無權限刪除',
        });
      }

      return res.status(200).json({
        success: true,
        message: '草稿已刪除',
      });
    } catch (error) {
      console.error('Delete draft error:', error);
      return res.status(500).json({
        success: false,
        message: '刪除草稿失敗',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } else {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }
}

