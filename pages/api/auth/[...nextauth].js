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
        
        // 保存 provider 信息到 token，以便后续查找用户
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        
        // 先通過 provider 和 providerId 查找（最可靠）
        let dbUser = await users.findOne({
          provider: account.provider,
          providerId: account.providerAccountId,
          oauthCompleted: true,
        });
        
        // 注意：不要通过 email 查找用户，因为同一个 email 可能对应不同的 provider 和不同的 userID
        // 不同 provider 应该创建不同的用户记录，即使 email 相同
        
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

        // 注意：不要通过 email 查找用户，因为同一个 email 可能对应不同的 provider 和不同的 userID
        // 不同 provider 应该创建不同的用户记录，即使 email 相同
        // 应该通过 account 的 provider 和 providerId 来查找用户
        if (!dbUser && token.provider && token.providerAccountId) {
          const accounts = db.collection('accounts');
          const account = await accounts.findOne({
            provider: token.provider,
            providerAccountId: token.providerAccountId,
          });
          
          if (account) {
            dbUser = await users.findOne({ _id: account.userId });
          }
        }

        if (dbUser) {
          session.user.id = dbUser._id.toString();
          session.user.userID = dbUser.userID || `${dbUser.provider}_${dbUser.providerId}`;
          session.user.name = dbUser.name || session.user.name;
          session.user.image = dbUser.image || session.user.image;
          session.user.email = dbUser.email || session.user.email;
          session.user.provider = dbUser.provider || token.provider || 'unknown';
          
          // 调试日志
          console.log('Session callback: 找到用戶', {
            userID: session.user.userID,
            email: session.user.email,
            provider: session.user.provider,
          });
        } else {
          // 如果找不到用戶，使用 token 中的信息
          if (token.userID) {
            session.user.id = token.id;
            session.user.userID = token.userID;
            session.user.email = token.email || session.user.email;
            session.user.provider = token.provider || 'unknown';
            
            console.log('Session callback: 使用 token 中的 userID', {
              userID: session.user.userID,
              provider: session.user.provider,
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
        // 注意：不要通过 email 查找用户，因为同一个 email 可能对应不同的 provider 和不同的 userID
        // 应该通过 account 的 provider 和 providerId 来查找用户
        if (!session.user.userID) {
          // 通过 account 查找用户
          const accounts = db.collection('accounts');
          const account = await accounts.findOne({
            provider: token.provider || 'unknown',
            providerAccountId: token.providerAccountId || 'unknown',
          });
          
          if (account) {
            const accountUser = await users.findOne({ _id: account.userId });
            if (accountUser && accountUser.userID) {
              session.user.userID = accountUser.userID;
              console.log('Session callback: 通过 account 找到 userID', {
                userID: session.user.userID,
                provider: token.provider,
              });
            }
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

      // 注意：不同 provider 的账号应该使用不同的 userID，即使 email 相同
      // 这样每个 provider 的账号都是独立的，不会共用贴文和 message
      // 如果用户想要链接账号，应该通过其他方式（比如手动链接）
      
      // 检查是否已有该 provider 的完整记录（已完成 OAuth）
      const existingProviderUser = await users.findOne({
        provider: account.provider,
        providerId: account.providerAccountId,
        oauthCompleted: true,
      });

      if (existingProviderUser) {
        // 如果已有该 provider 的完整记录，直接登入
        console.log('找到该 provider 的完整用户记录，直接登入:', {
          userID: existingProviderUser.userID,
          provider: account.provider,
        });
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
        // 檢查該 userID 是否已被其他 provider 使用
        // 如果已被使用，創建新的 userID（確保每個 provider 使用不同的 userID）
        let finalUserID = pendingUser.userID;
        const existingUserWithSameID = await users.findOne({
          userID: pendingUser.userID,
          provider: { $ne: account.provider }, // 不同 provider
          oauthCompleted: true,
        });
        
        if (existingUserWithSameID) {
          // 如果該 userID 已被其他 provider 使用，創建新的 userID
          finalUserID = `${account.provider}_${account.providerAccountId}`;
          console.log('userID 已被其他 provider 使用，創建新的 userID:', {
            oldUserID: pendingUser.userID,
            newUserID: finalUserID,
            provider: account.provider,
          });
        }
        
        // 更新用戶記錄，關聯 OAuth 信息
        console.log('找到待關聯用戶:', {
          userID: finalUserID,
          provider: account.provider,
          providerId: account.providerAccountId,
        });
        
        await users.updateOne(
          { _id: pendingUser._id },
          {
            $set: {
              userID: finalUserID, // 使用最終確定的 userID
              providerId: account.providerAccountId,
              email: user.email,
              image: user.image || profile?.picture,
              oauthCompleted: true,
              updatedAt: new Date(),
            },
          }
        );
        
        console.log('用戶 OAuth 關聯完成:', {
          userID: finalUserID,
          email: user.email,
          provider: account.provider,
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
  // 明確設定 NEXTAUTH_URL，避免 redirect_uri_mismatch 錯誤
  url: process.env.NEXTAUTH_URL,
});

