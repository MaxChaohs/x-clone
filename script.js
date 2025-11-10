// 路由系統
class Router {
    constructor() {
        this.routes = {
            '/home': 'home-page',
            '/messages': 'messages-page',
            '/compose/post': 'compose-post-page'
        };
        this.currentUserId = null;
        this.init();
    }

    init() {
        // 從認證系統獲取用戶信息
        this.updateUserInfo();

        // 監聽導航點擊事件
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const route = item.getAttribute('data-route');
                if (route) {
                    this.navigate(route);
                } else {
                    console.warn('No route found for nav item:', item);
                }
            });
        });

        // 監聽瀏覽器前進/後退按鈕
        window.addEventListener('popstate', (e) => {
            this.renderPage(window.location.pathname);
        });

        // 初始載入時根據當前 URL 顯示對應頁面
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '') {
            // 如果是根路徑，先更新 URL 到 /home
            window.history.replaceState({}, '', '/home');
            this.renderPage('/home');
        } else {
            this.renderPage(currentPath);
        }
    }

    navigate(path) {
        // 確保路徑以 / 開頭
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // 更新 URL（不重新載入頁面）
        try {
            // 使用 pushState 更新 URL
            window.history.pushState({ path: path }, '', path);
            // 確保 URL 已更新
            if (window.location.pathname !== path) {
                // 如果 pushState 沒有更新 URL（例如在 file:// 協議下），使用 replaceState
                window.history.replaceState({ path: path }, '', path);
            }
            this.renderPage(path);
        } catch (error) {
            console.error('Error navigating to:', path, error);
            // 如果 pushState 失敗（例如在 file:// 協議下），至少更新頁面顯示
            this.renderPage(path);
        }
    }

    updateUserInfo() {
        const user = auth.getCurrentUser();
        if (user) {
            this.currentUserId = user.userID;
            
            // 更新用戶信息顯示
            const userNameEl = document.querySelector('.user-name');
            const userHandleEl = document.querySelector('.user-handle');
            if (userNameEl) userNameEl.textContent = user.name;
            if (userHandleEl) userHandleEl.textContent = `@${user.userID}`;
            
            // 更新 Profile 導航鏈接
            const profileNav = document.getElementById('profileNav');
            if (profileNav) {
                const profileRoute = `/${user.userID}`;
                profileNav.href = profileRoute;
                profileNav.setAttribute('data-route', profileRoute);
                this.routes[profileRoute] = 'profile-page';
            }
        }
    }

    renderPage(path) {
        // 隱藏所有頁面
        document.querySelectorAll('.page-content').forEach(page => {
            page.style.display = 'none';
        });

        // 移除所有導航項的活動狀態
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // 處理根路徑或空路徑，重定向到首頁
        if (path === '/' || path === '') {
            this.navigate('/home');
            return;
        }

        // 確定要顯示的頁面 ID
        let pageId = this.routes[path];
        
        // 如果路徑是 user-id 格式（不是已知路由），顯示 profile 頁面
        if (!pageId) {
            // 檢查是否是 user-id 格式（單一路徑段，且不是已知路由）
            const pathParts = path.split('/').filter(p => p);
            if (pathParts.length === 1) {
                // 可能是 user-id
                pageId = 'profile-page';
                // 更新路由映射
                this.routes[path] = 'profile-page';
            } else {
                // 未知路由，默認顯示首頁
                pageId = 'home-page';
                if (path !== '/home') {
                    this.navigate('/home');
                    return;
                }
            }
        }

        // 顯示對應的頁面
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.style.display = 'block';
        }

        // 高亮對應的導航項
        const activeNav = document.querySelector(`[data-route="${path}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
    }
}

// 頁面載入完成後初始化
let router; // 全局變量，方便調試
const API_BASE_URL = 'http://localhost:3000'; // 後端 API 地址

document.addEventListener('DOMContentLoaded', function() {
    // 處理 OAuth 回調
    handleOAuthCallback();

    // 檢查登入狀態
    checkAuthStatus();

    // 初始化路由系統
    router = new Router();

    // 初始化認證 UI
    initAuthUI();
});

// 處理 OAuth 回調
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    const error = urlParams.get('error');

    if (error) {
        // OAuth 錯誤
        console.error('OAuth error:', error);
        alert('OAuth 登入失敗，請重試');
        // 清除 URL 參數
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    if (token && userParam) {
        try {
            // 解析用戶信息
            const user = JSON.parse(decodeURIComponent(userParam));
            
            // 保存到本地存儲（與現有認證系統兼容）
            const result = auth.oauthLogin(user.provider, user.providerId, user.name, user.email);
            
            if (result.success) {
                // 清除 URL 參數
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // 更新認證狀態
                checkAuthStatus();
                if (router) {
                    router.updateUserInfo();
                    router.navigate('/home');
                }
            }
        } catch (error) {
            console.error('Error parsing OAuth callback:', error);
            alert('處理 OAuth 回調時發生錯誤');
        }
    }
}

// 檢查認證狀態
function checkAuthStatus() {
    const authPage = document.getElementById('auth-page');
    const mainApp = document.getElementById('mainApp');
    const sidebar = document.querySelector('.sidebar');

    if (auth.isAuthenticated()) {
        // 已登入，顯示主應用
        if (authPage) authPage.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (sidebar) sidebar.style.display = 'flex';
    } else {
        // 未登入，顯示登入頁面
        if (authPage) authPage.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
    }
}

// 初始化認證 UI
function initAuthUI() {
    // 登入/註冊標籤切換
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    authTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabType = this.getAttribute('data-tab');
            
            // 更新標籤狀態
            authTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // 切換表單
            if (tabType === 'login') {
                if (loginForm) loginForm.style.display = 'flex';
                if (registerForm) registerForm.style.display = 'none';
            } else {
                if (loginForm) loginForm.style.display = 'none';
                if (registerForm) registerForm.style.display = 'flex';
            }
        });
    });

    // 用戶ID 登入
    const loginBtn = document.getElementById('loginBtn');
    const loginUserID = document.getElementById('loginUserID');
    const loginError = document.getElementById('loginError');

    if (loginBtn && loginUserID) {
        loginBtn.addEventListener('click', function() {
            const userID = loginUserID.value.trim();
            const result = auth.login(userID);
            
            if (result.success) {
                if (loginError) loginError.textContent = '';
                checkAuthStatus();
                if (router) {
                    router.updateUserInfo();
                    router.navigate('/home');
                }
            } else {
                if (loginError) loginError.textContent = result.message || '登入失敗';
            }
        });

        // Enter 鍵登入
        loginUserID.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });
    }

    // 用戶ID 註冊
    const registerBtn = document.getElementById('registerBtn');
    const registerUserID = document.getElementById('registerUserID');
    const registerName = document.getElementById('registerName');
    const registerError = document.getElementById('registerError');

    if (registerBtn && registerUserID && registerName) {
        registerBtn.addEventListener('click', function() {
            const userID = registerUserID.value.trim();
            const name = registerName.value.trim();
            
            const result = auth.register(userID, name);
            
            if (result.success) {
                if (registerError) registerError.textContent = '';
                checkAuthStatus();
                if (router) {
                    router.updateUserInfo();
                    router.navigate('/home');
                }
            } else {
                if (registerError) registerError.textContent = result.message || '註冊失敗';
            }
        });

        // Enter 鍵註冊
        [registerUserID, registerName].forEach(input => {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    registerBtn.click();
                }
            });
        });

        // 實時驗證用戶ID格式
        registerUserID.addEventListener('input', function() {
            const userID = this.value.trim();
            const validation = auth.validateUserID(userID);
            
            if (userID && !validation.valid) {
                if (registerError) registerError.textContent = validation.message;
            } else {
                if (registerError) registerError.textContent = '';
            }
        });
    }

    // OAuth 登入（後端支持）
    const googleOAuth = document.getElementById('googleOAuth');
    const githubOAuth = document.getElementById('githubOAuth');
    const facebookOAuth = document.getElementById('facebookOAuth');

    if (googleOAuth) {
        googleOAuth.addEventListener('click', function() {
            // 重定向到後端 OAuth 端點
            window.location.href = `${API_BASE_URL}/auth/google`;
        });
    }

    if (githubOAuth) {
        githubOAuth.addEventListener('click', function() {
            window.location.href = `${API_BASE_URL}/auth/github`;
        });
    }

    if (facebookOAuth) {
        facebookOAuth.addEventListener('click', function() {
            window.location.href = `${API_BASE_URL}/auth/facebook`;
        });
    }

    // 用戶資訊點擊事件 - 顯示/隱藏 logout popup
    const userInfo = document.getElementById('userInfo');
    const logoutPopup = document.getElementById('logoutPopup');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userInfo) {
        userInfo.addEventListener('click', function(e) {
            e.stopPropagation();
            if (logoutPopup) logoutPopup.classList.toggle('show');
        });
    }

    // Logout 按鈕點擊事件
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            auth.logout();
            if (logoutPopup) logoutPopup.classList.remove('show');
            checkAuthStatus();
            // 清空表單
            if (loginUserID) loginUserID.value = '';
            if (registerUserID) registerUserID.value = '';
            if (registerName) registerName.value = '';
        });
    }

    // 點擊其他地方關閉 popup
    document.addEventListener('click', function(e) {
        if (userInfo && !userInfo.contains(e.target) && 
            logoutPopup && !logoutPopup.contains(e.target)) {
            if (logoutPopup) logoutPopup.classList.remove('show');
        }
    });

    // 防止 popup 內的點擊事件冒泡
    if (logoutPopup) {
        logoutPopup.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
}
