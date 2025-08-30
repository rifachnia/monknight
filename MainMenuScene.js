// ============ MAIN MENU SCENE ============
import { timeAttack } from './time_attack.js';

// ============ MUSIC MANAGEMENT ============
/**
 * Play background music for main menu
 * @param {Phaser.Scene} scene - The current scene
 */
function playMainMenuMusic(scene) {
  if (!scene || !scene.sound) return null;
  
  try {
    // CRITICAL: Stop ALL existing music first
    scene.sound.stopAll();
    console.log('🔇 Stopped all existing music in MainMenu');
    
    // Play music SYNCHRONOUSLY (no delayedCall!) and return the object
    if (scene.cache.audio.exists('mainMenuTownMusic')) {
      const music = window.playMusic(scene, 'mainMenuTownMusic'); // Must use playMusic
      
      if (music) {
        console.log('🎵 Started Main Menu background music with real-time volume');
        // Immediately sync with current volume settings
        if (window.updateMusicVolumeNow) {
          window.updateMusicVolumeNow();
        }
      }
      return music; // Return actual sound object, not null!
    } else {
      console.warn('⚠️ mainMenuTownMusic not found in cache');
    }
  } catch (error) {
    console.warn('⚠️ Could not play main menu music:', error);
  }
  return null;
}

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenu' });
    this.isLoggedIn = false;
    
    // Bind event handlers to maintain proper context
    this.handleAuthChange = this.handleAuthChange.bind(this);
    this.handlePrivyReady = this.handlePrivyReady.bind(this);
  }

  preload() {
    // Load background image if available
    this.load.image('mainmenu', 'assets/mainmenu.png');
    
    // Load background music
    try {
      this.load.audio('mainMenuTownMusic', 'assets/sfx/Main Menu-Town.mp3');
      this.load.audio('bossmapMusic', 'assets/sfx/bossmap.mp3');
    } catch (error) {
      console.warn('⚠️ Could not load background music in MainMenu:', error);
    }
  }

  create() {
    // Notify React about scene change
    window.dispatchEvent(new CustomEvent('phaser-scene-change', {
      detail: { scene: 'MainMenuScene' }
    }));
    
    // Start background music for main menu and store the reference
    this.backgroundMusic = playMainMenuMusic(this);
    
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;
    const screenWidth = this.cameras.main.width;
    const screenHeight = this.cameras.main.height;

    // Background
    if (this.textures.exists('mainmenu')) {
      const bg = this.add.image(centerX, centerY, 'mainmenu');
      bg.setOrigin(0.5);
      bg.setDisplaySize(screenWidth, screenHeight);
    }

    // === TITLE REMOVED FOR CLEAN UI ===
    // Small title text removed to prevent overlap with main game elements

    // === START GAME BUTTON ===
    this.startBtn = this.add.text(centerX, centerY, 'START GAME', {
      fontSize: '28px',
      backgroundColor: '#002244',
      color: '#FFFFFF',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    // === LEADERBOARD BUTTON ===
    this.leaderBtn = this.add.text(centerX, centerY + 80, 'LEADERBOARD', {
      fontSize: '28px',
      backgroundColor: '#002244',
      color: '#FFFFFF',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    // === HOW TO PLAY BUTTON (Bottom-left) ===
    const howToPlayText = this.add.text(20, screenHeight - 30, 'How to Play?', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0, 1).setInteractive();

    // === HOW TO PLAY POPUP ===
    this.createHowToPlayPopup(howToPlayText, centerX, centerY);

    // Clean up overlapping text elements
    this.children.list
      .filter(o =>
        (o instanceof Phaser.GameObjects.Text || o instanceof Phaser.GameObjects.BitmapText) &&
        /^(START\s+GAME|LEADERBOARD)$/i.test(((o.text || '') + '').replace(/\s+/g,' ').trim())
      )
      .forEach(o => o.destroy());

    // Clean up small title text overlays (MONKNIGHT & TOP-DOWN RPG) if any remain
    this.children.list
      .filter(o =>
        (o instanceof Phaser.GameObjects.Text) &&
        /^(MONKNIGHT|TOP[\s\-_]?DOWN\s*RPG)$/i
          .test(((o.text || '') + '').replace(/\s+/g,' ').trim())
      )
      .forEach(o => o.destroy());

    // ====== LOGIN STATE SEDERHANA (pakai localStorage + Privy events) ======
    this.isLoggedIn = !!localStorage.getItem('mgid_user'); // true kalau sudah login
    
    // Check for existing Privy authentication state
    if (window.MONKNIGHT_AUTH?.address) {
      this.isLoggedIn = true;
    }

    // Debug: Check if Privy functions are available
    console.log('🔍 Privy integration check:', {
      privyLogin: !!window.privyLogin,
      privyLogout: !!window.privyLogout,
      privyReady: !!window.privyReady,
      monknightAuth: !!window.MONKNIGHT_AUTH,
      localStorage: !!localStorage.getItem('mgid_user'),
      reactRoot: !!document.getElementById('root'),
      timestamp: new Date().toISOString()
    });
    
    // Check if React scripts are loaded
    const scripts = Array.from(document.scripts).map(s => s.src);
    console.log('📦 Loaded scripts:', scripts.filter(s => s.includes('main') || s.includes('react')));

    // Listen for Privy ready events with better handling
    const handlePrivyReady = (event) => {
      console.log('🎉 Privy is ready! Functions available.');
      this.updateAuthState();
    };
    
    const handleAuthReady = (event) => {
      console.log('🔐 Auth system ready:', event.detail);
      this.updateAuthState();
    };
    
    window.addEventListener('privy-ready', handlePrivyReady);
    window.addEventListener('auth-ready', handleAuthReady);
    
    // Store event handlers for cleanup
    this.authEventHandlers = {
      'privy-ready': handlePrivyReady,
      'auth-ready': handleAuthReady
    };

    // Progressive Privy initialization check with extended retry logic
    this.startPrivyStatusCheck();

    const cam = this.cameras.main;

    // ========= HIT-ZONE UNTUK TOMBOL START (match orange box precisely) =========
    const START_WIDTH  = 480;   // Reduced to match orange border width exactly
    const START_HEIGHT = 75;    // Slightly adjusted height
    const START_Y      = centerY + 50; // Move up by 5px (was +55, now +50)

    const startHit = this.add.zone(centerX, START_Y, START_WIDTH, START_HEIGHT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startHit.on('pointerup', () => {
      if (!this.isLoggedIn) {
        this.showToast?.('Please login first', '#ff6b6b');
        return;
      }
      this.startGame();
    });

    // ========= HIT-ZONE LEADERBOARD (match orange box precisely) =========
    const LB_WIDTH = 480;       // Same width as START for consistency
    const LB_HEIGHT = 75;       // Same height as START
    const LB_Y = centerY + 150; // Move down by 10px (was +140, now +150)
    const lbHit = this.add.zone(centerX, LB_Y, LB_WIDTH, LB_HEIGHT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    lbHit.on('pointerup', () => {
      if (!this.isLoggedIn) {
        this.showToast?.('Please login first', '#ff6b6b');
        return;
      }
      
      // Stop main menu music before transitioning to leaderboard
      if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
        this.backgroundMusic.stop();
      }
      
      this.scene.start('LeaderboardScene');
    });

    // ====== LOGIN BUTTON (bottom-right, styled like other game UI) ======
    this.loginBtn = this.add.text(
      cam.width - 20, cam.height - 20,
      'Sign in with Monad Games ID',
      { fontFamily: 'pixelFont', fontSize: '18px',
        backgroundColor: '#4f46e5', color: '#fff',
        padding: { x:12, y:6 } }
    ).setOrigin(1,1).setInteractive({ useHandCursor: true });

    // Only show login button if not logged in
    this.loginBtn.setVisible(!this.isLoggedIn);

    this.loginBtn.on('pointerdown', () => {
      // Call React authentication function
      if (window.privyLoginMonad) {
        window.privyLoginMonad();
      } else if (window.privyLogin) {
        window.privyLogin();
      } else {
        this.showToast?.('Authentication system loading...', '#ffaa00');
      }
    });
    
    // Enhanced authentication event listening
    window.addEventListener('monknight-auth', this.handleAuthChange);

    // Handle window resize to keep button positioned correctly
    this.scale.on('resize', (g) => {
      const w = g?.width ?? cam.width, h = g?.height ?? cam.height;
      this.loginBtn.setPosition(w - 20, h - 20);
    });
  }

  // Start Privy status checking with progressive delays
  startPrivyStatusCheck() {
    let checkCount = 0;
    const maxChecks = 10;
    
    const checkPrivyStatus = () => {
      checkCount++;
      
      if (window.privyReady) {
        console.log(`✅ Privy ready after ${checkCount} checks`);
        this.updateAuthState();
        return;
      }
      
      if (checkCount <= 3) {
        console.log(`⏳ Waiting for Privy to initialize... (Check ${checkCount}/${maxChecks})`);
      } else if (checkCount <= 6) {
        console.log(`⏳ Still waiting for Privy... (Check ${checkCount}/${maxChecks}) - This may take a moment.`);
      } else {
        console.log(`⚠️ Extended wait for Privy... (Check ${checkCount}/${maxChecks}) - Possible network delay.`);
      }
      
      // Detailed status check
      const status = {
        privyReady: !!window.privyReady,
        privyLogin: !!window.privyLogin,
        privyLogout: !!window.privyLogout,
        rootElement: !!document.getElementById('root'),
        reactErrors: 'Check console for React errors',
        timestamp: new Date().toISOString()
      };
      
      console.log(`🔍 Check ${checkCount} - Privy status:`, status);
      
      if (checkCount >= maxChecks) {
        console.warn('⚠️ Privy still not ready after extended wait. Possible issues:');
        console.warn('1. React component failed to mount properly');
        console.warn('2. Privy SDK failed to initialize due to network issues');
        console.warn('3. Environment/configuration issues');
        console.warn('4. Browser compatibility issues');
        
        // Try one final check with detailed diagnostics
        setTimeout(() => {
          console.log('🔍 Final diagnostic check:');
          console.log('- Window object keys:', Object.keys(window).filter(k => k.includes('privy')));
          console.log('- React root element:', document.getElementById('root'));
          console.log('- Script tags:', Array.from(document.scripts).length);
          console.log('- Console errors count:', this.getConsoleErrorCount());
        }, 1000);
        
        return;
      }
      
      // Progressive delay: 1s, 1s, 1s, 2s, 2s, 3s, 3s, 5s, 5s, 8s
      const nextDelay = checkCount <= 3 ? 1000 : 
                       checkCount <= 5 ? 2000 : 
                       checkCount <= 7 ? 3000 : 
                       checkCount <= 9 ? 5000 : 8000;
      
      setTimeout(checkPrivyStatus, nextDelay);
    };
    
    // Start the check
    setTimeout(checkPrivyStatus, 500); // Initial delay to let React mount
  }
  
  // Helper method to get console error count (for diagnostics)
  getConsoleErrorCount() {
    return document.querySelectorAll('[data-error]').length || 'Unknown';
  }
  
  // Method to update authentication state
  updateAuthState() {
    const wasLoggedIn = this.isLoggedIn;
    this.isLoggedIn = !!localStorage.getItem('mgid_user') || !!(window.MONKNIGHT_AUTH?.address);
    
    if (wasLoggedIn !== this.isLoggedIn) {
      console.log('🔄 Auth state changed:', { wasLoggedIn, nowLoggedIn: this.isLoggedIn });
    }
  }
  
  // Improved login attempt method
  attemptLogin() {
    // Check if Privy is ready and functions are available
    if (window.privyReady && (window.privyLoginMonad || window.privyLogin)) {
      console.log('🎮 Opening Monad Games ID cross-app login...');
      try {
        // Use specific Monad login if available, fallback to standard login
        if (window.privyLoginMonad) {
          window.privyLoginMonad(); // This uses loginWithCrossAppAccount for Monad Games ID
        } else {
          window.privyLogin(); // Fallback to standard login
        }
      } catch (error) {
        console.error('❌ Error calling Privy login:', error);
        this.showToast?.('Login failed. Please try again.', '#ff6b6b');
      }
    } else {
      console.error('❌ Privy not ready or login function not available:', {
        privyReady: !!window.privyReady,
        privyLogin: !!window.privyLogin,
        privyLoginMonad: !!window.privyLoginMonad,
        privyLogout: !!window.privyLogout
      });
      
      this.showToast?.('Authentication system loading... Please wait a moment and try again.', '#ffaa00');
      
      // Extended retry logic for slow initialization
      let retryCount = 0;
      const maxRetries = 5;
      
      const retryLogin = () => {
        retryCount++;
        console.log(`🔄 Login retry attempt ${retryCount}/${maxRetries}`);
        
        if (window.privyReady && (window.privyLoginMonad || window.privyLogin)) {
          console.log('♾️ Privy became ready during retry');
          this.showToast?.('Authentication system ready! Attempting login...', '#55ff99');
          try {
            if (window.privyLoginMonad) {
              window.privyLoginMonad();
            } else {
              window.privyLogin();
            }
          } catch (error) {
            console.error('❌ Error during retry login:', error);
            this.showToast?.('Login failed. Please refresh the page.', '#ff6b6b');
          }
        } else if (retryCount < maxRetries) {
          this.showToast?.(`Still loading... Retry ${retryCount}/${maxRetries}`, '#ffaa00');
          
          // Progressive delay: 1s, 3s, 6s, 10s, 15s
          const delay = retryCount * retryCount * 1000 + 1000;
          setTimeout(retryLogin, delay);
        } else {
          console.warn('⚠️ Max login retries reached');
          this.showToast?.('Authentication system failed to load. Please refresh the page.', '#ff6b6b');
        }
      };
      
      // Start retry sequence
      setTimeout(retryLogin, 1000);
    }
  }

  // Handle authentication state changes from Privy
  handleAuthChange(event) {
    const { authenticated, address, username } = event.detail;
    
    if (authenticated && (address || username)) {
      this.isLoggedIn = true;
      // Hide login button when logged in
      if (this.loginBtn) {
        this.loginBtn.setVisible(false);
      }
      // Update localStorage to match Privy state
      localStorage.setItem('mgid_user', username || address);
      const displayName = username || address?.slice(0, 6) + '...' + address?.slice(-4);
      this.showToast?.('Successfully logged in as ' + displayName, '#55ff99');
      console.log('✅ Privy login successful:', { address, username });
    } else {
      this.isLoggedIn = false;
      // Show login button when logged out
      if (this.loginBtn) {
        this.loginBtn.setVisible(true);
      }
      // Clear localStorage
      localStorage.removeItem('mgid_user');
      this.showToast?.('Logged out successfully', '#ffaa00');
      console.log('🔓 Privy logout successful');
    }
  }

  // Handle Privy ready event
  handlePrivyReady(event) {
    console.log('🎉 Privy ready event received:', event.detail);
  }

  // Cleanup event listeners when scene is destroyed
  destroy() {
    // Stop background music when leaving main menu
    if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
      try {
        this.backgroundMusic.stop();
        this.backgroundMusic.destroy();
        console.log('🔇 MainMenu: Stopped music on scene destroy');
      } catch (error) {
        console.warn('⚠️ Error stopping MainMenu music:', error);
      }
    }
    
    // Clean up authentication event handlers
    window.removeEventListener('monknight-auth', this.handleAuthChange);
    
    // Clean up Privy ready event handlers if they exist
    if (this.authEventHandlers) {
      Object.entries(this.authEventHandlers).forEach(([event, handler]) => {
        window.removeEventListener(event, handler);
      });
    }
    
    console.log('🧹 MainMenuScene: Cleaned up event listeners and music');
    super.destroy();
  }

  // Helper methods
  startGame() {
    // Stop main menu music before transitioning
    if (this.backgroundMusic && this.backgroundMusic.isPlaying) {
      this.backgroundMusic.stop();
    }
    
    // Start fresh game in town map with full reset
    this.scene.start('Game', { 
      mapKey: 'town', 
      spawn: { x: 160, y: 224 }, 
      resetState: true 
    });
  }

  showToast(msg, color = '#ff6b6b') {
    const t = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 20,
      msg, { fontFamily:'pixelFont', fontSize:'18px', color }).setOrigin(0.5);
    this.tweens.add({ targets:t, alpha:0, duration:1400, onComplete:() => t.destroy() });
  }

  // Create How to Play popup
  createHowToPlayPopup(howToPlayText, centerX, centerY) {
    // Popup panel (hidden by default)
    const panel = this.add.rectangle(centerX, centerY, 500, 450, 0x000000, 0.85)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false)
      .setDepth(1000);
      
    const instructions = this.add.text(centerX, centerY, 
      `Use the arrow keys for movement.\n\n` +
      `F = Attack\n` +
      `D = Flame Rocket skill\n` +
      `Space = Dodge\n` +
      `Hold Shift while moving = Sprint\n\n` +
      `Dodge grants short iFrame.\n` +
      `When your character outline is white, it means you are invulnerable.\n\n` +
      `When the game starts, walk straight to the right where the underground portal is to go directly to the boss room.\n` +
      `Defeat the boss as quickly as possible to get a higher score!\n\n` +
      `Boss Skills:\n\n` +
      `Above 50%: Fireball\n\n` +
      `Under 50%: Multi-fireball with explosion. If you get hit, the damage will doubled.\n\n` +
      `Under 30%: The boss will spawn minions.`, 
      { fontSize: '15px', color: '#ffffff', align: 'center', wordWrap: { width: 460 } }
    ).setOrigin(0.5).setVisible(false).setDepth(1001);

    const closeText = this.add.text(centerX, centerY + 190, '[ Close ]', {
      fontSize: '18px',
      color: '#ff0000'
    }).setOrigin(0.5).setInteractive().setVisible(false).setDepth(1001);

    howToPlayText.on('pointerdown', () => {
      try { 
        const gameScene = this.scene.get('Game');
        if (gameScene?.sfx?.uiClick) {
          // Use playSFX if available, fallback to direct play
          if (window.playSFX) {
            window.playSFX(gameScene.sfx.uiClick);
          } else {
            gameScene.sfx.uiClick.play();
          }
        }
      } catch {}
      panel.setVisible(true);
      instructions.setVisible(true);
      closeText.setVisible(true);
    });

    closeText.on('pointerdown', () => {
      try { 
        const gameScene = this.scene.get('Game');
        if (gameScene?.sfx?.uiClick) {
          // Use playSFX if available, fallback to direct play
          if (window.playSFX) {
            window.playSFX(gameScene.sfx.uiClick);
          } else {
            gameScene.sfx.uiClick.play();
          }
        }
      } catch {}
      panel.setVisible(false);
      instructions.setVisible(false);
      closeText.setVisible(false);
    });
    
    // Add hover effect to How to Play
    howToPlayText.on('pointerover', () => {
      this.input.setDefaultCursor('pointer');
      howToPlayText.setStyle({ color: '#ffff00' });
    });
    howToPlayText.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      howToPlayText.setStyle({ color: '#ffffff' });
    });
  }
}