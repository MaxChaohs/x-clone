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

      return res.status(200).json({
        success: true,
        posts: allPosts.map((post) => ({
          id: post._id.toString(),
          content: post.content,
          author: post.author,
          likes: post.likes || [],
          comments: post.comments || [],
          repostCount: post.repostCount || 0,
          repost: post.repost || null,
          createdAt: post.createdAt,
        })),
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

      // 如果 session 中没有 userID，从数据库查找
      if (!authorUserID && session.user?.email) {
        // 尝试通过 email 查找用户
        const dbUser = await users.findOne({ email: session.user.email });
        console.log('Database user lookup:', {
          email: session.user.email,
          found: !!dbUser,
          hasUserID: dbUser ? !!dbUser.userID : false,
          userID: dbUser?.userID,
          user: dbUser ? {
            userID: dbUser.userID,
            name: dbUser.name,
            email: dbUser.email,
            oauthCompleted: dbUser.oauthCompleted,
          } : null,
        });
        
        if (dbUser) {
          if (dbUser.userID) {
            authorUserID = dbUser.userID;
            console.log('Found userID for post creation from database:', authorUserID);
          } else {
            // 如果用户存在但没有 userID，尝试通过 accounts 集合查找
            console.warn('User found but no userID, trying to find via accounts:', {
              email: session.user.email,
              userId: dbUser._id.toString(),
              name: dbUser.name,
            });
            
            // 通过 accounts 集合查找关联的用户
            const accounts = db.collection('accounts');
            const account = await accounts.findOne({ 
              userId: dbUser._id,
              provider: { $in: ['google', 'github', 'facebook'] },
            });
            
            if (account) {
              // 如果找到 account，说明用户已经通过 OAuth 登录
              // 尝试查找其他有 userID 的用户记录（通过 email）
              const userWithUserID = await users.findOne({
                email: session.user.email,
                userID: { $ne: null },
              });
              
              if (userWithUserID && userWithUserID.userID) {
                authorUserID = userWithUserID.userID;
                console.log('Found userID from another user record:', authorUserID);
                
                // 更新当前用户记录，设置 userID
                await users.updateOne(
                  { _id: dbUser._id },
                  { $set: { userID: authorUserID } }
                );
                console.log('Updated user record with userID:', authorUserID);
              } else {
                // 如果找不到有 userID 的用户记录，生成一个临时的 userID
                // 使用 email 的前缀作为 userID
                const tempUserID = session.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                authorUserID = tempUserID;
                
                // 更新用户记录，设置 userID
                await users.updateOne(
                  { _id: dbUser._id },
                  { $set: { userID: authorUserID } }
                );
                console.log('Generated and set temporary userID:', authorUserID);
              }
            } else {
              // 如果找不到 account，生成一个临时的 userID
              const tempUserID = session.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');
              authorUserID = tempUserID;
              
              // 更新用户记录，设置 userID
              await users.updateOne(
                { _id: dbUser._id },
                { $set: { userID: authorUserID } }
              );
              console.log('Generated and set temporary userID (no account):', authorUserID);
            }
          }
        } else {
          // 如果通过 email 找不到用户，记录警告
          console.warn('Cannot find user by email:', {
            email: session.user.email,
          });
        }
      }

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

