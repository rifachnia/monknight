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

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000;     // 1 minute window
const MAX_SUBMISSIONS_PER_MINUTE = 3; // Max 3 submissions per minute per IP
const MAX_SUBMISSIONS_PER_WALLET = 5; // Max 5 submissions per minute per wallet
const MIN_TIME_BETWEEN_SUBMISSIONS = 10000; // 10 seconds minimum between submissions

// Session-based rate limiting
const sessionLimitStore = new Map();
const REQUIRED_SESSION_FIELDS = ['userId', 'username', 'provider'];
const MIN_SESSION_AGE = 30000; // Session must be at least 30 seconds old

/**
 * Server-side score submission with validation
 * Prevents client-side cheating by validating on server
 * Protected against direct API calls and rate limiting
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const timestamp = Date.now();
  
  try {
    const { player, score, txCount, duration, session, gameData } = req.body;

    // SECURITY CHECK 1: Rate limiting by IP address
    const rateLimitResult = checkRateLimit(clientIP, timestamp);
    if (!rateLimitResult.allowed) {
      console.warn(`🚨 Rate limit exceeded for IP ${clientIP}: ${rateLimitResult.reason}`);
      return res.status(429).json({ 
        error: 'Too many requests. Please wait before submitting again.',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // SECURITY CHECK 2: Basic validation
    if (!player || typeof score !== 'number' || typeof txCount !== 'number') {
      logSuspiciousActivity(clientIP, player, 'Missing required fields', { score, txCount });
      return res.status(400).json({ 
        error: 'Invalid request: missing required fields' 
      });
    }

    // SECURITY CHECK 3: Session validation (CRITICAL - prevents direct API calls)
    if (!session || !validateSession(session)) {
      logSuspiciousActivity(clientIP, player, 'Invalid or missing session', session);
      return res.status(401).json({ 
        error: 'Authentication required. Please login through the game.' 
      });
    }

    // SECURITY CHECK 4: Wallet-based rate limiting  
    const walletRateLimitResult = checkWalletRateLimit(player, session.userId, timestamp);
    if (!walletRateLimitResult.allowed) {
      logSuspiciousActivity(clientIP, player, 'Wallet rate limit exceeded', {
        reason: walletRateLimitResult.reason,
        userId: session.userId
      });
      return res.status(429).json({ 
        error: 'Too many submissions from this account. Please wait.',
        retryAfter: walletRateLimitResult.retryAfter
      });
    }

    // SECURITY CHECK 5: Validate Ethereum address format
    if (!ethers.isAddress(player)) {
      logSuspiciousActivity(clientIP, player, 'Invalid wallet address format');
      return res.status(400).json({ 
        error: 'Invalid player address format' 
      });
    }

    // SECURITY CHECK 6: Session-Player address matching
    if (session.walletAddress && session.walletAddress.toLowerCase() !== player.toLowerCase()) {
      logSuspiciousActivity(clientIP, player, 'Session wallet mismatch', {
        sessionWallet: session.walletAddress,
        submittedWallet: player
      });
      return res.status(403).json({ 
        error: 'Wallet address mismatch. Please re-authenticate.' 
      });
    }

    // SECURITY CHECK 7: Game session validation
    const validationResult = validateGameSession({
      score,
      duration: duration || 0,
      txCount,
      gameData,
      session
    });

    if (!validationResult.valid) {
      logSuspiciousActivity(clientIP, player, `Game validation failed: ${validationResult.reason}`, {
        score, duration, txCount, gameData
      });
      return res.status(400).json({ 
        error: `Invalid game session: ${validationResult.reason}` 
      });
    }

    // Update rate limit counters
    updateRateLimitCounters(clientIP, player, session.userId, timestamp);

    console.log(`📮 Validated score submission from: ${session.username} (${session.userId}) - IP: ${clientIP}`);
    console.log(`🎮 Score: ${score}, Duration: ${duration}ms, Wallet: ${player}`);

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
    logSuspiciousActivity(clientIP, req.body?.player, 'Server error during submission', { error: error.message });
    
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
 * Enhanced anti-cheat validation logic
 * Validates if the game session data is reasonable and authentic
 */
