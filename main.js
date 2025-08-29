import React from "react";
import { createRoot } from "react-dom/client";
import PrivyOverlay from "./auth/PrivyOverlay";

// siapkan hook untuk Phaser menerima identitas
window.gameAuth = {
  onLogin({ address, username }) {
    // panggil fungsi di game.js (kamu buat di bawah)
    if (window.setPlayerIdentity) window.setPlayerIdentity({ address, username });
  }
};

// Get app ID from environment variables (Vite will inject this at build time)
const appId = import.meta.env.VITE_PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmex2ejkj00psjx0bodrlnx6d";
console.log("Using Privy App ID:", appId);

const root = createRoot(document.getElementById("auth-root"));
root.render(<PrivyOverlay appId={appId} />);