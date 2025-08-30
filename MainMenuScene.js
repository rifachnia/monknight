// ============ MAIN MENU SCENE ============
import { timeAttack } from './time_attack.js';

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
  }

  create() {
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

    // ========= HIT-ZONE UNTUK TOMBOL START (menutup tombol pixel besar) =========
    const START_WIDTH  = 520;   
    const START_HEIGHT = 110;   
    const START_Y      = centerY; 

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

    // ========= HIT-ZONE LEADERBOARD =========
    const LB_Y = centerY + 120;
    const lbHit = this.add.zone(centerX, LB_Y, START_WIDTH, START_HEIGHT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    lbHit.on('pointerup', () => {
      if (!this.isLoggedIn) {
        this.showToast?.('Please login first', '#ff6b6b');
        return;
      }
      this.scene.start('LeaderboardScene');
    });

    // ====== TOMBOL LOGIN (kanan-bawah, jangan menutup tombol START) ======
    const loginBtn = this.add.text(
      cam.width - 20, cam.height - 20,
      'Login with Monad Games ID',
      { fontFamily: 'pixelFont', fontSize: '18px',
        backgroundColor: '#5533aa', color: '#fff',
        padding: { x:12, y:6 } }
    ).setOrigin(1,1).setInteractive();

    loginBtn.on('pointerdown', () => {
      this.attemptLogin();
    });
    
    // Enhanced authentication event listening
    window.addEventListener('monknight-auth', this.handleAuthChange);

    // jaga posisi tombol login saat resize
    this.scale.on('resize', (g) => {
      const w = g?.width ?? cam.width, h = g?.height ?? cam.height;
      loginBtn.setPosition(w - 20, h - 20);
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
    if (window.privyReady && window.privyLogin) {
      console.log('🎮 Opening Privy login modal...');
      try {
        window.privyLogin(); // This will open Privy modal for authentication
      } catch (error) {
        console.error('❌ Error calling Privy login:', error);
        this.showToast?.('Login failed. Please try again.', '#ff6b6b');
      }
    } else {
      console.error('❌ Privy not ready or login function not available:', {
        privyReady: !!window.privyReady,
        privyLogin: !!window.privyLogin,
        privyLogout: !!window.privyLogout
      });
      
      this.showToast?.('Authentication system loading... Please wait a moment and try again.', '#ffaa00');
      
      // Extended retry logic for slow initialization
      let retryCount = 0;
      const maxRetries = 5;
      
      const retryLogin = () => {
        retryCount++;
        console.log(`🔄 Login retry attempt ${retryCount}/${maxRetries}`);
        
        if (window.privyReady && window.privyLogin) {
          console.log('♾️ Privy became ready during retry');
          this.showToast?.('Authentication system ready! Attempting login...', '#55ff99');
          try {
            window.privyLogin();
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
      // Update localStorage to match Privy state
      localStorage.setItem('mgid_user', username || address);
      const displayName = username || address?.slice(0, 6) + '...' + address?.slice(-4);
      this.showToast?.('Successfully logged in as ' + displayName, '#55ff99');
      console.log('✅ Privy login successful:', { address, username });
    } else {
      this.isLoggedIn = false;
      localStorage.removeItem('mgid_user');
      this.showToast?.('Logged out successfully', '#ffaa00');
      console.log('💪 Privy logout completed');
    }
  }

  // Handle Privy ready event
  handlePrivyReady(event) {
    console.log('🎉 Privy ready event received:', event.detail);
  }

  // Cleanup event listeners when scene is destroyed
  destroy() {
    // Clean up authentication event handlers
    window.removeEventListener('monknight-auth', this.handleAuthChange);
    
    // Clean up Privy ready event handlers if they exist
    if (this.authEventHandlers) {
      Object.entries(this.authEventHandlers).forEach(([event, handler]) => {
        window.removeEventListener(event, handler);
      });
    }
    
    console.log('🧹 MainMenuScene: Cleaned up event listeners');
    super.destroy();
  }

  // Helper methods
  startGame() {
    // Coba beberapa key scene umum; kalau tidak ketemu, auto-pilih non-menu
    const tryKeys = ['GameScene','MainScene','SceneMain','Game','BattleScene'];
    for (const k of tryKeys) {
      try { if (this.scene.get(k)) { this.scene.start(k); return; } } catch (e) {}
    }
    // fallback: pilih scene pertama yang bukan preload/menu/leaderboard
    const all = this.game.scene.scenes.map(s => s.sys.settings.key);
    const target = all.find(k => !/menu|preload|leader/i.test(k));
    if (target) this.scene.start(target);
    else console.warn('No game scene found. Available:', all);
  }

  showToast(msg, color = '#ff6b6b') {
    const t = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 140,
      msg, { fontFamily:'pixelFont', fontSize:'18px', color }).setOrigin(0.5);
    this.tweens.add({ targets:t, alpha:0, duration:1400, onComplete:() => t.destroy() });
  }

  // Create How to Play popup
  createHowToPlayPopup(howToPlayText, centerX, centerY) {
    // Popup panel (hidden by default)
    const panel = this.add.rectangle(centerX, centerY, 420, 280, 0x000000, 0.85)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false)
      .setDepth(1000);
      
    const instructions = this.add.text(centerX, centerY, 
      `F = Attack / Basic Attack\n` +
      `D = Flame Rocket Skill\n` +
      `SPACE = Dodge\n` +
      `Hold SHIFT = Sprint\n\n` +
      `Dodge grants a short iframe.\n` +
      `When your character outline is white,\n` +
      `it means you are invulnerable.`, 
      { fontSize: '18px', color: '#ffffff', align: 'center' }
    ).setOrigin(0.5).setVisible(false).setDepth(1001);

    const closeText = this.add.text(centerX, centerY + 110, '[ Close ]', {
      fontSize: '18px',
      color: '#ff0000'
    }).setOrigin(0.5).setInteractive().setVisible(false).setDepth(1001);

    howToPlayText.on('pointerdown', () => {
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      panel.setVisible(true);
      instructions.setVisible(true);
      closeText.setVisible(true);
    });

    closeText.on('pointerdown', () => {
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
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