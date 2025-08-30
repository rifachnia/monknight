// ============ MAIN MENU SCENE ============
import { timeAttack } from './time_attack.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenu' });
    this.isLoggedIn = false;
    
    // Bind event handler to maintain proper context
    this.handleAuthChange = this.handleAuthChange.bind(this);
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
      // Use Privy SDK for login instead of prompt
      if (window.privyLogin) {
        window.privyLogin(); // This will open Privy modal for authentication
      } else {
        // Fallback to mock login if Privy is not available
        console.warn('Privy login not available, using fallback');
        const u = window.prompt('Enter Monad Games ID username (fallback):');
        if (u && u.trim()) {
          localStorage.setItem('mgid_user', u.trim());
          this.isLoggedIn = true;
          this.showToast?.('Logged in as ' + u.trim(), '#55ff99');
        }
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
      const displayName = username || address?.slice(0, 6) + '...' + address?.slice(-4);
      this.showToast?.('Logged in as ' + displayName, '#55ff99');
    } else {
      this.isLoggedIn = false;
      localStorage.removeItem('mgid_user');
    }
  }

  // Cleanup event listeners when scene is destroyed
  destroy() {
    window.removeEventListener('monknight-auth', this.handleAuthChange);
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
