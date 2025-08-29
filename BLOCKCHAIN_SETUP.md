# 🔐 Secure Blockchain Integration Setup

This document explains the secure server-side blockchain integration for MONKNIGHT that follows Monad Games ID official guidelines.

## 🎯 Overview

Instead of direct client-side contract calls (which allow cheating), we now use:

1. **Client submits to API** → Server validates → **Server calls contract**
2. **Increment-based updates** using `updatePlayerData(player, scoreAmount, txAmount)`
3. **Anti-cheat validation** on the server side

## 🛠️ Server Setup

### 1. Environment Variables

Create `.env.local` file (NEVER commit this to git):

```env
# Copy from .env.example and fill in real values
NEXT_PUBLIC_PRIVY_APP_ID=cmex2ejkj00psjx0bodrlnx6d
GAME_SERVER_PRIVATE_KEY=your_server_wallet_private_key_here
```

### 2. Server Wallet Requirements

The server wallet needs:
- **Monad testnet ETH** for gas fees
- **Private key** stored securely in environment variables
- **Sufficient balance** to handle multiple transactions

### 3. Contract Information

```javascript
Contract Address: 0xceCBFF203C8B6044F52CE23D914A1bfD997541A4
Function: updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount)
Network: Monad Testnet (https://testnet-rpc.monad.xyz)
```

## 🎮 Game Flow

### Before (Client-side - Vulnerable)
```
Player defeats boss → Client calls contract directly → Blockchain
❌ Player can manipulate score in browser console
```

### After (Server-side - Secure)
```
Player defeats boss → Client POST /api/submit-score → Server validates → Server calls contract → Blockchain
✅ Server validates all data before blockchain submission
```

## 🔍 Anti-Cheat Validation

The server validates:

- **Score Range**: 0 to 10,000 points maximum
- **Duration**: 5 seconds to 5 minutes reasonable range
- **Score Rate**: Maximum 1000 points per second
- **Transaction Count**: 0 to 10 transactions per game
- **Address Format**: Valid Ethereum address

## 📡 API Endpoint

### POST `/api/submit-score`

**Request Body:**
```json
{
  "player": "0x742d35Cc6644Aa3532a4A2d8a8D654bb8dd3EA38",
  "score": 1234,
  "txCount": 1,
  "duration": 15000,
  "gameData": {
    "bossDefeated": true,
    "playerUsername": "PlayerName",
    "mapKey": "battle"
  }
}
```

**Success Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockNumber": 12345,
  "scoreIncrement": 1234,
  "txIncrement": 1
}
```

**Error Response:**
```json
{
  "error": "Invalid game session: Score rate too high"
}
```

## 🚀 Deployment

### Vercel Deployment

1. **Environment Variables**: Add `GAME_SERVER_PRIVATE_KEY` in Vercel dashboard
2. **API Routes**: Automatically deployed to `/api/submit-score`
3. **Build**: Standard Vite build process

### Server Wallet Setup

```bash
# Generate a new wallet for server use
# Fund it with Monad testnet ETH
# Add private key to .env.local (development) or Vercel env vars (production)
```

## 🔒 Security Features

- **Server-side validation** prevents client manipulation
- **Rate limiting** via game duration checks
- **Private key isolation** in environment variables
- **Error message sanitization** to prevent information leakage
- **Transaction confirmation** waiting for finality

## 🧪 Testing

### Local Development
```bash
# 1. Set up .env.local with test wallet
# 2. Fund test wallet with Monad testnet ETH
# 3. Run development server
npm run dev

# 4. Play game and defeat boss
# 5. Check console for transaction logs
```

### Production Testing
```bash
# Deploy to Vercel with production environment variables
# Test with small amounts first
# Monitor gas usage and transaction success rates
```

## 📊 Monitoring

Watch for:
- **Failed transactions** (insufficient gas, network issues)
- **Validation rejections** (potential cheating attempts)
- **Gas consumption** (wallet balance monitoring)
- **API response times** (server performance)

## 🔧 Troubleshooting

### Common Issues

1. **"Server wallet insufficient funds"**
   - Add more Monad testnet ETH to server wallet

2. **"Invalid game session"**
   - Check score/duration ratios are reasonable

3. **"Blockchain network error"**
   - Verify Monad testnet RPC is accessible

4. **Environment variable errors**
   - Ensure `GAME_SERVER_PRIVATE_KEY` is set correctly

## 🎯 Next Steps

1. **Set up server wallet** with testnet funds
2. **Configure environment variables** 
3. **Deploy to Vercel** with production settings
4. **Test end-to-end flow** from game to blockchain
5. **Monitor transaction success rates**

The system is now ready for secure, cheat-resistant blockchain integration! 🎮⛓️