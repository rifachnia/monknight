// api/leaderboard.js - Fetch leaderboard data from smart contract
import { ethers } from "ethers";

// Contract configuration
const GAME_CONTRACT = "0xceCBFF203C8B6044F52CE23D914A1bfD997541A4";

// Extended ABI to include read functions
const ABI = [
  // Write function
  "function updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount) external",
  
  // Read functions for leaderboard
  "function getPlayerData(address player) external view returns (uint256 score, uint256 transactionCount)",
  "function getAllPlayersCount() external view returns (uint256)",
  "function getPlayerByIndex(uint256 index) external view returns (address)",
  
  // Events for tracking
  "event PlayerDataUpdated(address indexed player, uint256 newScore, uint256 newTransactionCount)"
];

/**
 * Fetch leaderboard data from the smart contract
 * This endpoint reads all player data and returns sorted leaderboard
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 Fetching leaderboard data from blockchain...');

    // Initialize blockchain connection (read-only)
    const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
    const contract = new ethers.Contract(GAME_CONTRACT, ABI, provider);

    let leaderboardData = [];

    try {
      // Method 1: Try to get all players if contract supports it
      const playerCount = await contract.getAllPlayersCount();
      console.log(`👥 Found ${playerCount} players in contract`);

      // Fetch data for each player
      const playerPromises = [];
      for (let i = 0; i < Math.min(Number(playerCount), 100); i++) { // Limit to 100 players
        playerPromises.push(
          contract.getPlayerByIndex(i).then(async (playerAddress) => {
            const [score, txCount] = await contract.getPlayerData(playerAddress);
            return {
              address: playerAddress,
              score: Number(score),
              transactionCount: Number(txCount),
              rank: 0 // Will be calculated after sorting
            };
          }).catch(err => {
            console.warn(`⚠️ Failed to fetch data for player ${i}:`, err.message);
            return null;
          })
        );
      }

      const results = await Promise.all(playerPromises);
      leaderboardData = results.filter(player => player !== null && player.score > 0);

    } catch (contractError) {
      console.warn('⚠️ Contract enumeration not available, using event-based approach');
      
      // Method 2: Fallback - listen to events (last 1000 blocks)
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000);
        
        const filter = contract.filters.PlayerDataUpdated();
        const events = await contract.queryFilter(filter, fromBlock, currentBlock);
        
        console.log(`📝 Found ${events.length} update events`);
        
        // Get unique players from events
        const uniquePlayers = [...new Set(events.map(event => event.args.player))];
        
        // Fetch current data for each unique player
        const playerPromises = uniquePlayers.map(async (playerAddress) => {
          try {
            const [score, txCount] = await contract.getPlayerData(playerAddress);
            return {
              address: playerAddress,
              score: Number(score),
              transactionCount: Number(txCount),
              rank: 0
            };
          } catch (err) {
            console.warn(`⚠️ Failed to fetch data for ${playerAddress}:`, err.message);
            return null;
          }
        });

        const results = await Promise.all(playerPromises);
        leaderboardData = results.filter(player => player !== null && player.score > 0);
        
      } catch (eventError) {
        console.error('❌ Failed to fetch events:', eventError);
        // Return empty leaderboard if both methods fail
        leaderboardData = [];
      }
    }

    // Sort by score (highest first) and assign ranks
    leaderboardData.sort((a, b) => b.score - a.score);
    leaderboardData.forEach((player, index) => {
      player.rank = index + 1;
    });

    // Limit to top 50 for performance
    const topPlayers = leaderboardData.slice(0, 50);

    console.log(`✅ Successfully fetched leaderboard with ${topPlayers.length} players`);

    return res.status(200).json({
      success: true,
      leaderboard: topPlayers,
      totalPlayers: leaderboardData.length,
      lastUpdated: new Date().toISOString(),
      contractAddress: GAME_CONTRACT
    });

  } catch (error) {
    console.error("❌ Leaderboard fetch error:", error);
    
    // Return error but don't expose internal details
    return res.status(500).json({ 
      error: 'Failed to fetch leaderboard data',
      success: false,
      leaderboard: [],
      totalPlayers: 0
    });
  }
}

/**
 * Helper function to get player data for a specific address
 * Can be used for individual player lookups
 */
export async function getPlayerData(playerAddress) {
  try {
    const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
    const contract = new ethers.Contract(GAME_CONTRACT, ABI, provider);
    
    const [score, txCount] = await contract.getPlayerData(playerAddress);
    
    return {
      address: playerAddress,
      score: Number(score),
      transactionCount: Number(txCount)
    };
  } catch (error) {
    console.error('❌ Failed to get player data:', error);
    return null;
  }
}