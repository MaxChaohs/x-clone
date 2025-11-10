// 認證系統
class Auth {
    constructor() {
        this.SESSION_KEY = 'x_session';
        this.USERS_KEY = 'x_users';
        this.SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 天
        this.init();
    }

    init() {
        // 初始化用戶數據（如果不存在）
        if (!localStorage.getItem(this.USERS_KEY)) {
            localStorage.setItem(this.USERS_KEY, JSON.stringify({}));
        }
    }

    // 驗證用戶ID格式
    validateUserID(userID) {
        // 規則：3-20 個字符，只能包含字母、數字、底線和連字符
        const pattern = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!userID || userID.trim() === '') {
            return { valid: false, message: '用戶ID 不能為空' };
        }
        if (!pattern.test(userID)) {
            return { 
                valid: false, 
                message: '用戶ID 必須是 3-20 個字符，只能包含字母、數字、底線和連字符' 
            };
        }
        return { valid: true };
    }

    // 註冊用戶
    register(userID, name, provider = 'local', providerId = null) {
        const validation = this.validateUserID(userID);
        if (!validation.valid) {
            return { success: false, message: validation.message };
        }

        const users = this.getUsers();
        
        // 檢查用戶ID是否已存在
        if (users[userID]) {
            return { success: false, message: '此用戶ID 已被使用' };
        }

        // 創建新用戶
        const newUser = {
            userID: userID,
            name: name || userID,
            provider: provider, // 'local', 'google', 'github', 'facebook'
            providerId: providerId || userID,
            createdAt: new Date().toISOString()
        };

        users[userID] = newUser;
        this.saveUsers(users);

        // 自動登入
        this.createSession(newUser);

        return { success: true, user: newUser };
    }

    // 使用用戶ID登入
    login(userID) {
        if (!userID || userID.trim() === '') {
            return { success: false, message: '請輸入用戶ID' };
        }

        const users = this.getUsers();
        const user = users[userID];

        if (!user) {
            return { success: false, message: '用戶ID 不存在' };
        }

        // 創建 session
        this.createSession(user);

        return { success: true, user: user };
    }

    // OAuth 登入（模擬）
    oauthLogin(provider, providerId, name, email) {
        // 生成唯一的用戶ID（基於 provider 和 providerId）
        // 同一個人使用不同的 OAuth providers 會註冊成不同的 userIDs
        const userID = `${provider}_${providerId}`;
        
        const users = this.getUsers();
        
        // 如果用戶已存在，直接登入
        if (users[userID]) {
            this.createSession(users[userID]);
            return { success: true, user: users[userID] };
        }

        // 否則註冊新用戶
        return this.register(userID, name || email || userID, provider, providerId);
    }

    // 創建 session
    createSession(user) {
        const session = {
            userID: user.userID,
            name: user.name,
            provider: user.provider,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.SESSION_EXPIRY).toISOString()
        };

        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return session;
    }

    // 獲取當前 session
    getSession() {
        const sessionStr = localStorage.getItem(this.SESSION_KEY);
        if (!sessionStr) {
            return null;
        }

        try {
            const session = JSON.parse(sessionStr);
            
            // 檢查 session 是否過期
            if (new Date(session.expiresAt) < new Date()) {
                this.logout();
                return null;
            }

            return session;
        } catch (error) {
            console.error('Error parsing session:', error);
            return null;
        }
    }

    // 檢查是否已登入
    isAuthenticated() {
        return this.getSession() !== null;
    }

    // 登出
    logout() {
        localStorage.removeItem(this.SESSION_KEY);
    }

    // 獲取當前用戶
    getCurrentUser() {
        const session = this.getSession();
        if (!session) {
            return null;
        }

        const users = this.getUsers();
        return users[session.userID] || null;
    }

    // 獲取所有用戶（內部方法）
    getUsers() {
        const usersStr = localStorage.getItem(this.USERS_KEY);
        return usersStr ? JSON.parse(usersStr) : {};
    }

    // 保存用戶數據（內部方法）
    saveUsers(users) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    }
}

// 全局認證實例
const auth = new Auth();

