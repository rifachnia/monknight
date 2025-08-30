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

    // Listen for Privy ready event
    window.addEventListener('privy-ready', (event) => {
      console.log('🎉 Privy is ready! Functions available.');
      // Update button state if needed
    });

    // Give React time to load and initialize Privy
    setTimeout(() => {
      if (!window.privyReady) {
        console.log('⏳ Waiting for Privy to initialize... This may take a moment.');
        
        // Check again after more time
        setTimeout(() => {
          console.log('🔍 Second check - Privy status:', {
            privyReady: !!window.privyReady,
            privyLogin: !!window.privyLogin,
            privyLogout: !!window.privyLogout,
            rootElement: !!document.getElementById('root'),
            reactErrors: 'Check console for React errors'
          });
          
          if (!window.privyReady) {
            console.warn('⚠️ Privy still not ready after 3 seconds. Possible issues:');
            console.warn('1. React component failed to mount');
            console.warn('2. Privy SDK failed to initialize');
            console.warn('3. Environment/network issues');
          }
        }, 2000);
      }
    }, 1000);

    const cam = this.cameras.main;

    // ========= HIT-ZONE UNTUK TOMBOL START (menutup tombol pixel besar) =========
    // Ukuran kira-kira mengikuti tombol pixel oranye. Atur sedikit jika tidak pas.
    const START_WIDTH  = 520;   // tweak kalau perlu (±10–30 px)
    const START_HEIGHT = 110;   // tweak kalau perlu
    const START_Y      = centerY; // sama seperti posisi tombol START besar

    const startHit = this.add.zone(centerX, START_Y, START_WIDTH, START_HEIGHT)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startHit.on('pointerup', () => {
      if (!this.isLoggedIn) {
        this.showToast?.('Please login first', '#ff6b6b'); // pesan jika belum login
        return;
      }
      this.startGame(); // masuk ke in-game
    });

    // ========= (opsional) HIT-ZONE LEADERBOARD, kalau kamu mau aktif juga =========
    const LB_Y = centerY + 120; // biasanya 100–130 px di bawah START. Sesuaikan sedikit.
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
        
        // Try to wait for Privy to be ready
        setTimeout(() => {
          if (window.privyReady && window.privyLogin) {
            console.log('♾️ Privy became ready after delay');
            this.showToast?.('Authentication system ready! You can now login.', '#55ff99');
          } else {
            console.log('⚠️ Privy still not ready. Trying longer wait...');
            this.showToast?.('Still loading... Please wait a few more seconds.', '#ffaa00');
            
            // Try one more time with even longer delay
            setTimeout(() => {
              if (window.privyReady && window.privyLogin) {
                console.log('♾️ Privy ready after extended wait');
                this.showToast?.('Authentication ready! Please try logging in again.', '#55ff99');
              } else {
                console.error('❌ Privy failed to initialize after extended wait');
                this.showToast?.('Please refresh the page and try again.', '#ff6b6b');
              }
            }, 3000);
          }
        }, 2000);
      }
    });

    // Listen for Privy authentication events
    window.addEventListener('monknight-auth', this.handleAuthChange);

    // jaga posisi tombol login saat resize
    this.scale.on('resize', (g) => {
      const w = g?.width ?? cam.width, h = g?.height ?? cam.height;
      loginBtn.setPosition(w - 20, h - 20);
    });
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
    // Could update UI state here if needed
  }

  // Cleanup event listeners when scene is destroyed
  destroy() {
    window.removeEventListener('monknight-auth', this.handleAuthChange);
    window.removeEventListener('privy-ready', this.handlePrivyReady);
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
