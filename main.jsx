// main.jsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider, usePrivy, useCrossAppAccounts } from "@privy-io/react-auth";

console.log('🚀 main.jsx loading...');

function AuthIsland() {
  const { authenticated, user, ready, login, logout } = usePrivy();
  const { loginWithCrossAppAccount } = useCrossAppAccounts();
  const [addr, setAddr] = useState("");
  const [uname, setUname] = useState("");
  const [initError, setInitError] = useState(null);

  console.log('🔍 AuthIsland render:', { ready, authenticated, hasUser: !!user, hasLogin: !!login });

  // Handle authentication state changes
  useEffect(() => {
    console.log('🔄 AuthIsland useEffect:', { ready, authenticated, hasUser: !!user });
    
    // Clear error state on auth changes
    setInitError(null);
    
    if (!ready) {
      console.log('⏳ Privy SDK not ready yet...');
      return;
    }
    
    if (!authenticated) {
      // Clear auth state when not authenticated
      setAddr("");
      setUname("");
      localStorage.removeItem('mgid_user');
      window.MONKNIGHT_AUTH = null;
      window.dispatchEvent(new CustomEvent("monknight-auth", { 
        detail: { authenticated: false, address: null, username: null } 
      }));
      return;
    }

    // Safety check for user object structure
    if (!user || !user.linkedAccounts || !Array.isArray(user.linkedAccounts)) {
      console.warn('⚠️ User object structure invalid:', user);
      setInitError('Invalid user data structure');
      return;
    }

    // Find cross-app account for Monad Games ID
    const cross = user.linkedAccounts.find(
      (acc) => acc && acc.type === "cross_app" && acc.providerApp?.id === "cmd8euall0037le0my79qpz42"
    );

    if (!cross || !cross.embeddedWallets || !Array.isArray(cross.embeddedWallets)) {
      console.warn('⚠️ Cross-app account or embedded wallets not found:', cross);
      return;
    }

    const address = cross.embeddedWallets[0]?.address || "";
    if (!address) {
      console.warn('⚠️ No wallet address found in cross-app account');
      return;
    }

    setAddr(address);

    // Fetch username with retry logic
    (async () => {
      let retryCount = 0;
      const maxRetries = 3;
      
      const fetchWithRetry = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
          
          const r = await fetch(
            `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${address}`,
            { signal: controller.signal }
          );
          
          clearTimeout(timeoutId);
          
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          }
          
          const j = await r.json();
          const username = j?.username || "";
          setUname(username);
          
          // Store in localStorage for game compatibility
          localStorage.setItem('mgid_user', username || address);
          
          // Publish to game
          window.MONKNIGHT_AUTH = { address, username };
          window.dispatchEvent(new CustomEvent("monknight-auth", { 
            detail: { authenticated: true, address, username } 
          }));
          
          console.log('✅ Privy authentication successful:', { address, username });
          setInitError(null);
          
        } catch (e) {
          console.error(`❌ check-wallet attempt ${retryCount + 1} failed:`, e);
          
          if (retryCount < maxRetries - 1) {
            retryCount++;
            console.log(`🔄 Retrying username fetch (${retryCount}/${maxRetries})...`);
            setTimeout(fetchWithRetry, 1000 * retryCount); // Progressive delay
          } else {
            console.warn('⚠️ All username fetch attempts failed, using address only');
            setUname("");
            localStorage.setItem('mgid_user', address);
            window.MONKNIGHT_AUTH = { address, username: "" };
            window.dispatchEvent(new CustomEvent("monknight-auth", { 
              detail: { authenticated: true, address, username: "" } 
            }));
            setInitError('Failed to fetch username');
          }
        }
      };
      
      await fetchWithRetry();
    })();
  }, [authenticated, user, ready]);

  // Expose login/logout functions globally for game to use
  React.useEffect(() => {
    console.log('🔧 Function exposure effect:', { ready, hasLogin: !!login, hasLogout: !!logout, hasCrossAppLogin: !!loginWithCrossAppAccount });
    
    // Only expose functions when Privy is ready and we have valid functions
    if (ready && login && logout && loginWithCrossAppAccount) {
      // Expose standard login for general use
      window.privyLogin = login;
      // Expose cross-app login specifically for Monad Games ID
      window.privyLoginMonad = () => {
        console.log('🎮 Initiating Monad Games ID cross-app login...');
        return loginWithCrossAppAccount({ appId: 'cmd8euall0037le0my79qpz42' });
      };
      window.privyLogout = logout;
      window.privyReady = true;
      console.log('🔗 Privy functions exposed and ready:', { 
        privyLogin: !!login,
        privyLoginMonad: true,
        privyLogout: !!logout, 
        ready: ready 
      });
      
      // Notify game that Privy is ready with multiple events for better compatibility
      const notifyReady = () => {
        window.dispatchEvent(new CustomEvent('privy-ready', { 
          detail: { ready: true, login, logout } 
        }));
        
        // Also dispatch a generic auth-ready event
        window.dispatchEvent(new CustomEvent('auth-ready', { 
          detail: { ready: true, system: 'privy' } 
        }));
      };
      
      // Immediate notification
      notifyReady();
      
      // Delayed notifications to ensure game is listening
      setTimeout(notifyReady, 100);
      setTimeout(notifyReady, 500);
      setTimeout(() => {
        console.log('🔔 Final Privy ready notification sent');
        notifyReady();
      }, 1000);
      
    } else {
      // Mark as not ready if conditions aren't met
      window.privyReady = false;
      console.log('⏳ Privy not ready yet:', { ready, hasLogin: !!login, hasLogout: !!logout, hasCrossAppLogin: !!loginWithCrossAppAccount });
    }
    
    // Clear auth state when not authenticated
    if (!authenticated) {
      localStorage.removeItem('mgid_user');
      window.MONKNIGHT_AUTH = null;
      window.dispatchEvent(new CustomEvent("monknight-auth", { 
        detail: { authenticated: false, address: null, username: null } 
      }));
    }
    
    return () => {
      delete window.privyLogin;
      delete window.privyLoginMonad;
      delete window.privyLogout;
      window.privyReady = false;
      console.log('🗑️ Privy functions cleaned up');
    };
  }, [ready, login, logout, authenticated, loginWithCrossAppAccount]);

  return (
    <div style={{ position: "fixed", top: 12, left: 12, zIndex: 1000, fontFamily: "sans-serif" }}>
      {/* Debug indicator */}
      <div style={{ 
        position: 'absolute', 
        top: -30, 
        left: 0, 
        fontSize: '10px', 
        color: ready ? '#00ff00' : '#ffaa00',
        background: 'rgba(0,0,0,0.7)',
        padding: '2px 4px',
        borderRadius: '2px'
      }}>
        React: {ready ? 'Ready' : 'Loading...'}
        {initError && (
          <div style={{ color: '#ff6b6b', fontSize: '9px' }}>
            {initError}
          </div>
        )}
      </div>
      
      {!authenticated ? (
        <button 
          onClick={() => {
            console.log('🎮 Logging in with Monad Games ID cross-app...');
            loginWithCrossAppAccount({ appId: 'cmd8euall0037le0my79qpz42' });
          }}
          disabled={!ready}
          style={{
            opacity: ready ? 1 : 0.5,
            cursor: ready ? 'pointer' : 'not-allowed',
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: '#4f46e5',
            color: 'white',
            fontSize: '14px'
          }}
        >
          {ready ? 'Sign in with Monad Games ID' : 'Loading...'}
        </button>
      ) : (
        <div style={{ background: "rgba(0,0,0,.5)", padding: 8, borderRadius: 8, color: "#fff" }}>
          <div style={{ fontSize: 12 }}>Wallet: {addr || "…"}</div>
          <div style={{ fontSize: 12 }}>Username: {uname || "(none)"}</div>

          {/* REMOVED: Register Username button to avoid UI overlap */}

          <button 
            onClick={logout} 
            style={{ 
              marginTop: 6, 
              marginLeft: 8,
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              background: '#dc2626',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function Root() {
  console.log('🌱 Root component rendering...');
  
  // Get app ID from environment variables with fallback
  const appId = import.meta.env.VITE_PRIVY_APP_ID || 
                import.meta.env.NEXT_PUBLIC_PRIVY_APP_ID || 
                process.env.NEXT_PUBLIC_PRIVY_APP_ID || 
                "cmex2ejkj00psjx0bodrlnx6d";
  
  console.log('🔑 Using Privy App ID:', appId?.slice(0, 8) + '...');
  
  const [mountError, setMountError] = React.useState(null);
  
  React.useEffect(() => {
    console.log('🌱 Root component mounted');
    
    // Set initial state
    window.privyReady = false;
    
    // Error boundary for catching initialization errors
    const errorHandler = (event) => {
      if (event.error && event.error.message.includes('privy')) {
        console.error('🚫 Privy initialization error caught:', event.error);
        setMountError('Privy SDK failed to initialize');
      }
    };
    
    window.addEventListener('error', errorHandler);
    
    return () => {
      console.log('🌱 Root component unmounting');
      window.removeEventListener('error', errorHandler);
    };
  }, []);
  
  if (mountError) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 12, 
        left: 12, 
        background: '#ff6b6b', 
        color: 'white', 
        padding: '8px 12px', 
        borderRadius: '6px', 
        fontSize: '12px' 
      }}>
        Auth Error: {mountError}
      </div>
    );
  }
  
  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: { createOnLogin: "all-users" },
        loginMethodsAndOrder: {
          primary: ['email', 'google', 'privy:cmd8euall0037le0my79qpz42']
        },
        // Add error handling configuration
        appearance: {
          theme: 'light'
        }
      }}
    >
      <AuthIsland />
    </PrivyProvider>
  );
}

