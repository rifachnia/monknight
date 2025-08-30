// contract.js - Client-side API calls to secure server
import { isLoggedIn, loadSession } from './session.js';

/**
 * Submit score to the blockchain via secure server API
 * Prevents client-side cheating by validating on server
 * @param {string} playerAddress - Player's wallet address
 * @param {number} score - The player's score increment
 * @param {number} duration - Game duration in milliseconds
 * @param {number} txCount - Transaction count increment (default: 1)
 * @param {object} gameData - Additional game validation data
 */
export async function submitScore(playerAddress, score, duration = 0, txCount = 1, gameData = {}) {
  // Check if user is logged in first
  if (!isLoggedIn()) {
    console.warn("⚠️ Player must be logged in to submit scores");
    alert("Please login first to submit your score!");
    return false;
  }

  const session = loadSession();
  if (!session) {
    console.warn("⚠️ No valid session found");
    return false;
  }

  // Use session data for player info
  const actualPlayerAddress = playerAddress || session.walletAddress;
  
  if (!actualPlayerAddress) {
    console.warn("⚠️ Player address required for score submission");
    return false;
  }

  if (!score || score <= 0) {
    console.warn("⚠️ Invalid score value:", score);
    return false;
  }

  try {
    console.log(`🚀 Submitting score via API: Player=${session.username}, Address=${actualPlayerAddress}, Score=+${score}, Duration=${duration}ms`);
    
    const response = await fetch('/api/submit-score', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        player: actualPlayerAddress,
        score: Math.floor(score),
        txCount: Math.floor(txCount),
        duration: Math.floor(duration),
        session: {
          userId: session.userId,
          username: session.username,
          provider: session.provider
        },
        gameData: {
          timestamp: Date.now(),
          userAgent: navigator.userAgent.substring(0, 100),
          ...gameData
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }

    console.log("✅ Score submitted successfully:", result);
    console.log("📜 Transaction hash:", result.transactionHash);
    
    return {
      success: true,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      scoreIncrement: result.scoreIncrement,
      txIncrement: result.txIncrement
    };

  } catch (err) {
    console.error("❌ Submit score error:", err);
    
    // User-friendly error messages
    if (err.message.includes('Invalid game session')) {
      alert("Game session validation failed. Please play normally.");
    } else if (err.message.includes('Server configuration')) {
      alert("Server temporarily unavailable. Please try again later.");
    } else if (err.message.includes('insufficient funds')) {
      alert("Server wallet issue. Please contact support.");
    } else {
      alert("Failed to submit score. Check your connection and try again.");
    }
    
    return false;
  }
}

/**
 * Submit combined score and transaction data (recommended)
 * @param {string} playerAddress - Player's wallet address
 * @param {number} score - Score increment
 * @param {number} txCount - Transaction count increment
 * @param {number} duration - Game duration
 * @param {object} gameData - Game validation data
 */
export async function submitGameResult(playerAddress, score, txCount = 1, duration = 0, gameData = {}) {
  return await submitScore(playerAddress, score, duration, txCount, gameData);
}

/**
 * Get the current game contract address
 */
export function getContractAddress() {
  return "0xceCBFF203C8B6044F52CE23D914A1bfD997541A4"; // Updated contract address
}

/**
 * Check if player is authenticated and ready for score submission
 */
export function isPlayerReady() {
  // Check if player has wallet address from authentication
  return !!(window.MONKNIGHT_AUTH?.address || window.PLAYER_ADDRESS);
}

/**
 * Get current player address from authentication state
 */
export function getPlayerAddress() {
  return window.MONKNIGHT_AUTH?.address || window.PLAYER_ADDRESS || null;
}

/**
 * Validate score submission data before sending to API
 */
export function validateSubmissionData(score, duration) {
  const errors = [];
  
  if (!score || score <= 0) {
    errors.push("Score must be greater than 0");
  }
  
  if (score > 10000) {
    errors.push("Score seems unreasonably high");
  }
  
  if (duration && duration < 1000) {
    errors.push("Game duration too short");
  }
  
  if (duration && duration > 300000) {
    errors.push("Game duration too long");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}