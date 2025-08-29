// LeaderboardScene.js
import { timeAttack } from './time_attack.js';

// Utility aman panggil modul TA
function TA_call(methodName, ...args) {
  try {
    const fn = timeAttack && timeAttack[methodName];
    if (typeof fn === 'function') return fn.apply(timeAttack, args);
  } catch {}
  return undefined;
}

// Fallback: cari leaderboard di localStorage (beberapa kemungkinan key)
function loadLocalFallback() {
  const keys = [
    'monknight_leaderboard',
    'timeattack_leaderboard',
    'ta_leaderboard',
    'MNK_LEADERBOARD'
  ];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }
  return [];
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  const pad = (n, w=2) => String(n).padStart(w, '0');
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

export default class LeaderboardScene extends Phaser.Scene {
  constructor() { super('Leaderboard'); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // Background overlay
    const bg = this.add.rectangle(W/2, H/2, W, H, 0x0a0f1f, 0.96).setScrollFactor(0);

    // Title
    this.add.text(W/2, 64, 'LEADERBOARD', {
      fontFamily: 'monospace', fontSize: 36, color: '#ffe066'
    }).setOrigin(0.5, 0.5);

    // Ambil data leaderboard:
    // Prefer API modul TA kalau ada, kalau tidak fallback ke localStorage
    let rows =
      TA_call('getLocalLeaderboard') ??
      TA_call('getLeaderboard') ??
      TA_call('listLocal') ??
      loadLocalFallback();

    // Normalisasi: [{name, ms, date}]
    rows = (rows || [])
      .map((r, i) => {
        if (typeof r === 'number') return { name: `Player ${i+1}`, ms: r, date: Date.now() };
        return {
          name: r.name || r.player || r.user || 'Player',
          ms: typeof r.ms === 'number' ? r.ms : (r.timeMs || r.time || 0),
          date: r.date || r.ts || Date.now()
        };
      })
      .filter(r => typeof r.ms === 'number' && r.ms >= 0)
      .sort((a,b) => a.ms - b.ms)
      .slice(0, 20);

    if (rows.length === 0) {
      this.add.text(W/2, H/2, 'No records yet.\nBeat the boss to set your first time!', {
        fontFamily: 'monospace', fontSize: 18, color: '#cfd8dc', align: 'center'
      }).setOrigin(0.5);
    } else {
      // Header
      const startY = 120;
      this.add.text(W*0.2, startY, '#', { fontFamily:'monospace', fontSize:18, color:'#8fd3ff' }).setOrigin(0,0.5);
      this.add.text(W*0.3, startY, 'Name', { fontFamily:'monospace', fontSize:18, color:'#8fd3ff' }).setOrigin(0,0.5);
      this.add.text(W*0.7, startY, 'Time', { fontFamily:'monospace', fontSize:18, color:'#8fd3ff' }).setOrigin(1,0.5);

      // List
      const lineH = 28;
      rows.forEach((r, idx) => {
        const y = startY + 16 + (idx+1) * lineH;
        this.add.text(W*0.2, y, String(idx+1).padStart(2,'0'), { fontFamily:'monospace', fontSize:18, color:'#ffffff' }).setOrigin(0,0.5);
        this.add.text(W*0.3, y, r.name.slice(0,18),            { fontFamily:'monospace', fontSize:18, color:'#ffffff' }).setOrigin(0,0.5);
        this.add.text(W*0.7, y, formatTime(r.ms),              { fontFamily:'monospace', fontSize:18, color:'#ffe066' }).setOrigin(1,0.5);
      });
    }

    // Back button
    const btn = this.add.rectangle(W/2, H - 80, 200, 44, 0x123456, 0.8).setStrokeStyle(2, 0xffffff, 0.9).setInteractive({ useHandCursor: true });
    this.add.text(W/2, H - 80, 'BACK', { fontFamily:'monospace', fontSize:20, color:'#ffffff' }).setOrigin(0.5,0.5);
    btn.on('pointerover', () => btn.setFillStyle(0x1b2a6b, 0.9));
    btn.on('pointerout',  () => btn.setFillStyle(0x123456, 0.8));
    btn.on('pointerup',   () => this.scene.start('MainMenu'));
  }
}
