// ======================= preloadscene.js =======================
// BootScene + PreloadScene dengan background loading custom
// - BootScene hanya preload UI ringan (gambar loading)
// - PreloadScene menampilkan gambar loading + progress bar
// - Setelah selesai, otomatis pindah ke TARGET_SCENE

class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }
  preload() {
    // Gambar loading (statis) — ganti path jika perlu
    this.load.image('loading_bg', 'assets/ui/strayknight_loading.png');
  }
  create() {
    this.scene.start('PreloadScene');
  }
}

class PreloadScene extends Phaser.Scene {
  TARGET_SCENE = 'TownScene'; // ganti ke scene awalmu (mis. 'MainMenu')

  constructor() { super({ key: 'PreloadScene' }); }

  init() {
    this.ui = {
      barWidth: Math.floor(this.scale.width * 0.5),
      barHeight: 16,
      radius: 8,
    };
    this.colors = {
      barBg: 0x2a2f3a,
      barFill: 0xffa62b,
      text: '#efe7d5',
      subText: '#c7bca6',
    };
  }

  preload() {
    // === 1) Tampilkan background loading agar cover layar ===
    const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'loading_bg')
      .setOrigin(0.5);

    // scale supaya "cover" (tanpa letterboxing)
    const s = Math.max(this.scale.width / bg.width, this.scale.height / bg.height);
    bg.setScale(s);

    // === 2) Progress bar & teks ===
    const barW = this.ui.barWidth;
    const barH = this.ui.barHeight;
    const barX = (this.scale.width - barW) / 2;
    const barY = this.scale.height * 0.86;

    // bayangan tipis supaya kontras di atas gambar
    this.add.rectangle(barX + barW / 2, barY + barH / 2 + 2, barW + 6, barH + 6, 0x000000, 0.35)
      .setOrigin(0.5);

    const barBg = this.add.graphics()
      .fillStyle(this.colors.barBg, 0.9)
      .fillRoundedRect(barX, barY, barW, barH, this.ui.radius);

    const barFill = this.add.graphics();

    const percentText = this.add.text(this.scale.width / 2, barY - 26, 'LOADING 0%', {
      fontFamily: 'monospace', fontSize: 18, color: this.colors.text
    }).setOrigin(0.5);

    const fileText = this.add.text(this.scale.width / 2, barY + barH + 10, 'Menyiapkan…', {
      fontFamily: 'monospace', fontSize: 13, color: this.colors.subText
    }).setOrigin(0.5);

    // animasi kecil pada teks biar hidup
    this.tweens.add({ targets: percentText, y: percentText.y - 2, duration: 650, yoyo: true, repeat: -1 });

    // === 3) Event progress ===
    this.load.on('progress', (v) => {
      const w = Math.floor(barW * v);
      barFill.clear()
        .fillStyle(this.colors.barFill, 1)
        .fillRoundedRect(barX, barY, w, barH, this.ui.radius);
      percentText.setText(`LOADING ${Math.round(v * 100)}%`);
    });

    this.load.on('fileprogress', (file) => {
      fileText.setText(`Memuat: ${truncate(file.key || file.src, 46)}`);
    });

    this.load.on('complete', () => {
      fileText.setText('Selesai! Memulai…');
      this.time.delayedCall(220, () => this.scene.start(this.TARGET_SCENE));
    });

    // === 4) DAFTAR ASET GAME-MU (berat) ===
    // Map JSON
    this.load.tilemapTiledJSON('town', 'assets/map.json');
    this.load.tilemapTiledJSON('battle', 'assets/map_battle.json');

    // Auto-load tileset images berdasarkan tilesets[].image di JSON
    const autoloadTilesets = (key) => {
      const data = this.cache.tilemap.get(key);
      if (!data?.data?.tilesets) return;
      for (const ts of data.data.tilesets) {
        if (ts.image) {
          const texKey = ts.name || ts.image;
          if (!this.textures.exists(texKey)) {
            this.load.image(texKey, 'assets/' + ts.image);
          }
        }
      }
    };
    this.load.once('filecomplete-tilemapJSON-town',   () => autoloadTilesets('town'));
    this.load.once('filecomplete-tilemapJSON-battle', () => autoloadTilesets('battle'));

    // Spritesheets (samakan frame size dgn asetmu)
    this.load.spritesheet('hero',     'assets/hero.png',     { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('skeleton', 'assets/skeleton.png', { frameWidth: 32, frameHeight: 32 });

    // Background Music
    try {
      this.load.audio('mainMenuTownMusic', 'assets/sfx/Main Menu-Town.mp3');
      this.load.audio('bossmapMusic', 'assets/sfx/bossmap.mp3');
    } catch (error) {
      console.warn('⚠️ Could not load background music in PreloadScene:', error);
    }

    // (opsional) audio/ui
    // this.load.audio('sfx_click', ['assets/audio/click.ogg', 'assets/audio/click.mp3']);
  }

  create() { /* transisi diatur di 'complete' */ }
}

// ----------------- helpers -----------------
function truncate(str, n) {
  if (!str) return '';
  return (str.length > n) ? str.slice(0, n - 1) + '…' : str;
}
