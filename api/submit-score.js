// api/submit-score.js - Vercel API Route
import { ethers } from "ethers";

// Contract configuration
const GAME_CONTRACT = "0xceCBFF203C8B6044F52CE23D914A1bfD997541A4";
const ABI = [
  "function updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount) external"
];

// Validation constants
const MAX_REASONABLE_SCORE = 10000;  // Maximum reasonable score
const MIN_GAME_DURATION = 5000;      // 5 seconds minimum
const MAX_GAME_DURATION = 300000;    // 5 minutes maximum

/**
 * Server-side score submission with validation
 * Prevents client-side cheating by validating on server
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { player, score, txCount, duration, gameData } = req.body;

    // Basic validation
    if (!player || typeof score !== 'number' || typeof txCount !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid request: missing required fields' 
      });
    }

    // Validate Ethereum address format
    if (!ethers.isAddress(player)) {
      return res.status(400).json({ 
        error: 'Invalid player address format' 
      });
    }

    // Anti-cheat validation
    const validationResult = validateGameSession({
      score,
      duration: duration || 0,
      txCount,
      gameData
    });

    if (!validationResult.valid) {
      console.warn(`🚨 Potential cheat detected for ${player}: ${validationResult.reason}`);
      return res.status(400).json({ 
        error: `Invalid game session: ${validationResult.reason}` 
      });
    }

    // Initialize blockchain connection
    const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz");
    
    // Use environment variable for private key
    if (!process.env.GAME_SERVER_PRIVATE_KEY) {
      console.error("❌ Missing GAME_SERVER_PRIVATE_KEY environment variable");
      return res.status(500).json({ 
        error: 'Server configuration error' 
      });
    }

    const wallet = new ethers.Wallet(process.env.GAME_SERVER_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(GAME_CONTRACT, ABI, wallet);

    console.log(`🎮 Submitting score for ${player}: +${score} points, +${txCount} tx`);

    // Call contract with incremental values (not total)
    const tx = await contract.updatePlayerData(
      player,
      Math.floor(score),      // Score increment
      Math.floor(txCount)     // Transaction count increment
    );

    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log(`✅ Score updated successfully for ${player}`);
    console.log(`📜 Transaction confirmed: ${receipt.transactionHash}`);

    return res.status(200).json({
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      player,
      scoreIncrement: Math.floor(score),
      txIncrement: Math.floor(txCount)
    });

  } catch (error) {
    console.error("❌ Submit score error:", error);
    
    // Don't expose internal errors to client
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return res.status(500).json({ 
        error: 'Server wallet insufficient funds' 
      });
    } else if (error.code === 'NETWORK_ERROR') {
      return res.status(500).json({ 
        error: 'Blockchain network error' 
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to submit score' 
      });
    }
  }
}

/**
 * Anti-cheat validation logic
 * Validates if the game session data is reasonable
 */
function validateGameSession({ score, duration, txCount, gameData }) {
  // Score validation
  if (score < 0 || score > MAX_REASONABLE_SCORE) {
    return {
      valid: false,
      reason: `Score ${score} outside reasonable range (0-${MAX_REASONABLE_SCORE})`
    };
  }

  // Duration validation (if provided)
  if (duration > 0) {
    if (duration < MIN_GAME_DURATION || duration > MAX_GAME_DURATION) {
      return {
        valid: false,
        reason: `Game duration ${duration}ms outside reasonable range`
      };
    }

    // Score vs duration ratio check
    const scorePerSecond = score / (duration / 1000);
    if (scorePerSecond > 1000) { // Max 1000 points per second
      return {
        valid: false,
        reason: `Score rate too high: ${scorePerSecond.toFixed(2)} points/second`
      };
    }
  }

  // Transaction count validation
  if (txCount < 0 || txCount > 10) {
    return {
      valid: false,
      reason: `Transaction count ${txCount} outside reasonable range (0-10)`
    };
  }

  // Additional game-specific validation can go here
  // For example, check if boss was actually defeated, etc.

  return { valid: true };
}