// time_attack.js
// Modul Time Attack untuk MONKNIGHT — aman lintas scene

export class TimeAttack {
  constructor() {
    this.active = false;
    this.startAt = 0;
    this.elapsedMs = 0;
    this.text = null;    // Phaser.Text dari scene saat ini
    this.bestMs = null;
    this.showText = false;
    this._scene = null;  // scene pemilik text saat ini
  }

  static formatMs(ms) {
    const total = Math.max(0, Math.floor(ms));
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const cs = Math.floor((total % 1000) / 10);
    const pad = (n, w=2) => String(n).padStart(w, '0');
    return `${pad(m)}:${pad(s)}.${pad(cs)}`;
  }

  loadBestLocal() {
    try {
      const v = localStorage.getItem('monknight_best_time_ms');
      if (v) this.bestMs = Number(v);
    } catch {}
  }

  getBestLocal() {
    return this.bestMs;
  }

  // Pastikan text terikat ke scene yang aktif
  _ensureText(scene) {
    // kalau diminta tidak menampilkan, pastikan tidak ada text
    if (this.showText === false) {
      if (this.text) { try { this.text.destroy(); } catch {} }
      this.text = null;
      this._scene = scene;
      return;
    }
    const sameScene = this.text && this._scene === scene && !this.text.destroyed && this.text.scene === scene;
    if (sameScene) return;

    // destroy text lama (punya scene lain)
    if (this.text && (!this.text.scene || this.text.scene !== scene || this.text.destroyed)) {
      try { this.text.destroy(); } catch {}
      this.text = null;
    }

    this._scene = scene;
    this.text = scene.add.text(scene.cameras.main.centerX, 10, '00:00.00', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(9999);
  }

  // Panggil saat masuk battle
  start(scene, opts = {}) {
    this.showText = opts.showText !== false; // default true
    this.active = true;
    this.startAt = scene.time.now;
    this.elapsedMs = 0;

    this._ensureText(scene);
    if (opts && opts.showText === false && this.text) {
      this.text.setVisible(false);
    }
    if (this.text && this.showText) this.text.setVisible(true).setText('00:00.00');

    // Bila scene dihancurkan (restart/keluar), jangan sisakan referensi busuk
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy(scene));
    scene.events.once(Phaser.Scenes.Events.DESTROY,  () => this.destroy(scene));
  }

  // Panggil setiap frame
  update(scene) {
    if (!this.active) return;
    this.elapsedMs = scene.time.now - this.startAt;
    if (this.showText && this.text && this.text.scene === scene) {
      this.text.setText(TimeAttack.formatMs(this.elapsedMs));
    }
  }

  // Akses nilai (buat UI eksternal)
  elapsed() {
    return this.elapsedMs;
  }

  // Panggil saat selesai/cancel
  stop(scene, reason = 'finish') {
    if (!this.active) return this.elapsedMs;
    this.active = false;

    const finalMs = this.elapsedMs;

    try {
      if (this.text && this.text.scene === scene) {
        this.text.setText(TimeAttack.formatMs(finalMs));
      }
    } catch {}

    if (this.bestMs == null || finalMs < this.bestMs) {
      this.bestMs = finalMs;
      try { localStorage.setItem('monknight_best_time_ms', String(finalMs)); } catch {}
    }

    // submit opsional — biar dipanggil eksplisit dari luar
    return finalMs;
  }

  // Submit manual (dipanggil dari game.js)
  async submitToLeaderboard(timeMs, meta = {}) {
    if (window.leaderboard && typeof window.leaderboard.submit === 'function') {
      try {
        await window.leaderboard.submit({
          mode: 'time_attack',
          score: Number(timeMs), // atau -Number(timeMs) tergantung sistem
          extra: meta
        });
      } catch (e) {
        console.warn('Submit leaderboard gagal:', e);
      }
      return;
    }
    // Contoh fetch kustom (nonaktif):
    // await fetch('/api/leaderboard/submit', { ... })
  }

  // Hapus text saat scene ditutup / pindah map
  destroy(scene) {
    if (this.text && this.text.scene === scene) {
      try { this.text.destroy(); } catch {}
      this.text = null;
    }
    if (this._scene === scene) this._scene = null;
  }
}

// Singleton siap pakai
export const timeAttack = new TimeAttack();
