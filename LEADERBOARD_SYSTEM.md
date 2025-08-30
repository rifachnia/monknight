# 🏆 Blockchain Leaderboard System

This document explains the implementation of the blockchain-based leaderboard system for MONKNIGHT that integrates with the Monad Games ID infrastructure.

## 📊 Overview

The leaderboard system reads player scores directly from the smart contract and displays them in a global leaderboard accessible to all players. It uses the `updatePlayerData` function for score submission and reads data for leaderboard display.

## 🔗 Smart Contract Integration

### Contract Details
```javascript
Contract Address: 0xceCBFF203C8B6044F52CE23D914A1bfD997541A4
Network: Monad Testnet
RPC: https://testnet-rpc.monad.xyz
```

### Contract Functions Used
```solidity
// Write function (for score submission)
function updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount) external

// Read functions (for leaderboard)
function getPlayerData(address player) external view returns (uint256 score, uint256 transactionCount)
function getAllPlayersCount() external view returns (uint256)
function getPlayerByIndex(uint256 index) external view returns (address)

// Events (for tracking updates)
event PlayerDataUpdated(address indexed player, uint256 newScore, uint256 newTransactionCount)
```

## 🏗️ System Architecture

### 1. Score Submission Flow
```
Player defeats boss → Client validates → POST /api/submit-score → Server validates → updatePlayerData() → Blockchain
```

### 2. Leaderboard Display Flow
```
Open Leaderboard → GET /api/leaderboard → Read contract data → Sort by score → Display to player
```

## 📁 Implementation Files

### Backend API Routes

#### `/api/submit-score.js`
- **Purpose**: Secure server-side score submission
- **Method**: POST
- **Security**: Server-side validation, anti-cheat measures
- **Function**: Calls `updatePlayerData(player, scoreAmount, transactionAmount)`

#### `/api/leaderboard.js` (NEW)
- **Purpose**: Fetch leaderboard data from blockchain
- **Method**: GET
- **Function**: Reads all player data and returns sorted leaderboard
- **Fallback**: Uses events if direct enumeration fails

### Frontend Components

#### `LeaderboardScene.js` (UPDATED)
- **Purpose**: Game scene for displaying leaderboard
- **Features**: 
  - Real-time blockchain data
  - Player highlighting
  - Rank medals for top 3
  - External leaderboard link
  - Error handling with refresh

#### `leaderboard.js` (NEW)
- **Purpose**: Client-side leaderboard utilities
- **Functions**:
  - `fetchLeaderboard()` - Get current leaderboard
  - `getCurrentPlayerRank()` - Get player's rank
  - `checkRankImprovement()` - Compare with previous rank
  - `formatLeaderboardForDisplay()` - Format for UI

## 🎮 User Experience Features

### 1. Live Leaderboard
- **Real-time data** from blockchain
- **Global rankings** across all players
- **Score formatting** with thousand separators
- **Address display** with shortened format

### 2. Player Highlighting
- **Current player** highlighted in green
- **Rank medals** for top 3 positions (🥇🥈🥉)
- **Personal rank** tracking and improvement notifications

### 3. External Integration
- **Direct link** to Monad Games ID leaderboard
- **Verification** at https://monad-games-id-site.vercel.app/leaderboard
- **Cross-game** score visibility

### 4. Error Handling
- **Connection errors** with retry functionality
- **Loading states** with progress indicators
- **Fallback messages** for empty leaderboard

## 🔧 Technical Implementation

### Blockchain Reading Strategy

The system uses a two-tier approach for maximum compatibility:

1. **Primary Method**: Direct contract enumeration
   ```javascript
   const playerCount = await contract.getAllPlayersCount();
   for (let i = 0; i < playerCount; i++) {
     const playerAddress = await contract.getPlayerByIndex(i);
     const [score, txCount] = await contract.getPlayerData(playerAddress);
   }
   ```

2. **Fallback Method**: Event-based discovery
   ```javascript
   const filter = contract.filters.PlayerDataUpdated();
   const events = await contract.queryFilter(filter, fromBlock, currentBlock);
   const uniquePlayers = [...new Set(events.map(event => event.args.player))];
   ```

### Performance Optimizations

- **Batch requests** for player data
- **Caching** of leaderboard results
- **Pagination** limiting to top 50 players
- **Error isolation** for failed player queries

### Security Measures

- **Read-only operations** for leaderboard API
- **Input validation** on all API endpoints
- **Rate limiting** considerations
- **Error message sanitization**

## 🚀 Deployment

### Environment Variables
```bash
# Already configured for score submission
GAME_SERVER_PRIVATE_KEY=your_server_wallet_private_key
```

### API Endpoints
- `POST /api/submit-score` - Submit scores (existing)
- `GET /api/leaderboard` - Fetch leaderboard (new)

### Vercel Configuration
Both endpoints are automatically deployed as Vercel serverless functions.

## 🧪 Testing

### Manual Testing

1. **Score Submission**:
   ```bash
   # Play game and defeat boss
   # Check console for "Score successfully submitted"
   # Verify transaction on Monad explorer
   ```

2. **Leaderboard Display**:
   ```bash
   # Navigate to Leaderboard from main menu
   # Verify blockchain data loads
   # Check player highlighting works
   # Test external link functionality
   ```

3. **Error Handling**:
   ```bash
   # Disconnect internet and test error states
   # Verify refresh functionality works
   # Check loading indicators display
   ```

## 📈 Monitoring

### Logs to Monitor
- `📊 Fetching blockchain leaderboard...`
- `✅ Successfully fetched leaderboard with X players`
- `❌ Failed to fetch blockchain leaderboard:`
- `🏆 Player rank: X with score: Y`

### Key Metrics
- **API response times** for leaderboard fetching
- **Success rates** for blockchain reads
- **Player engagement** with leaderboard feature
- **Score submission frequency**

## 🔮 Future Enhancements

### Planned Features
1. **Real-time updates** via WebSocket connections
2. **Historical ranking** charts and trends
3. **Achievement badges** for milestones
4. **Seasonal leaderboards** and competitions
5. **Social features** like following other players

### Integration Opportunities
1. **NFT rewards** for top players
2. **Cross-game achievements** via Monad Games ID
3. **Tournament organization** tools
4. **Streaming integration** for competitive play

## 🔗 External Links

- [Contract on Monad Explorer](https://testnet.monadexplorer.com/address/0xceCBFF203C8B6044F52CE23D914A1bfD997541A4)
- [Monad Games ID Leaderboard](https://monad-games-id-site.vercel.app/leaderboard)
- [Monad Testnet RPC](https://testnet-rpc.monad.xyz)

---

## ✅ Implementation Status

- [x] Smart contract integration with `updatePlayerData`
- [x] Server-side score submission with validation
- [x] Blockchain leaderboard reading API
- [x] Frontend leaderboard scene with real-time data
- [x] Player highlighting and rank tracking
- [x] Error handling and loading states
- [x] External leaderboard integration
- [x] Rank improvement notifications
- [ ] Real-time updates (future enhancement)
- [ ] Historical data tracking (future enhancement)

The blockchain leaderboard system is now fully operational and ready for production use! 🚀