console.log('🚀 About to render React app...');
try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  console.log('🎯 Root element found, creating React root...');
  
  // Add error boundary to catch React rendering errors
  const root = ReactDOM.createRoot(rootElement);
  
  // Wrap in error boundary
  const AppWithErrorBoundary = () => {
    const [hasError, setHasError] = React.useState(false);
    const [error, setError] = React.useState(null);
    
    React.useEffect(() => {
      const errorHandler = (event) => {
        if (event.error) {
          console.error('❗ React error caught:', event.error);
          setHasError(true);
          setError(event.error.message);
        }
      };
      
      window.addEventListener('error', errorHandler);
      return () => window.removeEventListener('error', errorHandler);
    }, []);
    
    if (hasError) {
      return (
        <div style={{ 
          position: 'fixed', 
          top: 12, 
          left: 12, 
          background: '#ff6b6b', 
          color: 'white', 
          padding: '8px 12px', 
          borderRadius: '6px' 
        }}>
          React Error: {error}
        </div>
      );
    }
    
    return <Root />;
  };
  
  root.render(<AppWithErrorBoundary />);
  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('❌ Failed to render React app:', error);
  
  // Fallback UI if React completely fails
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        position: fixed;
        top: 12px;
        left: 12px;
        background: #ff6b6b;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: sans-serif;
        font-size: 12px;
      ">
        Authentication system failed to load. Please refresh the page.
      </div>
    `;
  }
}