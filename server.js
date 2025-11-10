const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session 配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 天
    }
}));

// Passport 初始化
app.use(passport.initialize());
app.use(passport.session());

// 序列化用戶（存儲到 session）
passport.serializeUser((user, done) => {
    done(null, user);
});

// 反序列化用戶（從 session 讀取）
passport.deserializeUser((user, done) => {
    done(null, user);
});

// 用戶存儲（實際應用中應該使用數據庫）
const users = {};

// Google OAuth 策略
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
    },
    (accessToken, refreshToken, profile, done) => {
        // 生成唯一的用戶ID（基於 provider 和 providerId）
        const userID = `google_${profile.id}`;
        
        // 如果用戶不存在，創建新用戶
        if (!users[userID]) {
            users[userID] = {
                userID: userID,
                name: profile.displayName || profile.name?.givenName || 'Google User',
                email: profile.emails?.[0]?.value || '',
                provider: 'google',
                providerId: profile.id,
                avatar: profile.photos?.[0]?.value || '',
                createdAt: new Date().toISOString()
            };
        }
        
        return done(null, users[userID]);
    }));
}

// GitHub OAuth 策略
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/auth/github/callback'
    },
    (accessToken, refreshToken, profile, done) => {
        const userID = `github_${profile.id}`;
        
        if (!users[userID]) {
            users[userID] = {
                userID: userID,
                name: profile.displayName || profile.username || 'GitHub User',
                email: profile.emails?.[0]?.value || '',
                provider: 'github',
                providerId: profile.id,
                avatar: profile.photos?.[0]?.value || '',
                createdAt: new Date().toISOString()
            };
        }
        
        return done(null, users[userID]);
    }));
}

// Facebook OAuth 策略
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'email', 'picture']
    },
    (accessToken, refreshToken, profile, done) => {
        const userID = `facebook_${profile.id}`;
        
        if (!users[userID]) {
            users[userID] = {
                userID: userID,
                name: profile.displayName || 'Facebook User',
                email: profile.emails?.[0]?.value || '',
                provider: 'facebook',
                providerId: profile.id,
                avatar: profile.photos?.[0]?.value || '',
                createdAt: new Date().toISOString()
            };
        }
        
        return done(null, users[userID]);
    }));
}

// OAuth 路由
// Google
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/error' }),
    (req, res) => {
        // 成功登入，重定向到前端
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        res.redirect(`${frontendUrl}/auth/callback?token=${req.sessionID}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
    }
);

// GitHub
app.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] })
);

app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/auth/error' }),
    (req, res) => {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        res.redirect(`${frontendUrl}/auth/callback?token=${req.sessionID}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
    }
);

// Facebook
app.get('/auth/facebook',
    passport.authenticate('facebook', { scope: ['email'] })
);

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/auth/error' }),
    (req, res) => {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        res.redirect(`${frontendUrl}/auth/callback?token=${req.sessionID}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
    }
);

// 錯誤頁面
app.get('/auth/error', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(`${frontendUrl}/auth/error`);
});

// 驗證 session
app.get('/api/auth/session', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

// 登出
app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        req.session.destroy();
        res.json({ success: true });
    });
});

// 健康檢查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 啟動服務器
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📝 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
});

