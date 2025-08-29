// ============ MAIN MENU SCENE ============
import { timeAttack } from './time_attack.js';

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
  }
}

export default MainMenuScene;
