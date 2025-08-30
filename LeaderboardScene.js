// LeaderboardScene.js
import { timeAttack } from './time_attack.js';
import { getPlayerAddress } from './contract.js';

// Utility aman panggil modul TA
function TA_call(methodName, ...args) {
  try {
    const fn = timeAttack && timeAttack[methodName];
    if (typeof fn === 'function') return fn.apply(timeAttack, args);
  } catch {}
  return undefined;
}

// Format score for display
function formatScore(score) {
  return score.toLocaleString();
}

// Format address for display
function formatAddress(address) {
  if (!address) return 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Fetch leaderboard data from blockchain
async function fetchBlockchainLeaderboard() {
  try {
    console.log('📊 Fetching blockchain leaderboard...');
    
    const response = await fetch('/api/leaderboard', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    console.log(`✅ Fetched ${data.leaderboard.length} players from blockchain`);
    return data.leaderboard || [];
    
  } catch (error) {
    console.error('❌ Failed to fetch blockchain leaderboard:', error);
    return [];
  }
}


export default class LeaderboardScene extends Phaser.Scene {
  constructor() { super('LeaderboardScene'); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    
    // Store current player address for highlighting
    this.currentPlayerAddress = getPlayerAddress();

    // Background overlay
    const bg = this.add.rectangle(W/2, H/2, W, H, 0x0a0f1f, 0.96).setScrollFactor(0);

    // Title
    this.add.text(W/2, 64, 'BLOCKCHAIN LEADERBOARD', {
      fontFamily: 'monospace', fontSize: 32, color: '#ffe066'
    }).setOrigin(0.5, 0.5);
    
    // Subtitle
    this.add.text(W/2, 92, 'Global scores from all players', {
      fontFamily: 'monospace', fontSize: 16, color: '#8fd3ff'
    }).setOrigin(0.5, 0.5);
    
    // External leaderboard link
    const externalLink = this.add.text(W/2, 112, 'View on Monad Games ID →', {
      fontFamily: 'monospace', fontSize: 14, color: '#4f46e5'
    }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
    
    externalLink.on('pointerover', () => externalLink.setStyle({ color: '#6366f1' }));
    externalLink.on('pointerout', () => externalLink.setStyle({ color: '#4f46e5' }));
    externalLink.on('pointerup', () => {
      window.open('https://monad-games-id-site.vercel.app/leaderboard', '_blank', 'noopener,noreferrer');
    });

    // Loading indicator
    this.loadingText = this.add.text(W/2, H/2, 'Loading blockchain data...', {
      fontFamily: 'monospace', fontSize: 18, color: '#ffaa00', align: 'center'
    }).setOrigin(0.5);

    // Load blockchain leaderboard data
    this.loadLeaderboard();
  }

  async loadLeaderboard() {
    try {
      // Fetch blockchain data
      const blockchainData = await fetchBlockchainLeaderboard();
      
      // Hide loading text
      if (this.loadingText) {
        this.loadingText.destroy();
        this.loadingText = null;
      }
      
      this.displayLeaderboard(blockchainData);
      
    } catch (error) {
      console.error('❌ Error loading leaderboard:', error);
      
      // Hide loading text and show error
      if (this.loadingText) {
        this.loadingText.destroy();
        this.loadingText = null;
      }
      
      this.displayError();
    }
  }
  
  displayLeaderboard(rows) {
    const W = this.scale.width, H = this.scale.height;
    
    if (!rows || rows.length === 0) {
      this.add.text(W/2, H/2, 'No scores recorded yet.\nBe the first to submit your score!', {
        fontFamily: 'monospace', fontSize: 18, color: '#cfd8dc', align: 'center'
      }).setOrigin(0.5);
      
      this.createBackButton();
      return;
    }

    // Header
    const startY = 150;
    this.add.text(W*0.1, startY, 'Rank', { fontFamily:'monospace', fontSize:16, color:'#8fd3ff' }).setOrigin(0,0.5);
    this.add.text(W*0.25, startY, 'Player', { fontFamily:'monospace', fontSize:16, color:'#8fd3ff' }).setOrigin(0,0.5);
    this.add.text(W*0.65, startY, 'Score', { fontFamily:'monospace', fontSize:16, color:'#8fd3ff' }).setOrigin(0,0.5);
    this.add.text(W*0.85, startY, 'Games', { fontFamily:'monospace', fontSize:16, color:'#8fd3ff' }).setOrigin(0,0.5);

    // Separator line
    const line = this.add.graphics();
    line.lineStyle(1, 0x8fd3ff, 0.5);
    line.moveTo(W*0.1, startY + 15);
    line.lineTo(W*0.9, startY + 15);
    line.stroke();

    // List entries
    const lineH = 24;
    const maxVisible = Math.floor((H - startY - 120) / lineH); // Leave space for back button
    const visibleRows = rows.slice(0, maxVisible);
    
    visibleRows.forEach((player, idx) => {
      const y = startY + 30 + idx * lineH;
      const isCurrentPlayer = this.currentPlayerAddress && 
                              player.address.toLowerCase() === this.currentPlayerAddress.toLowerCase();
      
      // Highlight current player
      const bgColor = isCurrentPlayer ? 0x2d4a22 : 0x000000;
      const textColor = isCurrentPlayer ? '#a3ff8f' : '#ffffff';
      const scoreColor = isCurrentPlayer ? '#ffff66' : '#ffe066';
      
      if (isCurrentPlayer) {
        // Highlight background for current player
        const highlight = this.add.rectangle(W/2, y, W*0.8, lineH-2, bgColor, 0.3);
      }
      
      // Rank with medal emojis for top 3
      let rankText = String(player.rank).padStart(2, ' ');
      if (player.rank === 1) rankText = '🥇 1';
      else if (player.rank === 2) rankText = '🥈 2';
      else if (player.rank === 3) rankText = '🥉 3';
      
      this.add.text(W*0.1, y, rankText, { 
        fontFamily:'monospace', fontSize:14, color: textColor 
      }).setOrigin(0, 0.5);
      
      // Player address (shortened)
      this.add.text(W*0.25, y, formatAddress(player.address), { 
        fontFamily:'monospace', fontSize:14, color: textColor 
      }).setOrigin(0, 0.5);
      
      // Score
      this.add.text(W*0.65, y, formatScore(player.score), { 
        fontFamily:'monospace', fontSize:14, color: scoreColor 
      }).setOrigin(0, 0.5);
      
      // Transaction count
      this.add.text(W*0.85, y, String(player.transactionCount), { 
        fontFamily:'monospace', fontSize:14, color: textColor 
      }).setOrigin(0, 0.5);
    });
    
    // Show total players if more than visible
    if (rows.length > visibleRows.length) {
      this.add.text(W/2, startY + 30 + visibleRows.length * lineH + 10, 
        `Showing top ${visibleRows.length} of ${rows.length} players`, {
        fontFamily: 'monospace', fontSize: 14, color: '#888888', align: 'center'
      }).setOrigin(0.5);
    }
    
    this.createBackButton();
  }
  
  displayError() {
    const W = this.scale.width, H = this.scale.height;
    
    this.add.text(W/2, H/2 - 20, 'Failed to load leaderboard', {
      fontFamily: 'monospace', fontSize: 20, color: '#ff6b6b', align: 'center'
    }).setOrigin(0.5);
    
    this.add.text(W/2, H/2 + 10, 'Please check your connection and try again', {
      fontFamily: 'monospace', fontSize: 14, color: '#cfd8dc', align: 'center'
    }).setOrigin(0.5);
    
    // Refresh button
    const refreshBtn = this.add.rectangle(W/2, H/2 + 50, 120, 36, 0x4f46e5, 0.8)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });
    
    this.add.text(W/2, H/2 + 50, 'REFRESH', { 
      fontFamily:'monospace', fontSize:16, color:'#ffffff' 
    }).setOrigin(0.5);
    
    refreshBtn.on('pointerover', () => refreshBtn.setFillStyle(0x6366f1, 0.9));
    refreshBtn.on('pointerout',  () => refreshBtn.setFillStyle(0x4f46e5, 0.8));
    refreshBtn.on('pointerup',   () => {
      // Reload the scene
      this.scene.restart();
    });
    
    this.createBackButton();
  }
  
  createBackButton() {
    const W = this.scale.width, H = this.scale.height;
    
    // Back button
    const btn = this.add.rectangle(W/2, H - 50, 200, 44, 0x123456, 0.8)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true });
      
    this.add.text(W/2, H - 50, 'BACK TO MENU', { 
      fontFamily:'monospace', fontSize:18, color:'#ffffff' 
    }).setOrigin(0.5);
    
    btn.on('pointerover', () => btn.setFillStyle(0x1b2a6b, 0.9));
    btn.on('pointerout',  () => btn.setFillStyle(0x123456, 0.8));
    btn.on('pointerup',   () => this.scene.start('MainMenu'));
  }
}
