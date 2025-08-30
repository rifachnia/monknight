// ============ MAIN MENU SCENE ============
import { timeAttack } from './time_attack.js';
import { hasUsername } from './game.js';
import { saveSession, loadSession, clearSession, isLoggedIn, mockLogin, mockLogout, getCurrentUser } from './session.js';

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
    // Check environment
    const isDev = process.env.NODE_ENV !== 'production';
    
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

    // === STATUS TEXT ===
    this.statusText = this.add.text(centerX, centerY + 160, 'Not logged in', {
      fontSize: '16px',
      color: '#999'
    }).setOrigin(0.5);

    // Load initial state
    timeAttack.loadBestLocal();
    this.updateLoginState();

    // === ENVIRONMENT-BASED AUTHENTICATION ===
    if (isDev) {
      this.createDevAuthUI(screenWidth, screenHeight);
      
      // Dev mode indicator
      this.add.text(centerX, screenHeight - 60, '(Dev Mode - Mock Authentication)', {
        fontSize: '14px',
        color: '#bbb'
      }).setOrigin(0.5);
    } else {
      this.createProdAuthUI(screenWidth, screenHeight);
    }

    // === BUTTON EVENT HANDLERS ===
    this.startBtn.on('pointerdown', () => {
      if (this.isLoggedIn) {
        try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
        this.scene.start('Game', { mapKey: 'town' });
      } else {
        alert('Please login first!');
      }
    });

    this.leaderBtn.on('pointerdown', () => {
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      if (this.isLoggedIn) {
        this.scene.launch('Leaderboard');
        this.scene.bringToTop('Leaderboard');
        this.scene.pause();
      } else {
        alert('Please login to view leaderboard!');
      }
    });

    // === HOW TO PLAY POPUP ===
    this.createHowToPlayPopup(howToPlayText, centerX, centerY);

    // === KEYBOARD SHORTCUTS ===
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.isLoggedIn) {
        try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
        this.scene.start('Game', { mapKey: 'town' });
      }
    });

    this.input.keyboard.on('keydown-L', () => {
      if (this.isLoggedIn && !this.scene.isActive('Leaderboard')) {
        try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
        this.scene.launch('Leaderboard');
        this.scene.bringToTop('Leaderboard');
        this.scene.pause();
      }
    });
  }

  // Create Development Authentication UI
  createDevAuthUI(screenWidth, screenHeight) {
    // Mock Login button (bottom-right)
    this.loginBtn = this.add.text(
      screenWidth - 20,
      screenHeight - 100,
      'Mock Login (Dev)',
      {
        fontSize: '18px',
        backgroundColor: '#5533aa',
        color: '#FFFFFF',
        padding: { x: 12, y: 6 }
      }
    ).setOrigin(1, 1).setInteractive();

    this.loginBtn.on('pointerdown', async () => {
      const username = await this.doMockLogin();
      if (username) {
        this.isLoggedIn = true;
        this.updateLoginState();
      }
    });

    // Register Username button (only if not logged in)
    this.registerBtn = this.add.text(
      screenWidth - 20,
      screenHeight - 140,
      'Register Username',
      {
        fontSize: '16px',
        backgroundColor: '#4f46e5',
        color: '#FFFFFF',
        padding: { x: 10, y: 5 }
      }
    ).setOrigin(1, 1).setInteractive();

    this.registerBtn.on('pointerdown', () => {
      window.open('https://monad-games-id-site.vercel.app/', '_blank');
    });

    // Hover effects
    this.addHoverEffects(this.loginBtn, '#5533aa', '#6644bb');
    this.addHoverEffects(this.registerBtn, '#4f46e5', '#5856eb');
  }

  // Create Production Authentication UI
  createProdAuthUI(screenWidth, screenHeight) {
    // Monad Games ID login button (bottom-right)
    this.loginBtn = this.add.text(
      screenWidth - 20,
      screenHeight - 100,
      'Login with Monad Games ID',
      {
        fontSize: '18px',
        backgroundColor: '#5533aa',
        color: '#FFFFFF',
        padding: { x: 12, y: 6 }
      }
    ).setOrigin(1, 1).setInteractive();

    this.loginBtn.on('pointerdown', async () => {
      // TODO: Replace with Privy SDK call
      await this.startMonadLogin();
    });

    // Hover effects
    this.addHoverEffects(this.loginBtn, '#5533aa', '#6644bb');
  }

  // Update login state and UI
  updateLoginState() {
    const session = loadSession();
    this.isLoggedIn = !!(session && session.userId);
    
    if (this.isLoggedIn) {
      // Enable buttons
      this.startBtn.setAlpha(1);
      this.startBtn.setInteractive();
      this.leaderBtn.setAlpha(1);
      
      // Update status
      this.statusText.setText(`Logged in as ${session.username}`);
      this.statusText.setColor('#90EE90');
      
      // Update login button text
      if (this.loginBtn) {
        this.loginBtn.setText('Logout');
      }
      
      // Hide register button if exists
      if (this.registerBtn) {
        this.registerBtn.setVisible(false);
      }
    } else {
      // Disable buttons
      this.startBtn.setAlpha(0.5);
      this.startBtn.disableInteractive();
      this.leaderBtn.setAlpha(0.5);
      
      // Update status
      this.statusText.setText('Please login first');
      this.statusText.setColor('#ff6666');
      
      // Update login button text
      if (this.loginBtn) {
        const isDev = process.env.NODE_ENV !== 'production';
        this.loginBtn.setText(isDev ? 'Mock Login (Dev)' : 'Login with Monad Games ID');
      }
      
      // Show register button if exists
      if (this.registerBtn) {
        this.registerBtn.setVisible(true);
      }
    }
  }

  // Mock login for development
  async doMockLogin() {
    const current = loadSession();
    if (current) {
      // Logout
      const result = mockLogout();
      if (result.success) {
        this.updateLoginState();
        return null;
      }
    } else {
      // Login
      const username = window.prompt('Enter username (dev login):', 'Monknight');
      if (username && username.trim()) {
        const result = await mockLogin(username.trim());
        
        if (result.success) {
          // Update game's player identity for backward compatibility
          window.MONKNIGHT_AUTH = {
            address: result.session.walletAddress,
            username: result.session.username
          };
          window.dispatchEvent(new CustomEvent('monknight-auth', {
            detail: {
              address: result.session.walletAddress,
              username: result.session.username
            }
          }));
          
          return result.session.username;
        } else {
          alert('Login failed: ' + result.error);
          return null;
        }
      }
    }
    return null;
  }

  // Production Monad Games ID login
  async startMonadLogin() {
    try {
      // TODO: Replace with actual Privy SDK integration
      console.log('Starting Monad Games ID login...');
      alert('Monad Games ID integration coming soon!\nUsing mock login for now.');
      
      // For now, fallback to mock login
      return await this.doMockLogin();
    } catch (error) {
      console.error('Monad login error:', error);
      alert('Login failed. Please try again.');
    }
  }

  // Add hover effects to buttons
  addHoverEffects(button, normalColor, hoverColor) {
    button.on('pointerover', () => {
      this.input.setDefaultCursor('pointer');
      button.setStyle({ backgroundColor: hoverColor });
    });
    button.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      button.setStyle({ backgroundColor: normalColor });
    });
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
