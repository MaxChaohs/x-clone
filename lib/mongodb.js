import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  const error = new Error('Please add your Mongo URI to .env.local');
  console.error('MongoDB 連接錯誤:', error.message);
  throw error;
}

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // 開發環境：使用全局變量避免多次連接
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((error) => {
      console.error('MongoDB 連接失敗:', error.message);
      throw error;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  // 生產環境
  client = new MongoClient(uri, options);
  clientPromise = client.connect().catch((error) => {
    console.error('MongoDB 連接失敗:', error.message);
    throw error;
  });
}

export default clientPromise;

