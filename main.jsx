// main.jsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider, usePrivy, CrossAppAccountWithMetadata } from "@privy-io/react-auth";

console.log('🚀 main.jsx loading...');

function AuthIsland() {
  const { authenticated, user, ready, login, logout } = usePrivy();
  const [addr, setAddr] = useState("");
  const [uname, setUname] = useState("");

  console.log('🔍 AuthIsland render:', { ready, authenticated, hasUser: !!user, hasLogin: !!login });

  // Ambil wallet dari Cross App (Monad Games ID)
  useEffect(() => {
    console.log('🔄 AuthIsland useEffect:', { ready, authenticated, hasUser: !!user });
    
    if (!ready || !authenticated) return;

    const cross = user?.linkedAccounts?.find(
      (acc) => acc.type === "cross_app" && acc.providerApp?.id === "cmd8euall0037le0my79qpz42"
    );

    const address = cross?.embeddedWallets?.[0]?.address || "";
    if (!address) return;

    setAddr(address);

    // Fetch username dari endpoint
    (async () => {
      try {
        const r = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${address}`);
        const j = await r.json();
        const username = j?.username || "";
        setUname(username);
        // Store in localStorage for game compatibility
        localStorage.setItem('mgid_user', username || address);
        // publish to game:
        window.MONKNIGHT_AUTH = { address, username };
        window.dispatchEvent(new CustomEvent("monknight-auth", { 
          detail: { authenticated: true, address, username } 
        }));
        console.log('✅ Privy authentication successful:', { address, username });
      } catch (e) {
        console.error("check-wallet failed:", e);
        localStorage.setItem('mgid_user', address);
        window.MONKNIGHT_AUTH = { address, username: "" };
        window.dispatchEvent(new CustomEvent("monknight-auth", { 
          detail: { authenticated: true, address, username: "" } 
        }));
      }
    })();
  }, [authenticated, user, ready]);

  // Expose login/logout functions globally for game to use
  React.useEffect(() => {
    console.log('🔧 Function exposure effect:', { ready, hasLogin: !!login, hasLogout: !!logout });
    
    // Only expose functions when Privy is ready and we have valid functions
    if (ready && login && logout) {
      window.privyLogin = login;
      window.privyLogout = logout;
      window.privyReady = true;
      console.log('🔗 Privy functions exposed and ready:', { 
        privyLogin: !!login, 
        privyLogout: !!logout, 
        ready: ready 
      });
      
      // Notify game that Privy is ready
      window.dispatchEvent(new CustomEvent('privy-ready', { 
        detail: { ready: true, login, logout } 
      }));
      
      // Also try to notify after a short delay to ensure game is listening
      setTimeout(() => {
        console.log('🔔 Delayed Privy ready notification');
        window.dispatchEvent(new CustomEvent('privy-ready', { 
          detail: { ready: true, login, logout } 
        }));
      }, 500);
    } else {
      // Mark as not ready if conditions aren't met
      window.privyReady = false;
      console.log('⏳ Privy not ready yet:', { ready, hasLogin: !!login, hasLogout: !!logout });
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
      delete window.privyLogout;
      window.privyReady = false;
      console.log('🗑️ Privy functions cleaned up');
    };
  }, [ready, login, logout, authenticated]);

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
      </div>
      
      {!authenticated ? (
        <button onClick={login}>Sign in with Monad Games ID</button>
      ) : (
        <div style={{ background: "rgba(0,0,0,.5)", padding: 8, borderRadius: 8, color: "#fff" }}>
          <div style={{ fontSize: 12 }}>Wallet: {addr || "…"}</div>
          <div style={{ fontSize: 12 }}>Username: {uname || "(none)"}</div>

          {/* REMOVED: Register Username button to avoid UI overlap */}

          <button onClick={logout} style={{ marginTop: 6, marginLeft: 8 }}>Logout</button>
        </div>
      )}
    </div>
  );
}

function Root() {
  console.log('🌱 Root component rendering...');
  
  // Get app ID from environment variables (Vite will inject this at build time)
  const appId = import.meta.env.VITE_PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmex2ejkj00psjx0bodrlnx6d";
  
  console.log('🔑 Using Privy App ID:', appId?.slice(0, 8) + '...');
  
  React.useEffect(() => {
    console.log('🌱 Root component mounted');
    
    // Set initial state
    window.privyReady = false;
    
    return () => {
      console.log('🌱 Root component unmounting');
    };
  }, []);
  
  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: { createOnLogin: "all-users" },
        loginMethodsAndOrder: [
          { type: "cross_app", options: { providerAppId: "cmd8euall0037le0my79qpz42" } },
          "email", "google"
        ]
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
  ReactDOM.createRoot(rootElement).render(<Root />);
  console.log('✅ React app rendered successfully');
} catch (error) {
  console.error('❌ Failed to render React app:', error);
}