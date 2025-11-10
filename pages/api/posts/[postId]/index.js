import { getServerSession } from 'next-auth/next';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    const { postId } = req.query;

    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({
        success: false,
        message: '貼文ID 無效',
      });
    }

    const client = await clientPromise;
    const db = client.db();
    const posts = db.collection('posts');

    // 获取文章
    const post = await posts.findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '貼文不存在',
      });
    }

    // 获取该文章的留言（comments）
    const comments = post.comments || [];

    return res.status(200).json({
      success: true,
      post: {
        id: post._id.toString(),
        content: post.content,
        author: post.author,
        likes: post.likes || [],
        comments: comments,
        repostCount: post.repostCount || 0,
        repost: post.repost || null,
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error('Get post error:', error);
    return res.status(500).json({
      success: false,
      message: '獲取貼文失敗',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

