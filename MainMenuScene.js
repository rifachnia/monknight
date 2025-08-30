// ============ MAIN MENU SCENE ============
import { timeAttack } from './time_attack.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenu' });
    this.isLoggedIn = false;
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

    // === TITLE ===
    this.add.text(centerX, 150, 'MONKNIGHT', {
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#FFB800'
    }).setOrigin(0.5);

    this.add.text(centerX, 220, 'TOP-DOWN RPG', {
      fontSize: '28px',
      color: '#FFFFFF'
    }).setOrigin(0.5);

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

    // --- Remove overlapping text labels that cover main buttons ---
    this.children.list
      .filter(o =>
        (o instanceof Phaser.GameObjects.Text || o instanceof Phaser.GameObjects.BitmapText) &&
        /^(START\s+GAME|LEADERBOARD)$/i.test(((o.text || '') + '').replace(/\s+/g,' ').trim())
      )
      .forEach(o => o.destroy());

    // ===== Login state management =====
    this.isLoggedIn = !!localStorage.getItem('mgid_user');

    // ===== Login button (bottom-right, aligned with "How to Play?") =====
    const cam = this.cameras.main;
    const loginBtn = this.add.text(
      cam.width - 20, cam.height - 20,
      'Login with Monad Games ID',
      {
        fontFamily: 'pixelFont',
        fontSize: '18px',
        backgroundColor: '#5533aa',
        color: '#ffffff',
        padding: { x: 12, y: 6 }
      }
    ).setOrigin(1,1).setInteractive();

    // Keep position during resize
    this.scale.on('resize', (g) => {
      const w = g?.width ?? cam.width, h = g?.height ?? cam.height;
      loginBtn.setPosition(w - 20, h - 20);
    });

    // Mock login - will be replaced with Privy/Monad Games ID SDK
    loginBtn.on('pointerdown', () => {
      const u = window.prompt('Enter Monad Games ID username:');
      if (u && u.trim()) {
        localStorage.setItem('mgid_user', u.trim());
        this.isLoggedIn = true;
        this.showToast('Logged in as ' + u.trim(), '#55ff99');
      }
    });

    // ====== LOGIN GATING FOR BUTTONS ======
    // Remove existing listeners and add login check
    if (this.startBtn && this.startBtn.removeAllListeners) {
      this.startBtn.removeAllListeners('pointerdown');
    }
    this.startBtn.on('pointerdown', () => {
      if (!this.isLoggedIn) {
        this.showToast('Please login first', '#ff6b6b');
        return;
      }
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      this.scene.start('Game', { mapKey: 'town' });
    });

    if (this.leaderBtn && this.leaderBtn.removeAllListeners) {
      this.leaderBtn.removeAllListeners('pointerdown');
    }
    this.leaderBtn.on('pointerdown', () => {
      if (!this.isLoggedIn) {
        this.showToast('Please login first', '#ff6b6b');
        return;
      }
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      this.scene.launch('Leaderboard');
      this.scene.bringToTop('Leaderboard');
      this.scene.pause();
    });

    // === KEYBOARD SHORTCUTS ===
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.isLoggedIn) {
        try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
        this.scene.start('Game', { mapKey: 'town' });
      } else {
        this.showToast('Please login first', '#ff6b6b');
      }
    });

    this.input.keyboard.on('keydown-L', () => {
      if (this.isLoggedIn && !this.scene.isActive('Leaderboard')) {
        try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
        this.scene.launch('Leaderboard');
        this.scene.bringToTop('Leaderboard');
        this.scene.pause();
      } else {
        this.showToast('Please login first', '#ff6b6b');
      }
    });

    // Fallback login gating for any interactive menu objects
    this.input.on('gameobjectdown', (pointer, obj) => {
      if (this.isLoggedIn) return;
      
      const isMenuObject = (obj.type === 'Image' || obj.type === 'Sprite' || obj.type === 'Container' || obj.type === 'Text');
      if (isMenuObject && obj !== loginBtn && obj !== howToPlayText) {
        this.showToast('Please login first', '#ff6b6b');
        pointer.event.stopImmediatePropagation();
      }
    }, this);

    // Toast helper
    this.showToast = (msg, color='#ff6b6b') => {
      const t = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 140,
        msg, { fontFamily: 'pixelFont', fontSize: '18px', color }).setOrigin(0.5);
      this.tweens.add({ targets: t, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
    };
  }

  // Helper method for toast notifications (defined in create method above)
  // showToast is defined inline in create() to avoid duplication

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
