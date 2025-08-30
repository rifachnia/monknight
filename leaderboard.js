// leaderboard.js - Client-side leaderboard utilities
import { getPlayerAddress } from './contract.js';

/**
 * Fetch the current leaderboard from the blockchain
 * @returns {Promise<Array>} Array of player data sorted by score
 */
export async function fetchLeaderboard() {
  try {
    console.log('📊 Fetching leaderboard...');
    
    const response = await fetch('/api/leaderboard', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch leaderboard');
    }
    
    console.log(`✅ Fetched ${data.leaderboard.length} players from leaderboard`);
    return data.leaderboard;
    
  } catch (error) {
    console.error('❌ Failed to fetch leaderboard:', error);
    throw error;
  }
}

/**
 * Get the current player's rank and stats
 * @returns {Promise<Object|null>} Player's leaderboard data or null if not found
 */
export async function getCurrentPlayerRank() {
  try {
    const playerAddress = getPlayerAddress();
    if (!playerAddress) {
      console.warn('⚠️ No player address available');
      return null;
    }
    
    const leaderboard = await fetchLeaderboard();
    const playerData = leaderboard.find(player => 
      player.address.toLowerCase() === playerAddress.toLowerCase()
    );
    
    if (playerData) {
      console.log(`🏆 Player rank: ${playerData.rank} with score: ${playerData.score}`);
      return playerData;
    } else {
      console.log('📊 Player not found in leaderboard (no scores yet)');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Failed to get player rank:', error);
    return null;
  }
}

/**
 * Get top N players from leaderboard
 * @param {number} limit - Number of top players to return (default: 10)
 * @returns {Promise<Array>} Top players array
 */
export async function getTopPlayers(limit = 10) {
  try {
    const leaderboard = await fetchLeaderboard();
    return leaderboard.slice(0, limit);
  } catch (error) {
    console.error('❌ Failed to get top players:', error);
    return [];
  }
}

/**
 * Check if current player has improved their rank
 * Compares with locally stored previous rank
 * @returns {Promise<Object>} Rank comparison result
 */
export async function checkRankImprovement() {
  try {
    const currentRank = await getCurrentPlayerRank();
    if (!currentRank) return { improved: false, message: 'No rank data available' };
    
    const previousRank = localStorage.getItem('mk_previous_rank');
    
    if (!previousRank) {
      // First time checking, store current rank
      localStorage.setItem('mk_previous_rank', JSON.stringify(currentRank));
      return { improved: false, message: 'First rank recorded', currentRank };
    }
    
    const prev = JSON.parse(previousRank);
    const improved = currentRank.rank < prev.rank || currentRank.score > prev.score;
    
    // Update stored rank
    localStorage.setItem('mk_previous_rank', JSON.stringify(currentRank));
    
    if (improved) {
      return {
        improved: true,
        message: `Rank improved from ${prev.rank} to ${currentRank.rank}!`,
        previousRank: prev,
        currentRank
      };
    } else {
      return {
        improved: false,
        message: `Current rank: ${currentRank.rank}`,
        currentRank
      };
    }
    
  } catch (error) {
    console.error('❌ Failed to check rank improvement:', error);
    return { improved: false, message: 'Failed to check rank' };
  }
}

/**
 * Format leaderboard data for display
 * @param {Array} leaderboard - Raw leaderboard data
 * @returns {Array} Formatted leaderboard for UI display
 */
export function formatLeaderboardForDisplay(leaderboard) {
  return leaderboard.map(player => ({
    ...player,
    displayAddress: `${player.address.slice(0, 6)}...${player.address.slice(-4)}`,
    displayScore: player.score.toLocaleString(),
    rankDisplay: player.rank <= 3 ? 
      ['🥇', '🥈', '🥉'][player.rank - 1] + ` ${player.rank}` :
      `${player.rank}`,
  }));
}

/**
 * Export all leaderboard functions
 */
export default {
  fetchLeaderboard,
  getCurrentPlayerRank,
  getTopPlayers,
  checkRankImprovement,
  formatLeaderboardForDisplay
};