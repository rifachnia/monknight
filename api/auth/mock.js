// /api/auth/mock.js - Development Mock Authentication
// This will be replaced with Privy + Monad Games ID when ready

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username = 'Player' } = req.body ? JSON.parse(req.body) : {};
    
    // Generate mock session data
    const session = {
      userId: 'dev-' + Math.random().toString(36).slice(2),
      username: username.trim() || 'Player',
      walletAddress: '0x' + Math.random().toString(16).slice(2, 42).padStart(40, '0'),
      loginTime: new Date().toISOString(),
      provider: 'mock-dev',
      // TODO: Replace with JWT from Privy/Monad Games ID
    };

    console.log('🎮 Mock login successful:', session);
    
    return res.status(200).json({ 
      ok: true, 
      session,
      message: 'Mock login successful (dev mode)' 
    });

  } catch (error) {
    console.error('❌ Mock login error:', error);
    return res.status(400).json({ 
      error: 'Invalid request body' 
    });
  }
}