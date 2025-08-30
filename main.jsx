// main.jsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider, usePrivy, CrossAppAccountWithMetadata } from "@privy-io/react-auth";
// import "./public/assets/style.css"; // optional kalau kamu punya css sendiri

function AuthIsland() {
  const { authenticated, user, ready, login, logout } = usePrivy();
  const [addr, setAddr] = useState("");
  const [uname, setUname] = useState("");

  // Ambil wallet dari Cross App (Monad Games ID)
  useEffect(() => {
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
    window.privyLogin = login;
    window.privyLogout = logout;
    
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
    };
  }, [login, logout, authenticated]);

  return (
    <div style={{ position: "fixed", top: 12, left: 12, zIndex: 1000, fontFamily: "sans-serif" }}>
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
  // Get app ID from environment variables (Vite will inject this at build time)
  const appId = import.meta.env.VITE_PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmex2ejkj00psjx0bodrlnx6d";
  
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

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);