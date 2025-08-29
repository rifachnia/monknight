// auth/PrivyOverlay.jsx
import React, { useEffect, useState } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

const CROSS_APP_ID = "cmd8euall0037le0my79qpz42"; // Monad Games ID

async function fetchUsername(addr) {
  const r = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${addr}`);
  const data = await r.json();
  return data?.hasUsername ? data.user.username : null;
}

function AuthButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!ready || !authenticated || !user) return;

    // cari cross-app account utk Monad Games ID
    const cross = Array.isArray(user.linkedAccounts)
      ? user.linkedAccounts.find(
          (a) => a?.type === "cross_app" && a?.providerApp?.id === CROSS_APP_ID
        )
      : null;

    const addr = cross?.embeddedWallets?.[0]?.address || "";
    setAddress(addr);

    (async () => {
      if (addr) {
        const uname = await fetchUsername(addr);
        setUsername(uname || "");
        if (window.gameAuth?.onLogin) {
          window.gameAuth.onLogin({ address: addr, username: uname || null });
        }
      }
    })();
  }, [ready, authenticated, user]);

  return (
    <div style={{ pointerEvents: "auto" }}>
      {!authenticated ? (
        <button
          onClick={login}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Sign in with Monad Games ID
        </button>
      ) : (
        <div
          style={{
            background: "#fff",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
            minWidth: 240,
          }}
        >
          <div style={{ fontWeight: 600 }}>Signed in</div>
          <div style={{ fontSize: 12 }}>
            Wallet: {address ? address.slice(0, 6) + "..." + address.slice(-4) : "-"}
          </div>
          <div style={{ fontSize: 12 }}>Username: {username || "(not set)"}</div>

          <button
            onClick={logout}
            style={{
              marginTop: 6,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ddd",
              background: "#f8f8f8",
              cursor: "pointer",
            }}
          >
            Logout
          </button>

          {!username && (
            <a
              href="https://monad-games-id-site.vercel.app/"
              target="_blank"
              rel="noreferrer"
              style={{ display: "block", marginTop: 6, fontSize: 12, textDecoration: "underline" }}
            >
              Reserve username
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function PrivyOverlay({ appId }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: { createOnLogin: "users-without-wallets" },
        loginMethodsAndOrder: [
          { type: "cross_app", options: { providerAppId: CROSS_APP_ID } },
          "email",
          "google",
        ],
      }}
    >
      <AuthButton />
    </PrivyProvider>
  );
}
