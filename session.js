// session.js - Client-side session management
// Handles localStorage session storage for development

export function saveSession(sess) {
  try {
    localStorage.setItem('mk_session', JSON.stringify(sess));
    console.log('✅ Session saved:', sess);
    
    // Dispatch event for cross-component updates
    window.dispatchEvent(new CustomEvent('mk-session-changed', { 
      detail: { session: sess, type: 'login' } 
    }));
    
    return true;
  } catch (error) {
    console.error('❌ Failed to save session:', error);
    return false;
  }
}

export function loadSession() {
  try {
    const sessionData = localStorage.getItem('mk_session');
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (error) {
    console.error('❌ Failed to load session:', error);
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem('mk_session');
    console.log('🗑️ Session cleared');
    
    // Dispatch event for cross-component updates
    window.dispatchEvent(new CustomEvent('mk-session-changed', { 
      detail: { session: null, type: 'logout' } 
    }));
    
    return true;
  } catch (error) {
    console.error('❌ Failed to clear session:', error);
    return false;
  }
}

export function isLoggedIn() {
  const session = loadSession();
  return !!(session && session.userId);
}

export function getCurrentUser() {
  const session = loadSession();
  return session ? {
    userId: session.userId,
    username: session.username,
    walletAddress: session.walletAddress,
    loginTime: session.loginTime
  } : null;
}

// Mock login function for development
export async function mockLogin(username = 'Player') {
  try {
    const response = await fetch('/api/auth/mock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username })
    });

    const data = await response.json();
    
    if (data.ok && data.session) {
      saveSession(data.session);
      return { success: true, session: data.session };
    } else {
      throw new Error(data.error || 'Login failed');
    }
  } catch (error) {
    console.error('❌ Mock login failed:', error);
    return { success: false, error: error.message };
  }
}

// Mock logout function
export function mockLogout() {
  clearSession();
  return { success: true };
}

// Initialize session listener for debugging
if (typeof window !== 'undefined') {
  window.addEventListener('mk-session-changed', (event) => {
    console.log('🔄 Session changed:', event.detail);
  });
}