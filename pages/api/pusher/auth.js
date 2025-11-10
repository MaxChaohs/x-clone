import { getServerSession } from 'next-auth/next';
import { pusherServer } from '@/lib/pusher';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { socket_id, channel_name } = req.body;

  if (!pusherServer) {
    return res.status(503).json({ 
      error: 'Pusher 未配置，實時功能不可用' 
    });
  }

  try {
    const auth = pusherServer.authorizeChannel(socket_id, channel_name);
    return res.status(200).json(auth);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

