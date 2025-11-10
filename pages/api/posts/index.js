import { getServerSession } from 'next-auth/next';
import clientPromise from '@/lib/mongodb';
import { pusherServer } from '@/lib/pusher';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const session = await getServerSession(req, res);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: '未登入',
        });
      }

      const { filter } = req.query; // 'all' or 'following'
      const client = await clientPromise;
      const db = client.db();
      const posts = db.collection('posts');
      const users = db.collection('users');

      let query = {};

      // 如果是 following 模式，只获取 follow 的用户发布的文章
      if (filter === 'following') {
        // 获取当前用户的 follow 列表
        const currentUser = await users.findOne({ 
          $or: [
            { userID: session.user?.userID },
            { email: session.user?.email }
          ]
        });

        const followingList = currentUser?.following || [];
        
        if (followingList.length === 0) {
          // 如果没有 follow 任何人，返回空列表
          return res.status(200).json({
            success: true,
            posts: [],
          });
        }

        // 查询 follow 的用户发布的文章
        query = {
          'author.userID': { $in: followingList }
        };
      }

      const allPosts = await posts
        .find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      // 獲取當前用戶的 userID
      let currentUserID = session.user?.userID;
      if (!currentUserID && session.user?.email) {
        const currentUser = await users.findOne({ email: session.user.email });
        if (currentUser && currentUser.userID) {
          currentUserID = currentUser.userID;
        }
      }

      // 檢查每個貼文是否已被當前用戶轉發
      const postsWithRepostStatus = await Promise.all(
        allPosts.map(async (post) => {
          let isReposted = false;
          if (currentUserID) {
            const repostedPost = await posts.findOne({
              'repost.originalPostId': post._id.toString(),
              'author.userID': currentUserID,
            });
            isReposted = !!repostedPost;
          }

          return {
            id: post._id.toString(),
            content: post.content,
            author: post.author,
            likes: post.likes || [],
            comments: post.comments || [],
            repostCount: post.repostCount || 0,
            repost: post.repost || null,
            isReposted: isReposted,
            createdAt: post.createdAt,
          };
        })
      );

      return res.status(200).json({
        success: true,
        posts: postsWithRepostStatus,
      });
    } catch (error) {
      console.error('Get posts error:', error);
      return res.status(500).json({
        success: false,
        message: '獲取貼文失敗',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  } else if (req.method === 'POST') {
    try {
      const session = await getServerSession(req, res);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: '未登入',
        });
      }

      const { content } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '貼文內容不能為空',
        });
      }

      const client = await clientPromise;
      const db = client.db();
      const posts = db.collection('posts');
      const users = db.collection('users');

      // 确保 userID 存在
      let authorUserID = session.user?.userID;
      
      // 调试日志
      console.log('Creating post - session check:', {
        sessionUserID: session.user?.userID,
        sessionEmail: session.user?.email,
        sessionName: session.user?.name,
        sessionUser: session.user,
      });

      // 如果 session 中没有 userID，无法创建贴文
      // 注意：不要通过 email 查找用户，因为同一个 email 可能对应不同的 provider 和不同的 userID
      // 应该通过 session 中的 userID 来查找用户

      if (!authorUserID) {
        console.error('Cannot create post: no userID', {
          sessionUser: session.user,
          sessionEmail: session.user?.email,
        });
        return res.status(400).json({
          success: false,
          message: '無法識別用戶身份，請重新登入',
        });
      }

      console.log('Creating post with userID:', authorUserID);

      const newPost = {
        content: content.trim(),
        author: {
          userID: authorUserID,
          name: session.user.name || 'Unknown',
          email: session.user.email || null,
          image: session.user.image || null,
        },
        likes: [],
        comments: [],
        createdAt: new Date(),
      };

      const result = await posts.insertOne(newPost);
      const postId = result.insertedId.toString();

      // 使用 Pusher 推送新貼文（如果配置了 Pusher）
      try {
        if (pusherServer) {
          await pusherServer.trigger('posts', 'new-post', {
            id: postId,
            ...newPost,
          });
        }
      } catch (pusherError) {
        // Pusher 錯誤不應該阻止貼文創建
        console.warn('Pusher error:', pusherError);
      }

      return res.status(200).json({
        success: true,
        post: {
          id: postId,
          ...newPost,
        },
      });
    } catch (error) {
      console.error('Create post error:', error);
      return res.status(500).json({
        success: false,
        message: '發文失敗',
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

