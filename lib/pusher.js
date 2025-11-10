import Pusher from 'pusher';

// 檢查 Pusher 環境變量是否設置，並且不是占位符值
const isPlaceholder = (value) => {
  if (!value) return true;
  const placeholderPatterns = [
    /^your-/i,
    /^placeholder/i,
    /^example/i,
    /^test-/i,
    /^xxx/i,
  ];
  return placeholderPatterns.some(pattern => pattern.test(value));
};

const hasPusherConfig = 
  process.env.PUSHER_APP_ID &&
  process.env.PUSHER_KEY &&
  process.env.PUSHER_SECRET &&
  !isPlaceholder(process.env.PUSHER_APP_ID) &&
  !isPlaceholder(process.env.PUSHER_KEY) &&
  !isPlaceholder(process.env.PUSHER_SECRET);

// 只有在配置了 Pusher 時才創建實例
let pusherServer = null;

if (hasPusherConfig) {
  try {
    const cluster = process.env.PUSHER_CLUSTER || 'us2';
    // 檢查 cluster 是否為占位符
    if (!isPlaceholder(cluster)) {
      pusherServer = new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: cluster,
        useTLS: true,
      });
      console.log('Pusher 初始化成功');
    } else {
      console.warn('Pusher cluster 是占位符值，跳過初始化');
    }
  } catch (error) {
    // 如果 Pusher 初始化失敗，記錄錯誤但不報錯
    console.error('Pusher 初始化失敗:', error.message);
    pusherServer = null;
  }
} else {
  // 如果沒有配置 Pusher，記錄警告
  if (process.env.NODE_ENV === 'development') {
    console.warn('Pusher 未配置或包含占位符值，實時功能將不可用。請在 .env.local 中設置有效的 PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET');
  }
}

export { pusherServer };

