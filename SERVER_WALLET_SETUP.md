# 🔑 Server Wallet Setup Guide

Your API needs a server wallet to pay gas fees when submitting scores to the blockchain.

## Step 1: Create a New Wallet

### Using MetaMask (Recommended)
1. Open MetaMask
2. Click your account avatar → "Add account or hardware wallet"
3. Select "Add a new account"
4. Name it "MONKNIGHT Server Wallet"
5. **COPY the private key** (Account details → Show private key)

### Using Online Tool (Alternative)
1. Visit: https://vanity-eth.tk/
2. Generate a new address
3. **COPY the private key** (starts with 0x...)

## Step 2: Fund the Server Wallet

You need Monad testnet ETH to pay for gas:

1. Copy your new wallet address
2. Get testnet ETH from: https://faucet.monad.xyz/
3. Send some testnet ETH from your main wallet to server wallet

**Recommended amount: 0.1 - 0.5 testnet ETH**

## Step 3: Configure Environment Variable

### For Local Development:
Create `.env.local` file in your project root:
```bash
GAME_SERVER_PRIVATE_KEY=0x1234567890abcdef...  # Your server wallet private key
```

### For Vercel Deployment:
1. Go to your Vercel dashboard
2. Select your project → Settings → Environment Variables
3. Add: 
   - **Name**: `GAME_SERVER_PRIVATE_KEY`
   - **Value**: `0x1234567890abcdef...` (your private key)
   - **Environment**: Production, Preview, Development

## Step 4: Test the Setup

After configuration, test score submission:
1. Play the game and defeat a boss
2. Check console for: "✅ Score updated successfully"
3. If you see "❌ Missing GAME_SERVER_PRIVATE_KEY", configuration failed

## Security Notes

⚠️ **IMPORTANT**:
- This wallet is ONLY for paying gas fees
- Don't store large amounts of ETH in it
- Never share this private key publicly
- Keep it in environment variables only

## Troubleshooting

**"Server wallet insufficient funds"**
→ Add more testnet ETH to your server wallet

**"Missing GAME_SERVER_PRIVATE_KEY environment variable"**
→ Double-check your environment variable configuration

**Transaction fails**
→ Verify wallet has testnet ETH and private key is correct