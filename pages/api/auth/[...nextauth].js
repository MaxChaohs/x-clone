import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import clientPromise from '@/lib/mongodb';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import bcrypt from 'bcryptjs';

// 驗證必要的環境變量
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('警告: GOOGLE_CLIENT_ID 或 GOOGLE_CLIENT_SECRET 未設置');
}

if (!process.env.MONGODB_URI) {
  console.error('錯誤: MONGODB_URI 未設置');
}

if (!process.env.NEXTAUTH_SECRET) {
  console.warn('警告: NEXTAUTH_SECRET 未設置，這可能導致安全問題');
}

export default NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        userID: { label: 'UserID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.userID) {
          return null;
        }

        const client = await clientPromise;
        const db = client.db();
        const users = db.collection('users');

        // 查找用戶
        const user = await users.findOne({ userID: credentials.userID });

        if (user) {
          return {
            id: user._id.toString(),
            userID: user.userID,
            name: user.name,
            email: user.email,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // 首次登入時，user 對象可用
      if (user) {
        token.id = user.id;
        token.userID = user.userID;
        token.email = user.email;
      }
      
      // 如果是 OAuth 登入，從數據庫獲取用戶信息
      if (account && account.provider !== 'credentials') {
        const client = await clientPromise;
        const db = client.db();
        const users = db.collection('users');
        
        // 先通過 provider 和 providerId 查找（最可靠）
        let dbUser = await users.findOne({
          provider: account.provider,
          providerId: account.providerAccountId,
          oauthCompleted: true,
        });
        
        // 如果找不到，通過 email 查找
        if (!dbUser && user?.email) {
          dbUser = await users.findOne({
            email: user.email,
            oauthCompleted: true,
          });
        }
        
        // 如果還是找不到，查找所有匹配 email 的用戶（包括未完成的）
        if (!dbUser && user?.email) {
          dbUser = await users.findOne({
            email: user.email,
          });
        }
        
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.userID = dbUser.userID;
          token.email = dbUser.email || user?.email;
          console.log('JWT callback: 找到用戶', {
            userID: dbUser.userID,
            email: token.email,
          });
        } else {
          console.warn('JWT callback: 找不到用戶', {
            provider: account.provider,
            providerId: account.providerAccountId,
            email: user?.email,
          });
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        const client = await clientPromise;
        const db = client.db();
        const users = db.collection('users');

        // 從 token 中獲取用戶信息
        let dbUser = null;
        
        // 優先通過 token 中的 userID 查找
        if (token.userID) {
          dbUser = await users.findOne({
            userID: token.userID,
            oauthCompleted: true,
          });
        }

        // 如果找不到，通過 email 查找
        if (!dbUser && token.email) {
          dbUser = await users.findOne({
            email: token.email,
            oauthCompleted: true,
          });
        }

        // 如果還是找不到，查找所有匹配 email 的用戶（包括未完成的）
        if (!dbUser && session.user.email) {
          dbUser = await users.findOne({
            email: session.user.email,
          });
        }

        if (dbUser) {
          session.user.id = dbUser._id.toString();
          session.user.userID = dbUser.userID || `${dbUser.provider}_${dbUser.providerId}`;
          session.user.name = dbUser.name || session.user.name;
          session.user.image = dbUser.image || session.user.image;
          session.user.email = dbUser.email || session.user.email;
          
          // 调试日志
          console.log('Session callback: 找到用戶', {
            userID: session.user.userID,
            email: session.user.email,
          });
        } else {
          // 如果找不到用戶，使用 token 中的信息
          if (token.userID) {
            session.user.id = token.id;
            session.user.userID = token.userID;
            session.user.email = token.email || session.user.email;
            
            console.log('Session callback: 使用 token 中的 userID', {
              userID: session.user.userID,
            });
          } else {
            // 如果找不到用戶，記錄警告
            console.warn('Session callback: 找不到用戶', {
              email: session.user.email,
              tokenUserID: token.userID,
              tokenEmail: token.email,
            });
          }
        }
        
        // 确保 userID 总是被设置
        if (!session.user.userID && session.user.email) {
          // 最后一次尝试：通过 email 查找用户
          const fallbackUser = await users.findOne({ email: session.user.email });
          if (fallbackUser) {
            session.user.userID = fallbackUser.userID;
            console.log('Session callback: 通过 email 找到 userID', {
              userID: session.user.userID,
            });
          }
        }
      }
      return session;
    },
    async signIn({ user, account, profile }, req) {
      if (account?.provider === 'credentials') {
        return true;
      }

      // OAuth 登入：關聯或創建用戶
      const client = await clientPromise;
      const db = client.db();
      const users = db.collection('users');

      console.log('OAuth signIn callback:', {
        provider: account.provider,
        providerId: account.providerAccountId,
        email: user.email,
      });

      // 登入流程：先檢查是否已有該 Provider 的用戶（已完成 OAuth）
      const existingUser = await users.findOne({
        provider: account.provider,
        providerId: account.providerAccountId,
        oauthCompleted: true,
      });

      if (existingUser) {
        // 用戶已存在且已完成 OAuth，直接登入
        console.log('找到已完成的用戶:', {
          userID: existingUser.userID,
          email: existingUser.email,
        });
        
        // 確保 NextAuth adapter 能夠找到賬戶記錄
        // 檢查 accounts 集合中是否有對應的賬戶記錄
        const accounts = db.collection('accounts');
        const existingAccount = await accounts.findOne({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        
        if (!existingAccount) {
          // 如果沒有找到賬戶記錄，手動創建一個
          console.log('未找到賬戶記錄，手動創建');
          await accounts.insertOne({
            userId: existingUser._id,
            type: 'oauth',
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          });
          console.log('賬戶記錄創建完成');
        }
        
        return true;
      }

      // 查找該 Provider 下所有未完成 OAuth 的用戶記錄（不限制時間）
      // 優先查找最近創建的，如果沒有則查找所有未完成的
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // 先查找最近5分鐘內的待關聯記錄
      let pendingUser = await users.findOne({
        provider: account.provider,
        oauthCompleted: false,
        createdAt: { $gte: fiveMinutesAgo },
      });

      // 如果沒有找到，查找所有該 Provider 下未完成 OAuth 的用戶（按創建時間排序，取最新的）
      if (!pendingUser) {
        pendingUser = await users.findOne(
          {
            provider: account.provider,
            oauthCompleted: false,
          },
          {
            sort: { createdAt: -1 }, // 按創建時間降序，取最新的
          }
        );
      }

      if (pendingUser) {
        // 更新用戶記錄，關聯 OAuth 信息
        console.log('找到待關聯用戶:', {
          userID: pendingUser.userID,
          provider: pendingUser.provider,
          providerId: account.providerAccountId,
        });
        
        await users.updateOne(
          { _id: pendingUser._id },
          {
            $set: {
              providerId: account.providerAccountId,
              email: user.email,
              image: user.image || profile?.picture,
              oauthCompleted: true,
              updatedAt: new Date(),
            },
          }
        );
        
        console.log('用戶 OAuth 關聯完成:', {
          userID: pendingUser.userID,
          email: user.email,
        });
        
        // 確保 NextAuth adapter 能夠找到賬戶記錄
        // 檢查 accounts 集合中是否有對應的賬戶記錄
        const accounts = db.collection('accounts');
        const existingAccount = await accounts.findOne({
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        });
        
        if (!existingAccount) {
          // 如果沒有找到賬戶記錄，手動創建一個
          console.log('未找到賬戶記錄，手動創建');
          await accounts.insertOne({
            userId: pendingUser._id,
            type: 'oauth',
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          });
          console.log('賬戶記錄創建完成');
        }
        
        // 返回 true，允許 NextAuth adapter 創建賬戶記錄
        return true;
      }

      // 如果都沒有，創建新用戶（這種情況不應該發生，但保留作為後備）
      console.warn('未找到待關聯用戶，創建新用戶');
      const autoUserID = `${account.provider}_${account.providerAccountId}`;
      await users.insertOne({
        userID: autoUserID,
        name: user.name || profile?.name || user.email?.split('@')[0],
        email: user.email,
        provider: account.provider,
        providerId: account.providerAccountId,
        image: user.image || profile?.picture,
        oauthCompleted: true,
        createdAt: new Date(),
      });

      // 返回 true，允許 NextAuth adapter 創建賬戶記錄
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 天
  },
  secret: process.env.NEXTAUTH_SECRET,
});

