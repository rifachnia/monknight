// ============ MAIN MENU SCENE ============
import { timeAttack } from './time_attack.js';
import { hasUsername } from './game.js';
import { saveSession, loadSession, clearSession, isLoggedIn, mockLogin, mockLogout, getCurrentUser } from './session.js';

class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenu' });
  }

  preload() {
    // Ganti path sesuai tempat kamu simpan gambar
    this.load.image('mainmenu', 'assets/mainmenu.png');
  }

  create() {
    // Tampilkan background main menu
    const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'mainmenu');
    bg.setOrigin(0.5);
    bg.setDisplaySize(this.scale.width, this.scale.height);

    // --- Posisi tombol (manual, karena gambar static) ---
    const startBtnArea = this.add.zone(this.scale.width/2, this.scale.height/2 + 40, 250, 60);
    const leaderboardBtnArea = this.add.zone(this.scale.width/2, this.scale.height/2 + 120, 250, 60);

    startBtnArea.setOrigin(0.5).setInteractive();
    leaderboardBtnArea.setOrigin(0.5).setInteractive();

    timeAttack.loadBestLocal();   // <--- tambahkan ini

    // Event klik
    startBtnArea.on('pointerdown', () => {
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      // mulai ke Game scene
      this.scene.start('Game', { mapKey: 'town' });
    });

    leaderboardBtnArea.on('pointerdown', () => {
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      // buka Leaderboard sebagai overlay
      this.scene.launch('Leaderboard');
      this.scene.bringToTop('Leaderboard');
      this.scene.pause();
    });

    // Cursor hover effect
    startBtnArea.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    startBtnArea.on('pointerout', () => this.input.setDefaultCursor('default'));
    leaderboardBtnArea.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    leaderboardBtnArea.on('pointerout', () => this.input.setDefaultCursor('default'));

    // Keyboard shortcut
    this.input.keyboard.on('keydown-ENTER', () => {
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      this.scene.start('Game', { mapKey: 'town' });
    });
    this.input.keyboard.on('keydown-L', () => {
      try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
      if (!this.scene.isActive('Leaderboard')) {
        this.scene.launch('Leaderboard');
        this.scene.bringToTop('Leaderboard');
        this.scene.pause();
      }
    });

    // === NEW: Tombol How to Play (kiri bawah) ===
    const howToPlayText = this.add.text(20, this.scale.height - 30, 'How to Play?', {
      fontSize: '20px',
      color: '#ffffff'
    }).setOrigin(0, 1).setInteractive();

    // === NEW: Register Username Button ===
    this.registerBtn = this.add.text(400, 440, "Register Username", {
      fontSize: "20px",
      fill: "#fff",
      backgroundColor: "#4f46e5",
      padding: { x: 12, y: 6 }
    })
      .setOrigin(0.5)
      .setInteractive()
      .on("pointerdown", () => {
        try { this.scene.get('Game')?.sfx?.uiClick?.play?.(); } catch {}
        window.open("https://monad-games-id-site.vercel.app/", "_blank");
      });

    // Tampilkan tombol hanya jika username belum ada
    this.registerBtn.setVisible(!hasUsername());

    // Update visibility kalau status auth berubah (setelah login atau setelah refresh data)
    window.addEventListener("monknight-auth", () => {
      this.registerBtn.setVisible(!hasUsername());
    });

    // Hover effects for register button
    this.registerBtn.on('pointerover', () => {
      this.input.setDefaultCursor('pointer');
      this.registerBtn.setStyle({ backgroundColor: '#5856eb' });
    });
    this.registerBtn.on('pointerout', () => {
      this.input.setDefaultCursor('default');
      this.registerBtn.setStyle({ backgroundColor: '#4f46e5' });
    });

    // Popup panel (hidden default)
    const panel = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 420, 280, 0x000000, 0.85)
      .setStrokeStyle(2, 0xffffff)
      .setVisible(false);
    const instructions = this.add.text(this.scale.width / 2, this.scale.height / 2, 
      `F = Attack / Basic Attack\n` +
      `D = Flame Rocket Skill\n` +
      `SPACE = Dodge\n` +
      `Hold SHIFT = Sprint\n\n` +
      `Dodge grants a short iframe.\n` +
      `When your character outline is white,\n` +
      `it means you are invulnerable.`, 
      { fontSize: '18px', color: '#ffffff', align: 'center' }
    ).setOrigin(0.5).setVisible(false);

    const closeText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 110, '[ Close ]', {
      fontSize: '18px',
      color: '#ff0000'
    }).setOrigin(0.5).setInteractive().setVisible(false);

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

    // === NEW: Mock Authentication UI ===
    this.createLoginUI();
  }

  // Create Login/Logout UI for development
  createLoginUI() {
    const centerX = this.cameras.main.centerX;
    const baseY = this.cameras.main.centerY + 200; // Below other buttons

    // Login/Logout Button
    this.loginText = this.add.text(centerX, baseY, 'Login with Monad Games ID', {
      fontFamily: 'Arial', 
      fontSize: '18px', 
      color: '#ffffff', 
      backgroundColor: '#4f46e5',
      padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    // Status Text
    this.statusText = this.add.text(centerX, baseY + 40, '', {
      fontFamily: 'Arial', 
      fontSize: '14px', 
      color: '#a5e1ff'
    }).setOrigin(0.5);

    // Dev Mode Indicator
    this.add.text(centerX, baseY + 70, '(Dev Mode - Mock Authentication)', {
      fontFamily: 'Arial', 
      fontSize: '12px', 
      color: '#888888'
    }).setOrigin(0.5);

    // Update UI based on current session
    this.updateLoginUI();

    // Handle login/logout clicks
    this.loginText.on('pointerup', async () => {
      const current = loadSession();
      if (current) {
        // Logout
        const result = mockLogout();
        if (result.success) {
          this.updateLoginUI();
        }
      } else {
        // Login
        try {
          // DEV: Use prompt for now, will be replaced with Privy flow
          const username = prompt('Enter username (dev login):', 'Monknight');
          if (username && username.trim()) {
            this.statusText.setText('Logging in...');
            const result = await mockLogin(username.trim());
            
            if (result.success) {
              this.updateLoginUI();
              
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
              
            } else {
              this.statusText.setText('Login failed: ' + result.error);
            }
          }
        } catch (e) {
          this.statusText.setText('Login error');
          console.error('Login error:', e);
        }
      }
    });

    // Hover effects
    this.loginText.on('pointerover', () => {
      this.loginText.setStyle({ backgroundColor: '#5856eb' });
    });
    this.loginText.on('pointerout', () => {
      this.loginText.setStyle({ backgroundColor: '#4f46e5' });
    });

    // Listen for session changes from other components
    window.addEventListener('mk-session-changed', () => {
      this.updateLoginUI();
    });
  }

  // Update login UI based on current session state
  updateLoginUI() {
    const session = loadSession();
    if (session) {
      this.loginText.setText('Logout');
      this.statusText.setText(`Logged in as ${session.username}`);
      this.statusText.setColor('#90EE90'); // Light green for logged in
    } else {
      this.loginText.setText('Login with Monad Games ID');
      this.statusText.setText('Not logged in');
      this.statusText.setColor('#a5e1ff'); // Light blue for not logged in
    }
  }
}

export default MainMenuScene;