function validateGameSession({ score, duration, txCount, gameData, session }) {
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

  // Session age validation
  if (session && session.loginTime) {
    const sessionAge = Date.now() - session.loginTime;
    if (sessionAge < MIN_SESSION_AGE) {
      return {
        valid: false,
        reason: `Session too new: ${sessionAge}ms (minimum ${MIN_SESSION_AGE}ms)`
      };
    }
  }

  // Game data validation
  if (gameData) {
    // Check if required game data fields are present
    if (gameData.bossDefeated !== true) {
      return {
        valid: false,
        reason: 'Boss defeat validation failed'
      };
    }
    
    // Timestamp validation
    if (gameData.timestamp) {
      const timeDiff = Math.abs(Date.now() - gameData.timestamp);
      if (timeDiff > 300000) { // 5 minutes tolerance
        return {
          valid: false,
          reason: `Game timestamp too old: ${timeDiff}ms difference`
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Rate limiting for IP addresses
 */
function checkRateLimit(ip, timestamp) {
  const key = `ip_${ip}`;
  const existing = rateLimitStore.get(key) || { count: 0, firstRequest: timestamp, lastRequest: 0 };
  
  // Reset counter if window expired
  if (timestamp - existing.firstRequest > RATE_LIMIT_WINDOW) {
    existing.count = 0;
    existing.firstRequest = timestamp;
  }
  
  // Check if too many requests
  if (existing.count >= MAX_SUBMISSIONS_PER_MINUTE) {
    return {
      allowed: false,
      reason: `IP rate limit exceeded: ${existing.count}/${MAX_SUBMISSIONS_PER_MINUTE}`,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (timestamp - existing.firstRequest)) / 1000)
    };
  }
  
  // Check minimum time between requests
  if (existing.lastRequest && (timestamp - existing.lastRequest) < MIN_TIME_BETWEEN_SUBMISSIONS) {
    return {
      allowed: false,
      reason: `Requests too frequent: ${timestamp - existing.lastRequest}ms < ${MIN_TIME_BETWEEN_SUBMISSIONS}ms`,
      retryAfter: Math.ceil((MIN_TIME_BETWEEN_SUBMISSIONS - (timestamp - existing.lastRequest)) / 1000)
    };
  }
  
  return { allowed: true };
}

/**
 * Rate limiting for wallet addresses
 */
function checkWalletRateLimit(wallet, userId, timestamp) {
  const key = `wallet_${wallet.toLowerCase()}`;
  const existing = sessionLimitStore.get(key) || { count: 0, firstRequest: timestamp, userId: userId };
  
  // Reset counter if window expired
  if (timestamp - existing.firstRequest > RATE_LIMIT_WINDOW) {
    existing.count = 0;
    existing.firstRequest = timestamp;
  }
  
  // Check if too many requests from this wallet
  if (existing.count >= MAX_SUBMISSIONS_PER_WALLET) {
    return {
      allowed: false,
      reason: `Wallet rate limit exceeded: ${existing.count}/${MAX_SUBMISSIONS_PER_WALLET}`,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (timestamp - existing.firstRequest)) / 1000)
    };
  }
  
  // Verify userId consistency
  if (existing.userId && existing.userId !== userId) {
    return {
      allowed: false,
      reason: `Wallet/user ID mismatch: expected ${existing.userId}, got ${userId}`,
      retryAfter: 60
    };
  }
  
  return { allowed: true };
}

/**
 * Update rate limit counters
 */
function updateRateLimitCounters(ip, wallet, userId, timestamp) {
  // Update IP counter
  const ipKey = `ip_${ip}`;
  const ipData = rateLimitStore.get(ipKey) || { count: 0, firstRequest: timestamp };
  ipData.count += 1;
  ipData.lastRequest = timestamp;
  rateLimitStore.set(ipKey, ipData);
  
  // Update wallet counter
  const walletKey = `wallet_${wallet.toLowerCase()}`;
  const walletData = sessionLimitStore.get(walletKey) || { count: 0, firstRequest: timestamp, userId };
  walletData.count += 1;
  walletData.userId = userId;
  sessionLimitStore.set(walletKey, walletData);
}

/**
 * Validate session data
 */
function validateSession(session) {
  if (!session || typeof session !== 'object') {
    return false;
  }
  
  // Check required fields
  for (const field of REQUIRED_SESSION_FIELDS) {
    if (!session[field]) {
      return false;
    }
  }
  
  // Check session age if loginTime is provided
  if (session.loginTime) {
    const age = Date.now() - session.loginTime;
    if (age < MIN_SESSION_AGE || age > 24 * 60 * 60 * 1000) { // Max 24 hours
      return false;
    }
  }
  
  return true;
}

/**
 * Log suspicious activity for monitoring
 */
function logSuspiciousActivity(ip, wallet, reason, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: ip,
    wallet: wallet,
    reason: reason,
    data: data
  };
  
  console.warn(`🚨 SUSPICIOUS ACTIVITY:`, JSON.stringify(logEntry, null, 2));
  
  // In production, you would send this to a monitoring service
  // like DataDog, Sentry, or store in a database
}