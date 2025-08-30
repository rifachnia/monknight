// ===============================
// MONKNIGHT — Main Menu + Game (+ Time Attack integration)
// ===============================
import MainMenuScene from './MainMenuScene.js';
import LeaderboardScene from './LeaderboardScene.js';
import { timeAttack } from './time_attack.js';
import { submitScore, getPlayerAddress, validateSubmissionData } from './contract.js';
import { loadSession, getCurrentUser } from './session.js';

const GAME_TITLE = 'MONKNIGHT';

// game.js (bagian paling atas)
let PLAYER_ADDRESS = "";
let PLAYER_USERNAME = "";

// Terima event dari AuthIsland (Privy)
window.addEventListener("monknight-auth", (e) => {
  PLAYER_ADDRESS = e.detail.address || "";
  PLAYER_USERNAME = e.detail.username || "";
  console.log("[Auth] address:", PLAYER_ADDRESS, "username:", PLAYER_USERNAME);
});

// Helper kalau kamu butuh di scene lain
export function getPlayerIdentity() {
  return { address: PLAYER_ADDRESS, username: PLAYER_USERNAME };
}

// Helper untuk cek apakah username sudah ada
export function hasUsername() {
  return !!(PLAYER_USERNAME && PLAYER_USERNAME.trim());
}

// ======= LEGACY SUPPORT =======
// Backward compatibility for old system
let PLAYER_IDENTITY = { address: null, username: null };

// Update legacy object when new auth comes in
window.addEventListener('monknight-auth', (event) => {
  const { address, username } = event.detail;
  PLAYER_IDENTITY.address = address;
  PLAYER_IDENTITY.username = username || null;
});

// Legacy support for old gameAuth system
window.setPlayerIdentity = function ({ address, username }) {
  PLAYER_ADDRESS = address || "";
  PLAYER_USERNAME = username || "";
  PLAYER_IDENTITY.address = address;
  PLAYER_IDENTITY.username = username || null;
  console.log("[Identity] address:", address, "username:", username);
};

// Enhanced boss defeat logic with server-side score submission
function onBossDefeated(finalScore, gameDuration = 0) {
  // Try to get player from session first, fallback to legacy system
  const currentUser = getCurrentUser();
  const playerAddress = currentUser?.walletAddress || getPlayerAddress();
  const playerUsername = currentUser?.username || PLAYER_USERNAME;
  
  if (!playerAddress) {
    console.warn("Player belum login - Please login first to submit scores");
    // Show in-game prompt for login
    return;
  }
  
  console.log("Boss defeated! Player:", playerUsername, "Score:", finalScore, "Duration:", gameDuration);
  
  // Validate submission data before sending
  const validation = validateSubmissionData(finalScore, gameDuration);
  if (!validation.valid) {
    console.error("Invalid submission data:", validation.errors);
    return;
  }
  
  // Submit score increment via secure server API
  if (finalScore > 0) {
    submitScore(
      playerAddress,
      finalScore,      // Score increment (not total)
      gameDuration,    // Game duration for validation
      1,              // Transaction count increment
      {
        bossDefeated: true,
        playerUsername: playerUsername,
        mapKey: currentMapKey,
        sessionId: currentUser?.userId
      }
    ).then(result => {
      if (result && result.success) {
        console.log("✅ Score successfully submitted to blockchain!");
        console.log("📜 Transaction hash:", result.transactionHash);
        // Could show success notification in game UI
      } else {
        console.log("❌ Failed to submit score to blockchain");
      }
    }).catch(err => {
      console.error("Error submitting score:", err);
    });
  }
}

// ============ GLOBAL ============
let player, cursors, shiftKey;
let portals = [];
let mapLayers = {};
let isTransitioning = false;

// Portal guard
let portalsEnabled = false;
let portalCooldownUntil = 0;
const PORTAL_COOLDOWN_MS = 800;
const SPAWN_GRACE_MS = 300;
const DEFAULT_SPAWN_NUDGE = 16;

// ===== NEW: death / respawn state =====
let isDead = false;
let currentMapKey = 'town';

// Battle-only
let mobs = null;              // group berisi 1 boss
let fireballs = null;         // group fireball
let nextBossShootAt = 0;      // cooldown tembak boss

// ======= ATTACK (Single-key F + 3-hit combo) =======
let attackKeyF = null;
let isAttacking = false;
let attackCD = false;
let playerLastDir = 'down';
const COMBO_CHAIN = ['pierce','crush','slice'];
let comboIndex = 0;

// Tuning cepat + auto-reset combo
const ATTACK_COOLDOWN_MS = 130;
const ATTACK_UNLOCK_MS   = 130;
const HITBOX_LIFETIME_MS = 110;
const COMBO_RESET_MS     = 600;
let  lastAttackAt        = 0;

// Lama anim attack
const DESIRED_ANIM_MS = {
  pierce: Math.max(ATTACK_UNLOCK_MS + 40, 110),
  crush:  Math.max(ATTACK_UNLOCK_MS + 60, 130),
  slice:  Math.max(ATTACK_UNLOCK_MS + 50, 120)
};

// ======= DODGE / SLIDE =======
let dodgeKeySpace = null;
let isDodging = false;
let dodgeOnCD = false;
let isInvulnerable = false;

const DODGE_DURATION_MS = 180;
const DODGE_COOLDOWN_MS = 500;
const DODGE_SPEED = 340;
const DODGE_FRICTION_MS = 60;

// ======= FX: Dodge Outline =======
let dodgeOutline = [];
let dodgeOutlinePulse = null;

// ======= SKILL: Rocket Fire (key D) =======
let skillKeyD = null;
let rockets = null;
let nextRocketAt = 0;
const ROCKET_CD_MS        = 1000;   // cooldown 1s
const ROCKET_SPEED        = 640;    // cepat
const ROCKET_MAX_TRAVEL   = 900;    // jarak tempuh maksimal (px)
const ROCKET_DMG          = 8;

// ======= HP & DAMAGE =======
const PLAYER_MAX_HP = 100;
let   playerHP      = PLAYER_MAX_HP;

const BOSS_MAX_HP   = 285;
let   bossHP        = BOSS_MAX_HP;

const DMG_MULTIPLIER = { pierce: 1.0, crush: 1.25, slice: 1.5 };
const CONTACT_DMG = 5;
const CONTACT_TICK_MS = 400;
let   nextContactTickAt = 0;

const CONTACT_RADIUS = 14;
const FB_FALLBACK_KEY = 'fb_fallback';

// ======= BOSS UI (SIMPLE BAR) =======
let bossBar = null;

// ======= FIREBALL CONFIG =======
const FIREBALL_SPEED   = 170;
const FIREBALL_CD_MS   = 1400;
const FIREBALL_HIT     = 10;
const EXPLOSION_HIT    = 16;
const EXPLOSION_RADIUS = 56;
const FIREBALL_ARM_MS  = 80;
const FIREBALL_SPAWN_OFFSET = 36;
const BOSS_SHOOT_RANGE = 1200;
const FIREBALL_EXTRA_BUFFER_MS = 300;


// ==== SCORE (time-attack) ====
const SCORE_K = 15_000_000; // 15s -> 1000 poin

function calcPointsFromTime(ms) {
  if (!taActive || ms <= 0) return 0;     // <- penting: sebelum start = 0
  const SCORE_K = 15_000_000;             // 15s => 1000 pts
  return Math.floor(SCORE_K / Math.max(1, ms));
}

// Buat UI score tepat di bawah boss bar
function initScoreUI(scene) {
  const cam = scene.cameras.main;
  const cx  = cam.centerX;

  // Cari posisi bawah boss bar; fallback ke y=36 kalau ga ada
  let y = 36;
  try {
    if (scene.bossBarFrame && scene.bossBarFrame.getBounds) {
      y = Math.round(scene.bossBarFrame.getBounds().bottom + 6);
    } else if (scene.bossBarContainer && scene.bossBarContainer.getBounds) {
      y = Math.round(scene.bossBarContainer.getBounds().bottom + 6);
    }
  } catch (_) {}

  if (scene.taScoreText) scene.taScoreText.destroy();
  scene.taScoreText = scene.add.text(cx, y, '0', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#fff',
    stroke: '#000',
    strokeThickness: 4,
  })
  .setOrigin(0.5, 0.5)
  .setScrollFactor(0)
  .setDepth(1001);

  // Kalau sebelumnya kamu punya teks waktu di tengah, sembunyikan
  if (scene.timeTextMid) scene.timeTextMid.setVisible(false);
}

// Update angka & jaga posisinya di bawah boss bar
function updateScoreUI(scene, elapsedMs) {
  if (!scene.taScoreText) return;

  const pts = calcPointsFromTime(elapsedMs);
  scene.taScoreText.setText(String(pts));

  // jaga tetap di bawah boss bar kalau UI boss bar auto-fit
  try {
    const cx = scene.cameras.main.centerX;
    let y = scene.taScoreText.y;
    if (scene.bossBarFrame?.getBounds) y = Math.round(scene.bossBarFrame.getBounds().bottom + 6);
    else if (scene.bossBarContainer?.getBounds) y = Math.round(scene.bossBarContainer.getBounds().bottom + 6);
    scene.taScoreText.setPosition(cx, y);
  } catch (_) {}
}


// Phase-based boss damage multiplier
function getBossPhaseMultiplier(hp) {
  if (typeof hp !== 'number' || hp <= 0) return 1;
  const ratio = hp / BOSS_MAX_HP;
  return ratio <= 0.25 ? 2 : 1;
}


// UI player
let uiGfx, uiTextPlayer, playerUsernameText;

// Summon control
let minionsSummoned = false;

// ======= TIME ATTACK (Integration Layer) =======
let taActive = false;
let taStartMs = 0;            // fallback internal timer start
let uiTextTimer = null;

// Helper panggil metode timeAttack dgn konteks yang benar
function TA_call(methodName, ...args) {
  try {
    const fn = timeAttack && timeAttack[methodName];
    if (typeof fn === 'function') {
      return fn.apply(timeAttack, args);
    }
  } catch (e) {
    console.warn('[TimeAttack]', methodName, 'error:', e);
  }
  return undefined;
}
function TA_getElapsed() {
  try {
    return typeof timeAttack.elapsed === 'function' ? timeAttack.elapsed() : undefined;
  } catch {}
  return undefined;
}

function taStart(scene) {
  taActive = true;
  taStartMs = scene.time.now;
  TA_call('loadBestLocal');
  TA_call('start', scene, { showText: false }); // wajib kirim scene
}
function taStop(scene, { submit = false } = {}) {
  if (!taActive) return null;
  taActive = false;

  let elapsedMs = TA_call('stop', scene);
  if (typeof elapsedMs !== 'number') elapsedMs = scene.time.now - taStartMs;

  if (submit) {
    TA_call('submitToLeaderboard', elapsedMs, { reason: 'finish' });
  }
  return elapsedMs;
}

// ---------- Phaser Game Config ----------
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#000',
  scale: {
    parent: 'game-container',
    mode: Phaser.Scale.FIT,                 // jaga aspek rasio
    autoCenter: Phaser.Scale.CENTER_BOTH,  // center di layar
    width: 800,                             // base resolution (jangan window size)
    height: 600
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [MainMenuScene, LeaderboardScene, { key: 'Game', preload, create, update }]
};

const game = new Phaser.Game(config);

// Optional: refresh saat resize (biasanya FIT sudah cukup)
window.addEventListener('resize', () => game.scale.refresh());

// ============ PRELOAD ============
function preload() {
  // Map JSON
  this.load.tilemapTiledJSON('town',   'assets/map.json');
  this.load.tilemapTiledJSON('battle', 'assets/map_battle.json');

  // Tileset (samakan dgn projekmu)
  this.load.image('tileset', 'assets/tileset.png');
  this.load.image('Size_02', 'assets/Size_02.png');
  this.load.image('Size_03', 'assets/Size_03.png');
  this.load.image('Size_04', 'assets/Size_04.png');
  this.load.image('Size_05', 'assets/Size_05.png');
  this.load.image('Roofs', 'assets/Roofs.png');
  this.load.image('Shadows', 'assets/Shadows.png');
  this.load.image('Walls', 'assets/Walls.png');
  this.load.image('Floors', 'assets/Floors.png');
  this.load.image('Props', 'assets/Props.png');
  this.load.image('Dungeon_Tiles', 'assets/Dungeon_Tiles.png');
  this.load.image('Wall_Tiles', 'assets/Wall_Tiles.png');
  this.load.image('Wall_Variations', 'assets/Wall_Variations.png');
  this.load.image('Water_tiles', 'assets/Water_tiles.png');
  this.load.image('Dungeon_Props', 'assets/Dungeon_Props.png');

  // PLAYER movement sprites (64x64)
  this.load.spritesheet('idle_down', 'assets/Idle_Down-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('idle_side', 'assets/Idle_Side-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('idle_up',   'assets/Idle_Up-Sheet.png',   { frameWidth: 64, frameHeight: 64 });

  this.load.spritesheet('walk_down', 'assets/Walk_Down-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('walk_side', 'assets/Walk_Side-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('walk_up',   'assets/Walk_Up-Sheet.png',   { frameWidth: 64, frameHeight: 64 });

  this.load.spritesheet('run_down',  'assets/Run_Down-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('run_side',  'assets/Run_Side-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('run_up',    'assets/Run_Up-Sheet.png',    { frameWidth: 64, frameHeight: 64 });

  // ATTACK (Pierce/Slice/Crush)
  this.load.spritesheet('atk_down',   'assets/Pierce_Down-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('atk_side',   'assets/Pierce_Side-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('atk_up',     'assets/Pierce_Top-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('slice_down', 'assets/Slice_Down-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('slice_side', 'assets/Slice_Side-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('slice_up',   'assets/Slice_Up-Sheet.png',    { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('crush_down', 'assets/Crush_Down-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('crush_side', 'assets/Crush_Side-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('crush_up',   'assets/Crush_Up-Sheet.png',    { frameWidth: 64, frameHeight: 64 });

  // Skill projectile (atlas)
  try { this.load.atlas('rocket_fire', 'assets/rocket_fire.png', 'assets/rocket_fire.json'); } catch {}

  // (portal FX removed)

  // MOB & FIREBALL
  this.load.spritesheet('mob_idle',  'assets/SkelmageIdle-Sheet.png',  { frameWidth: 32, frameHeight: 32 });
  this.load.spritesheet('mob_run',   'assets/Skelmage-Run-Sheet.png',  { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('mob_death', 'assets/Skelmage-death-Sheet.png',{ frameWidth: 64, frameHeight: 64 });

  // Minion skeleton (separate assets)
  this.load.spritesheet('minion_idle',  'assets/skelminion-Idle-Sheet.png',  { frameWidth: 32, frameHeight: 32 });
  this.load.spritesheet('minion_run',   'assets/skelminionRun-Sheet.png',    { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('minion_death', 'assets/skelminionDeath-Sheet.png',  { frameWidth: 64, frameHeight: 48 });

  // Spritesheet fireball 64x64
  this.load.spritesheet('fireball', 'assets/fireball.png', { frameWidth: 64, frameHeight: 64 });

  // Player death sprites (64x64)
  this.load.spritesheet('death_down', 'assets/Death_Down-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('death_side', 'assets/Death_Side-Sheet.png', { frameWidth: 64, frameHeight: 64 });
  this.load.spritesheet('death_up',   'assets/Death_Up-Sheet.png',   { frameWidth: 64, frameHeight: 64 });

  // --- Audio SFX ---
  try {
    this.load.audio('heroDead',   'assets/sfx/HeroDead.mp3');
    this.load.audio('hitSound',   'assets/sfx/Hitsound.ogg');
    this.load.audio('rocketSkill','assets/sfx/rocketskill.wav');
    this.load.audio('basicAttack','assets/sfx/basicattack.wav');
    this.load.audio('success',    'assets/sfx/Success.wav');
    this.load.audio('uiClick',    'assets/sfx/UI-Click.wav');
  } catch {}
}

// ============ CREATE ============
function create(data) {
  // Pastikan seluruh tileset untuk town/battle tersedia
  const needKeys = ['town', 'battle'];
  for (const key of needKeys) {
    const m = this.cache.tilemap.get(key);
    if (m?.tilesets) {
      for (const ts of m.tilesets) {
        if (ts.image && !this.textures.exists(ts.name)) {
          this.load.image(ts.name, 'assets/' + ts.image);
        }
      }
    }
  }
  if (this.load.list.size > 0) {
    this.load.once('complete', () => this.scene.restart(data));
    this.load.start();
    return;
  }

  const mapKey = data?.mapKey || 'town';
  const spawn  = data?.spawn  || { x: 160, y: 224 };
  currentMapKey = mapKey;
  this.dodgeEnabled = (mapKey === 'battle');

  const map = buildMap.call(this, mapKey);

  // Player
  const playerTexture = this.textures.exists('idle_down') ? 'idle_down'
                       : this.textures.exists('walk_down') ? 'walk_down'
                       : null;
  if (playerTexture) {
    player = this.physics.add.sprite(spawn.x, spawn.y, playerTexture, 0);
  } else {
    const tmp = this.add.rectangle(spawn.x, spawn.y, 28, 28, 0x66ccff);
    this.physics.add.existing(tmp);
    player = tmp;
  }
  player.body.setCollideWorldBounds(true);

  // Reset state
  isDead = false; isInvulnerable = false;

  // Input & camera
  cursors   = this.input.keyboard.createCursorKeys();
  shiftKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
  attackKeyF= this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
  skillKeyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  dodgeKeySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  this.cameras.main.startFollow(player, true);

  // --- SFX objects ---
  this.sfx = {
    heroDead:    this.sound.add('heroDead'),
    hitSound:    this.sound.add('hitSound'),
    rocketSkill: this.sound.add('rocketSkill'),
    basicAttack: this.sound.add('basicAttack'),
    success:     this.sound.add('success'),
    uiClick:     this.sound.add('uiClick')
  };

  // Collider dinding
  const wallsLayer = mapLayers['Walls'] || mapLayers['object wall'] || null;
  if (wallsLayer) {
    wallsLayer.setCollisionByExclusion([-1]);
    this.physics.add.collider(player, wallsLayer);
  }

  // Portal
  isTransitioning = false;
  portalsEnabled = false;
  this.time.delayedCall(SPAWN_GRACE_MS, () => { portalsEnabled = true; });
  setupPortals.call(this, map);

  // Anim player & fireball
  setupPlayerAnims.call(this);
  // (no portal FX anim)

  // Fallback texture untuk fireball
  ensureFireballFallback(this);

  // Battle-only init
  mobs = null; fireballs = null; rockets = null; destroyBossBar();

  const hasMobTextures = this.textures.exists('mob_idle') && this.textures.exists('mob_run') && this.textures.exists('mob_death');

  // Always create projectile groups for consistent behavior across maps
  if (!rockets) rockets = this.physics.add.group();

  if (mapKey === 'battle' && hasMobTextures) {
    // === TIME ATTACK: MULAI ===
    taStart(this);
    createBossBar.call(this);
    initScoreUI(this);

    if (!this.anims.exists('mob_idle')) {
      this.anims.create({ key: 'mob_idle',  frames: this.anims.generateFrameNumbers('mob_idle',  { start: 0, end: 3 }), frameRate: 6,  repeat: -1 });
      this.anims.create({ key: 'mob_run',   frames: this.anims.generateFrameNumbers('mob_run',   { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: 'mob_death', frames: this.anims.generateFrameNumbers('mob_death', { start: 0, end: 5 }), frameRate: 8,  repeat: 0  });
    }

    // Ensure reversed death animation exists regardless
    if (!this.anims.exists('mob_death_rev')) {
      const frames = this.anims.generateFrameNumbers('mob_death', { start: 0, end: 5 });
      const reversed = frames.slice().reverse();
      this.anims.create({ key: 'mob_death_rev', frames: reversed, frameRate: 10, repeat: 0 });
    }

    if (!this.anims.exists('minion_idle')) {
      this.anims.create({ key: 'minion_idle',  frames: this.anims.generateFrameNumbers('minion_idle',  { start: 0, end: 3 }), frameRate: 6,  repeat: -1 });
      this.anims.create({ key: 'minion_run',   frames: this.anims.generateFrameNumbers('minion_run',   { start: 0, end: 5 }), frameRate: 10, repeat: -1 });
      this.anims.create({ key: 'minion_death', frames: this.anims.generateFrameNumbers('minion_death', { start: 0, end: 5 }), frameRate: 8,  repeat: 0  });
    }

    mobs = this.physics.add.group();
    fireballs = this.physics.add.group();
    if (!rockets) rockets = this.physics.add.group();
    minionsSummoned = false;

    const boss = this.physics.add.sprite(400, 260, 'mob_idle', 0).play('mob_idle');
    boss.setCollideWorldBounds(true);
    boss.setScale(2);
    boss.setOrigin(0.5, 0.8);

    const TORSO_W = 18, TORSO_H = 22;
    boss.body.setSize(TORSO_W, TORSO_H);
    boss.body.setOffset((boss.body.sourceWidth  - TORSO_W)/2, (boss.body.sourceHeight - TORSO_H)/2);

    boss.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_anim, frame) => {
      const sw = frame.frame.width, sh = frame.frame.height;
      boss.body.setSize(TORSO_W, TORSO_H, false);
      boss.body.setOffset((sw - TORSO_W)/2, (sh - TORSO_H)/2);
    });

    boss.hp = BOSS_MAX_HP;
    boss.isBoss = true;
    boss.animPrefix = 'mob';
    // remember spawn position for phase teleport
    boss.spawnX = boss.x; boss.spawnY = boss.y;
    mobs.add(boss);

    if (wallsLayer) {
      this.physics.add.collider(
        fireballs, wallsLayer,
        (fb) => { if (!fb?.active) return; if (fb.explodes && this.anims.exists('fireball_explode')) spawnExplosion(this, fb.x, fb.y); fb.destroy(); },
        (fb) => { return this.time.now >= (fb?._armedAt || 0); },
        this
      );
      this.physics.add.collider(mobs, wallsLayer);
      this.physics.add.collider(rockets, wallsLayer, (r) => { if (!r?.active) return; r.destroy(); });
    }

    this.physics.add.overlap(player, mobs, (pl, mob) => {
      const dx = pl.x - mob.x, dy = pl.y - mob.y;
      const dist = Math.hypot(dx, dy) || 1;
      const radius = CONTACT_RADIUS * mob.scaleX;

      if (dist <= radius) {
        pl.body.velocity.x += (dx / dist) * 30;
        pl.body.velocity.y += (dy / dist) * 30;

        if (!isInvulnerable && CONTACT_DMG > 0 && this.time.now >= nextContactTickAt) {
          damagePlayer(CONTACT_DMG);
          nextContactTickAt = this.time.now + CONTACT_TICK_MS;
        }
      }
    });

    this.physics.add.overlap(player, fireballs, (pl, fb) => {
      if (!fb.active) return;
      const fbDmg = fb.getData?.('dmg');
      const dmg = typeof fbDmg === 'number' ? fbDmg : FIREBALL_HIT;
      if (!isInvulnerable) damagePlayer(dmg);
      if (fb.explodes && this.anims.exists('fireball_explode')) spawnExplosion(this, fb.x, fb.y);
      fb.destroy();
    });

    this.physics.add.overlap(rockets, mobs, (r, mob) => {
      if (!r.active || !mob.active || mob.hp <= 0) return;
      if (mob.inPhaseTransition) return;
      const mult = getBossPhaseMultiplier(bossHP);
      const dmg = Math.ceil((r.getData?.('dmg') ?? ROCKET_DMG) * mult);
      mob.hp -= dmg;
      bossHP = Phaser.Math.Clamp(mob.hp, 0, BOSS_MAX_HP);
      // small knockback
      const dx = mob.x - r.x, dy = mob.y - r.y, d = Math.hypot(dx, dy) || 1;
      if (!mob.inPhaseTransition) {
        mob.body.velocity.x += (dx / d) * 80;
        mob.body.velocity.y += (dy / d) * 80;
      }
      r.destroy();
      if (mob.hp <= 0) {
        mob.setVelocity(0,0);

        if (mob.isBoss) {
          const elapsed = stopAndGetElapsed(this);
          onBossDefeated(calcPointsFromTime(elapsed), elapsed); // Pass duration for validation
          TA_call('submitToLeaderboard', elapsed, { reason: 'kill_boss' });
          showWinOverlay(this, elapsed);
        }

        const deathKey = `${mob.animPrefix || (mob.isBoss ? 'mob' : 'minion')}_death`;
        if (this.anims.exists(deathKey) && this.anims.get(deathKey).frames.length > 0) {
          mob.play(deathKey);
          mob.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => mob.destroy());
        } else {
          mob.destroy();
        }
      }
    });

    nextBossShootAt = this.time.now + 800;
  } else {
    // Bukan battle map → pastikan timer diberhentikan & text dibersihkan
    taStop(this, { submit: false });
    TA_call('destroy', this);
  }

  // UI player (kiri atas)
  initUI.call(this);
  refreshUI();
  
  // Initialize username text that follows the player
  initPlayerUsernameText.call(this);
  
  // Listen for authentication changes to update username
  const handleAuthChange = () => {
    initPlayerUsernameText.call(this);
  };
  window.addEventListener('monknight-auth', handleAuthChange);
  
  // Store cleanup handler
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('monknight-auth', handleAuthChange);
  });

  // === TIME ATTACK UI (kanan atas) — kecil, tambahan ===
  initTimeAttackUI.call(this);

  // ESC → balik ke MainMenu (pastikan timer stop)
  this.input.keyboard.on('keydown-ESC', () => {
    taStop(this, { submit: false });
    TA_call('destroy', this);
    try { this.sfx?.uiClick?.play?.(); } catch {}
    this.scene.start('MainMenu');
  });

  // Cleanup saat scene ditutup
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    // Matikan efek dodge outline
    if (dodgeOutlinePulse) { try { dodgeOutlinePulse.stop(); } catch {} dodgeOutlinePulse = null; }
    dodgeOutline.forEach(s => { try { s.destroy(); } catch {} });
    dodgeOutline = [];

    // Bersihkan semua UI global
    try { uiTextTimer?.destroy(); } catch {}
    try { uiGfx?.destroy(); } catch {}
    try { uiTextPlayer?.destroy(); } catch {}
    try { playerUsernameText?.destroy(); } catch {}
    uiTextTimer = null; uiGfx = null; uiTextPlayer = null; playerUsernameText = null;
  });
}

// ============ UPDATE ============
function update() {
  const now = this.time.now;

  // Update modul TA setiap frame (jika aktif)
  if (taActive) TA_call('update', this);

  // Saat mati — kunci input
  if (isDead) {
    if (player?.body) player.setVelocity(0, 0);
    hideDodgeOutline();
    updateTimeAttackUI(this);
    updatePlayerUsernameText();
    let ms = TA_getElapsed();
    if (typeof ms !== 'number') ms = taActive ? (this.time.now - taStartMs) : 0;
    updateScoreUI(this, ms);
    return;
  }

  maintainFireballVelocity();

  if (!isAttacking && comboIndex !== 0 && (now - lastAttackAt > COMBO_RESET_MS)) comboIndex = 0;

  if (this.dodgeEnabled && Phaser.Input.Keyboard.JustDown(dodgeKeySpace)) {
    doDodge(this);
  }  

  // Cast rocket before reading movement so attack animation isn't interrupted
  if (Phaser.Input.Keyboard.JustDown(skillKeyD)) {
    castRocketSkill(this);
  }

  const speed = shiftKey?.isDown ? 200 : 120;

  if (!isDodging && Phaser.Input.Keyboard.JustDown(attackKeyF)) {
    try { this.sfx?.basicAttack?.play?.(); } catch {}
    doComboAttack(this);
  }

  if (isDodging) {
    const dir = getDominantDirFromVel(player.body.velocity.x, player.body.velocity.y) || playerLastDir;
    const key = dir === 'up' ? 'run_up' : dir === 'down' ? 'run_down' : 'run_side';
    const flip = (dir === 'left');
    playMoveAnim(key, flip);
    player.anims.paused = false;
    if (player.anims.timeScale !== 1) player.anims.timeScale = 1;
    updateDodgeOutline();
    updateTimeAttackUI(this);
    updatePlayerUsernameText();
    let ms = TA_getElapsed();
    if (typeof ms !== 'number') ms = taActive ? (this.time.now - taStartMs) : 0;
    updateScoreUI(this, ms);
    return;
  } else {
    hideDodgeOutline();
  }

  if (isAttacking) {
    player.setVelocity(0, 0);
  } else {
    player.body.setVelocity(0);

    let animKey = null, flip = false;
    if (cursors.left.isDown)  { player.body.setVelocityX(-speed); animKey = shiftKey.isDown ? 'run_side' : 'walk_side'; flip = true;  playerLastDir = 'left'; }
    else if (cursors.right.isDown) { player.body.setVelocityX(speed);  animKey = shiftKey.isDown ? 'run_side' : 'walk_side'; flip = false; playerLastDir = 'right'; }

    if (cursors.up.isDown)    { player.body.setVelocityY(-speed); animKey = shiftKey.isDown ? 'run_up'   : 'walk_up';  playerLastDir = 'up'; }
    else if (cursors.down.isDown){ player.body.setVelocityY(speed);  animKey = shiftKey.isDown ? 'run_down' : 'walk_down'; playerLastDir = 'down'; }

    if (animKey) {
      playMoveAnim(animKey, flip);
    } else {
      const last = player.anims.currentAnim?.key || 'idle_down';
      const key = last.includes('up') ? 'idle_up' : (last.includes('side') ? 'idle_side' : 'idle_down');
      playMoveAnim(key, player.flipX);
    }
  }

  // Boss AI
  if (mobs) {
    const AGGRO_RANGE = 220, ATTACK_RANGE_IN = 42, ATTACK_RANGE_OUT = 52, MOB_SPEED = 38;
    const STATE_LOCK_MS = 150;
    const DEADZONE_NEAR = 18;

    mobs.getChildren().forEach(m => {
      if (!m.active || m.hp <= 0) return;

      // During special phase transition, freeze AI and let animations run
      if (m.inPhaseTransition) {
        m.body.velocity.x = 0; m.body.velocity.y = 0;
        return;
      }

      const dx = player.x - m.x, dy = player.y - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      const now = this.time.now;

      if (m.__st === undefined) m.__st = 'idle';
      if (m.__stLockUntil === undefined) m.__stLockUntil = 0;

      const closeEnough = dist <= ATTACK_RANGE_IN;
      const farEnough   = dist >= ATTACK_RANGE_OUT;

      if (now >= m.__stLockUntil) {
        if (m.__st === 'move') {
          if (closeEnough || dist >= AGGRO_RANGE) { m.__st = 'idle'; m.__stLockUntil = now + STATE_LOCK_MS; }
        } else {
          if (!closeEnough && dist < AGGRO_RANGE && farEnough) { m.__st = 'move'; m.__stLockUntil = now + STATE_LOCK_MS; }
        }
      }

      if (m.__st === 'move') {
        if (dist <= DEADZONE_NEAR) {
          m.body.velocity.x = Phaser.Math.Linear(m.body.velocity.x, 0, 0.35);
          m.body.velocity.y = Phaser.Math.Linear(m.body.velocity.y, 0, 0.35);
        } else {
          m.setVelocity((dx / dist) * MOB_SPEED, (dy / dist) * MOB_SPEED);
        }
        const runKey = `${m.animPrefix || (m.isBoss ? 'mob' : 'minion')}_run`;
        if (m.anims.currentAnim?.key !== runKey || !m.anims.isPlaying) m.play(runKey, true);
      } else {
        m.body.velocity.x = Phaser.Math.Linear(m.body.velocity.x, 0, 0.5);
        m.body.velocity.y = Phaser.Math.Linear(m.body.velocity.y, 0, 0.5);
        const idleKey = `${m.animPrefix || (m.isBoss ? 'mob' : 'minion')}_idle`;
        if (m.anims.currentAnim?.key !== idleKey || !m.anims.isPlaying) m.play(idleKey, true);
      }

      if (m.isBoss) {
        if (!minionsSummoned && (m.hp <= BOSS_MAX_HP * 0.30)) {
          // Phase transition: death anim → teleport → reverse death → summon
          minionsSummoned = true; // lock immediately to avoid re-entry
          const scene = this;
          const centerX = scene.physics.world.bounds.width / 2;
          const centerY = scene.physics.world.bounds.height / 2;
          m.setVelocity(0, 0);
          m.inPhaseTransition = true;
          m.body.moves = false;
          // Pause shooting during phase transition
          nextBossShootAt = Number.MAX_SAFE_INTEGER;
          // play death animation (not actually dying)
          if (scene.anims.exists('mob_death')) {
            m.play('mob_death');
            m.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
              m.setPosition(centerX, centerY);
              // play reverse to simulate resurrection
              if (scene.anims.exists('mob_death_rev')) {
                m.play('mob_death_rev');
                m.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                  spawnMinions.call(scene, m, 3);
                  m.body.moves = true;
                  m.inPhaseTransition = false;
                  // resume shooting after short delay
                  scene.time.delayedCall(300, () => { nextBossShootAt = scene.time.now + 400; });
                });
              } else {
                spawnMinions.call(scene, m, 3);
                m.body.moves = true;
                m.inPhaseTransition = false;
                scene.time.delayedCall(300, () => { nextBossShootAt = scene.time.now + 400; });
              }
            });
          } else {
            // fallback: instant teleport + summon
            m.setPosition(centerX, centerY);
            spawnMinions.call(scene, m, 3);
            m.body.moves = true;
            m.inPhaseTransition = false;
            scene.time.delayedCall(300, () => { nextBossShootAt = scene.time.now + 400; });
          }
        }
        if (now >= nextBossShootAt && dist <= BOSS_SHOOT_RANGE) {
          shootFireball(this, m, player, dist);
          nextBossShootAt = now + FIREBALL_CD_MS;
        }
      }
    });

    updateBossHPBar(this, bossHP, BOSS_MAX_HP);
    {
      let ms = TA_getElapsed();
      if (typeof ms !== 'number') ms = taActive ? (this.time.now - taStartMs) : 0;
      updateScoreUI(this, ms);
    }    
  }
  

  // Update UI Time Attack tiap frame
  updateTimeAttackUI(this);
  // Update username text position
  updatePlayerUsernameText();
}

// ----------------- Helpers, UI, Damage, FB -----------------
function buildMap(mapKey) {
  Object.values(mapLayers).forEach(l => l?.destroy());
  mapLayers = {};
  portals.forEach(p => p.zone.destroy());
  portals = [];

  const map = this.make.tilemap({ key: mapKey });
  const tilesets = [];
  for (const ts of map.tilesets) {
    if (this.textures.exists(ts.name)) tilesets.push(map.addTilesetImage(ts.name, ts.name));
  }
  map.layers.forEach(layer => {
    mapLayers[layer.name] = map.createLayer(layer.name, tilesets, 0, 0);
  });
  return map;
}

function setupPortals(map) {
  const portalLayer = map.getObjectLayer('Portals');
  if (!portalLayer?.objects?.length) return;

  for (const obj of portalLayer.objects) {
    const cx = obj.x + (obj.width || 0) / 2;
    const cy = obj.y + (obj.height || 0) / 2;
    const w  = obj.width  || 32;
    const h  = obj.height || 32;

    const zone = this.add.zone(cx, cy, w, h);
    this.physics.add.existing(zone, true);

    const props = {};
    if (obj.properties) for (const p of obj.properties) props[p.name] = p.value;
    portals.push({ zone, props });

    this.physics.add.overlap(player, zone, () => {
      if (!portalsEnabled) return;
      const now = this.time.now;
      if (now < portalCooldownUntil) return;
      portalCooldownUntil = now + PORTAL_COOLDOWN_MS;
      if (isTransitioning) return;
      isTransitioning = true;

      const targetKey = String(props.targetMap || '').trim();
      let targetX = Number(props.targetX) || 0;
      let targetY = Number(props.targetY) || 0;

      const exitDX = Number(props.exitDX || 0);
      const exitDY = Number(props.exitDY || DEFAULT_SPAWN_NUDGE);
      targetX += exitDX; targetY += exitDY;

      portals.forEach(p => { if (p.zone.body) p.zone.body.enable = false; });

      const targetData = this.cache.tilemap.get(targetKey);
      let needLoad = false;
      if (targetData?.tilesets) {
        for (const ts of targetData.tilesets) {
          if (ts.image && !this.textures.exists(ts.name)) {
            this.load.image(ts.name, 'assets/' + ts.image);
            needLoad = true;
          }
        }
      }
      const go = () => {
        try { hideDodgeOutline(); } catch (e) {}
        this.scene.restart({ mapKey: targetKey, spawn: { x: targetX, y: targetY } });
      };
      if (needLoad) { this.load.once('complete', go); this.load.start(); } else { go(); }
    });
  }
}

function setupPlayerAnims() {
  if (!this.anims.exists('idle_down') && this.textures.exists('idle_down')) {
    this.anims.create({ key: 'idle_down', frames: this.anims.generateFrameNumbers('idle_down'), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'idle_side', frames: this.anims.generateFrameNumbers('idle_side'), frameRate: 6, repeat: -1 });
    this.anims.create({ key: 'idle_up',   frames: this.anims.generateFrameNumbers('idle_up'),   frameRate: 6, repeat: -1 });

    this.anims.create({ key: 'walk_down', frames: this.anims.generateFrameNumbers('walk_down'), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'walk_side', frames: this.anims.generateFrameNumbers('walk_side'), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'walk_up',   frames: this.anims.generateFrameNumbers('walk_up'),   frameRate: 8, repeat: -1 });

    this.anims.create({ key: 'run_down',  frames: this.anims.generateFrameNumbers('run_down'),  frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'run_side',  frames: this.anims.generateFrameNumbers('run_side'),  frameRate: 12, repeat: -1 });
    this.anims.create({ key: 'run_up',    frames: this.anims.generateFrameNumbers('run_up'),    frameRate: 12, repeat: -1 });
  }

  if (this.textures.exists('fireball')) {
    const src = this.textures.get('fireball').getSourceImage?.();
    let total = 16;
    if (src && src.width && src.height) {
      const cols = Math.floor(src.width / 64);
      const rows = Math.floor(src.height / 64);
      total = Math.max(1, cols * rows);
    }
    const flyEnd = Math.min(7, total - 1);
    if (!this.anims.exists('fireball_fly')) {
      this.anims.create({
        key: 'fireball_fly',
        frames: this.anims.generateFrameNumbers('fireball', { start: 0, end: flyEnd }),
        frameRate: Math.min(12, 6 + flyEnd), repeat: -1
      });
    }
    if (total >= 9 && !this.anims.exists('fireball_explode')) {
      this.anims.create({
        key: 'fireball_explode',
        frames: this.anims.generateFrameNumbers('fireball', { start: 8, end: Math.min(15, total - 1) }),
        frameRate: 16, repeat: 0
      });
    }
  }

  if (!this.anims.exists('atk_down')   && this.textures.exists('atk_down'))
    this.anims.create({ key: 'atk_down',   frames: this.anims.generateFrameNumbers('atk_down',   { start: 0, end: 7 }), frameRate: 14, repeat: 0 });
  if (!this.anims.exists('atk_side')   && this.textures.exists('atk_side'))
    this.anims.create({ key: 'atk_side',   frames: this.anims.generateFrameNumbers('atk_side',   { start: 0, end: 7 }), frameRate: 14, repeat: 0 });
  if (!this.anims.exists('atk_up')     && this.textures.exists('atk_up'))
    this.anims.create({ key: 'atk_up',     frames: this.anims.generateFrameNumbers('atk_up',     { start: 0, end: 7 }), frameRate: 14, repeat: 0 });

  if (!this.anims.exists('slice_down') && this.textures.exists('slice_down'))
    this.anims.create({ key: 'slice_down', frames: this.anims.generateFrameNumbers('slice_down', { start: 0, end: 7 }), frameRate: 14, repeat: 0 });
  if (!this.anims.exists('slice_side') && this.textures.exists('slice_side'))
    this.anims.create({ key: 'slice_side', frames: this.anims.generateFrameNumbers('slice_side', { start: 0, end: 7 }), frameRate: 14, repeat: 0 });
  if (!this.anims.exists('slice_up')   && this.textures.exists('slice_up'))
    this.anims.create({ key: 'slice_up',   frames: this.anims.generateFrameNumbers('slice_up',   { start: 0, end: 7 }), frameRate: 14, repeat: 0 });

  if (!this.anims.exists('crush_down') && this.textures.exists('crush_down'))
    this.anims.create({ key: 'crush_down', frames: this.anims.generateFrameNumbers('crush_down', { start: 0, end: 7 }), frameRate: 12, repeat: 0 });
  if (!this.anims.exists('crush_side') && this.textures.exists('crush_side'))
    this.anims.create({ key: 'crush_side', frames: this.anims.generateFrameNumbers('crush_side', { start: 0, end: 7 }), frameRate: 12, repeat: 0 });
  if (!this.anims.exists('crush_up')   && this.textures.exists('crush_up'))
    this.anims.create({ key: 'crush_up',   frames: this.anims.generateFrameNumbers('crush_up',   { start: 0, end: 7 }), frameRate: 12, repeat: 0 });

  if (!this.anims.exists('death_down') && this.textures.exists('death_down'))
    this.anims.create({ key: 'death_down', frames: this.anims.generateFrameNumbers('death_down', { start: 0, end: 7 }), frameRate: 12, repeat: 0 });
  if (!this.anims.exists('death_side') && this.textures.exists('death_side'))
    this.anims.create({ key: 'death_side', frames: this.anims.generateFrameNumbers('death_side', { start: 0, end: 7 }), frameRate: 12, repeat: 0 });
  if (!this.anims.exists('death_up') && this.textures.exists('death_up'))
    this.anims.create({ key: 'death_up', frames: this.anims.generateFrameNumbers('death_up', { start: 0, end: 7 }), frameRate: 12, repeat: 0 });

  // Rocket fire animation (atlas)
  if (this.textures.exists('rocket_fire') && !this.anims.exists('rocket_fire')) {
    try {
      this.anims.create({
        key: 'rocket_fire',
        frames: this.anims.generateFrameNames('rocket_fire', { prefix: 'rocket_', start: 0, end: 24 }),
        frameRate: 18,
        repeat: -1
      });
    } catch {}
  }
}

// (portal FX helpers removed)

function resetTimeScaleIfNotAttack(nextKey) {
  const isAttackKey = nextKey && (nextKey.startsWith('atk_') || nextKey.startsWith('slice_') || nextKey.startsWith('crush_'));
  if (!isAttackKey && player.anims?.timeScale && player.anims.timeScale !== 1) player.anims.timeScale = 1;
}
function playMoveAnim(key, flip) {
  resetTimeScaleIfNotAttack(key);
  if (!key || !player.anims) return;
  player.setFlipX(flip);
  if (player.anims.currentAnim?.key !== key || !player.anims.isPlaying) {
    if (player.scene.anims.exists(key)) player.anims.play(key, true);
  }
}
function playAttackWithSpeed(scene, animKey, desiredMs) {
  if (!scene.anims.exists(animKey)) return;
  const anim = scene.anims.get(animKey);
  const totalFrames = anim.getTotalFrames();
  const baseMsPerFrame = anim.msPerFrame || (1000 / (anim.frameRate || 12));
  const baseDuration = baseMsPerFrame * totalFrames;
  const scale = Math.max(0.1, baseDuration / Math.max(60, desiredMs));
  player.anims.timeScale = scale;
  player.anims.play(animKey, true);
  const reset = () => { player.anims.timeScale = 1; };
  player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, reset);
  player.once(Phaser.Animations.Events.ANIMATION_STOP, reset);
}

// Attack
function doComboAttack(scene) {
  if (isDodging || isAttacking || attackCD || isDead) return;

  const type = COMBO_CHAIN[comboIndex];
  comboIndex = (comboIndex + 1) % COMBO_CHAIN.length;

  isAttacking = true;
  attackCD = true;
  lastAttackAt = scene.time.now;

  const dir = playerLastDir;
  const animKey = getAnimKey(type, dir);
  player.setFlipX(dir === 'left');

  const desiredMs = DESIRED_ANIM_MS[type] || (ATTACK_UNLOCK_MS + 40);
  player.setVelocity(0, 0);
  if (scene.anims.exists(animKey)) playAttackWithSpeed(scene, animKey, desiredMs);

  const hb = getHitboxRect(type, dir);
  const hitbox = scene.add.zone(hb.x, hb.y, hb.w, hb.h);
  scene.physics.add.existing(hitbox, true);

  if (mobs) {
    scene.physics.add.overlap(hitbox, mobs, (_hb, mob) => {
      if (!mob.active || mob.hp <= 0) return;
      // Boss is immune during phase transition
      if (mob.inPhaseTransition) return;
      const mult = DMG_MULTIPLIER[type] || 1;
      mob.hp -= mult;
      bossHP = Phaser.Math.Clamp(mob.hp, 0, BOSS_MAX_HP);

      const dx = mob.x - player.x, dy = mob.y - player.y, d = Math.hypot(dx, dy) || 1;
      if (!mob.inPhaseTransition) {
        mob.body.velocity.x += (dx / d) * 60;
        mob.body.velocity.y += (dy / d) * 60;
      }

      if (mob.hp <= 0) {
        mob.setVelocity(0,0);

        // === HANYA untuk boss → stop timer, submit, overlay ===
        if (mob.isBoss) {
          const elapsed = stopAndGetElapsed(scene);
          onBossDefeated(calcPointsFromTime(elapsed), elapsed); // Pass duration for validation
          TA_call('submitToLeaderboard', elapsed, { reason: 'kill_boss' });
          showWinOverlay(scene, elapsed);
        }

        const deathKey = `${mob.animPrefix || (mob.isBoss ? 'mob' : 'minion')}_death`;
        if (scene.anims.exists(deathKey) && scene.anims.get(deathKey).frames.length > 0) {
          mob.play(deathKey);
          mob.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => mob.destroy());
        } else {
          mob.destroy();
        }
      }
    });
  }

  scene.time.delayedCall(ATTACK_UNLOCK_MS, () => { isAttacking = false; });
  scene.time.delayedCall(ATTACK_COOLDOWN_MS, () => { attackCD = false; });
  scene.time.delayedCall(HITBOX_LIFETIME_MS, () => { if (hitbox && hitbox.body) hitbox.destroy(); });
}
function getAnimKey(type, dir) {
  const base = (t) => (t === 'pierce' ? 'atk' : t);
  const d = dir === 'up' ? 'up' : (dir === 'down' ? 'down' : 'side');
  return `${base(type)}_${d}`;
}
function getHitboxRect(type, dir) {
  const cfg = {
    pierce: { range: 40, w: 32, h: 26 },
    crush:  { range: 52, w: 46, h: 34 },
    slice:  { range: 46, w: 40, h: 30 },
  }[type];

  let x = player.x, y = player.y, w = cfg.w, h = cfg.h;
  if (dir === 'down')      { y += cfg.range/2;  w = cfg.w; h = cfg.range; }
  else if (dir === 'up')   { y -= cfg.range/2;  w = cfg.w; h = cfg.range; }
  else if (dir === 'right'){ x += cfg.range/2;  w = cfg.range; h = cfg.w; }
  else if (dir === 'left') { x -= cfg.range/2;  w = cfg.range; h = cfg.w; }
  return { x, y, w, h };
}

// Dodge
function doDodge(scene) {
  if (isDodging || dodgeOnCD || isDead) return;

  let dirX = 0, dirY = 0;
  if (cursors.left.isDown)  dirX = -1;
  else if (cursors.right.isDown) dirX = 1;
  if (cursors.up.isDown)    dirY = -1;
  else if (cursors.down.isDown)  dirY = 1;
  if (dirX === 0 && dirY === 0) {
    if      (playerLastDir === 'left')  dirX = -1;
    else if (playerLastDir === 'right') dirX =  1;
    else if (playerLastDir === 'up')    dirY = -1;
    else                                dirY =  1;
  }

  const len = Math.hypot(dirX, dirY) || 1;
  dirX /= len; dirY /= len;

  isAttacking = false; attackCD = false;
  resetTimeScaleIfNotAttack('run_side');

  isDodging = true; isInvulnerable = true; dodgeOnCD = true;

  const origAlpha = player.alpha;
  player.setAlpha(0.8);
  player.setVelocity(dirX * DODGE_SPEED, dirY * DODGE_SPEED);

  const dir = getDominantDirFromVel(player.body.velocity.x, player.body.velocity.y) || playerLastDir;
  const runKey = dir === 'up' ? 'run_up' : dir === 'down' ? 'run_down' : 'run_side';
  const flip = (dir === 'left');
  playMoveAnim(runKey, flip);
  player.anims.paused = false;
  player.anims.timeScale = 1;

  playerLastDir = dir;


  showDodgeOutline(scene);

  scene.time.delayedCall(DODGE_DURATION_MS - DODGE_FRICTION_MS, () => {
    player.setVelocity(dirX * (DODGE_SPEED * 0.45), dirY * (DODGE_SPEED * 0.45));
  });

  scene.time.delayedCall(DODGE_DURATION_MS, () => {
    isDodging = false; isInvulnerable = false;
    player.setVelocity(0, 0);
    player.setAlpha(origAlpha);
    hideDodgeOutline();
  });

  scene.time.delayedCall(DODGE_COOLDOWN_MS, () => { dodgeOnCD = false; });
}
function getDominantDirFromVel(vx, vy) {
  if (Math.abs(vx) > Math.abs(vy)) return vx < 0 ? 'left' : 'right';
  if (Math.abs(vy) > 0) return vy < 0 ? 'up' : 'down';
  return null;
}

// Aim helper: prefer arrow/WASD inputs, then current velocity, then last facing
function getAimUnitVector() {
  let vx = 0, vy = 0;
  if (cursors.left?.isDown)  vx -= 1;
  if (cursors.right?.isDown) vx += 1;
  if (cursors.up?.isDown)    vy -= 1;
  if (cursors.down?.isDown)  vy += 1;

  let len = Math.hypot(vx, vy);
  if (len > 0) return { ux: vx / len, uy: vy / len };

  if (player?.body) {
    vx = player.body.velocity.x;
    vy = player.body.velocity.y;
    len = Math.hypot(vx, vy);
    if (len > 10) return { ux: vx / len, uy: vy / len };
  }

  switch (playerLastDir) {
    case 'up':    return { ux: 0,  uy: -1 };
    case 'down':  return { ux: 0,  uy:  1 };
    case 'left':  return { ux: -1, uy:  0 };
    default:      return { ux: 1,  uy:  0 };
  }
}

// Helper: copy frame dari player ke sprite lain secara aman
function safeCopyPlayerFrameTo(sprite) {
  if (!sprite || !player) return;
  try {
    if (player.frame && player.frame.name != null) {
      const targetTexture = sprite.texture;
      const targetFrame = targetTexture?.get?.(player.frame.name);
      if (targetFrame && targetFrame.data && targetFrame.data.cut) {
        sprite.setFrame(player.frame.name);
        return;
      }
    }
  } catch (e) { /* fallback below */ }
  // Fallback ke frame 0 jika ada
  try {
    const tex = sprite.texture;
    const hasMultipleFrames = (tex?.frameTotal ?? 0) > 1;
    if (hasMultipleFrames && tex.has && tex.has(0)) {
      const f0 = tex.get?.(0);
      if (f0 && f0.data && f0.data.cut) sprite.setFrame(0);
    }
  } catch (e) {}
}

// Dodge outline FX
function initDodgeOutline(scene) {
  dodgeOutline.forEach(s => s.destroy());
  dodgeOutline = [];
  if (player.texture && scene.textures.exists(player.texture.key)) {
    const offsets = [
      [ 0, -1], [ 1, -1], [ 1, 0], [ 1, 1],
      [ 0,  1], [-1,  1], [-1, 0], [-1,-1]
    ];
    for (const [ox, oy] of offsets) {
      // Buat tanpa argumen frame → lalu set dengan aman
      const s = scene.add.sprite(player.x, player.y, player.texture.key);
      s.setOrigin(player.originX ?? 0.5, player.originY ?? 0.5);
      s.setDepth((player.depth ?? 0) + 1);
      s.setAlpha(0.9);
      s.setTint(0xffffff);
      s.setBlendMode(Phaser.BlendModes.ADD);
      s.visible = false;
      s.__ox = ox; s.__oy = oy;
      safeCopyPlayerFrameTo(s); // salin frame kalau ada
      dodgeOutline.push(s);
    }
  } else {
    const g = scene.add.graphics();
    g.setDepth((player.depth ?? 0) + 1);
    g.visible = false;
    g.__isGraphics = true;
    dodgeOutline.push(g);
  }
}
function showDodgeOutline(scene) {
  if (!dodgeOutline.length) initDodgeOutline(scene);
  if (dodgeOutline[0].__isGraphics) {
    const g = dodgeOutline[0];
    g.clear(); g.lineStyle(3, 0xffffff, 0.95);
    g.strokeRoundedRect(player.x - 18, player.y - 18, 36, 36, 6);
    g.visible = true;
  } else {
    for (const s of dodgeOutline) {
      s.visible = true;
      s.x = player.x + s.__ox; 
      s.y = player.y + s.__oy;
      // 👇 Hindari null frame
      safeCopyPlayerFrameTo(s);
    }
    if (!dodgeOutlinePulse) {
      dodgeOutlinePulse = scene.tweens.add({
        targets: dodgeOutline,
        alpha: { from: 0.35, to: 0.9 },
        yoyo: true, repeat: -1, duration: 120
      });
    }
  }
}

function hideDodgeOutline() {
  if (!dodgeOutline.length) return;
  if (dodgeOutlinePulse) { dodgeOutlinePulse.stop(); dodgeOutlinePulse = null; }
  for (const s of dodgeOutline) {
    if (s.__isGraphics) { s.clear(); s.visible = false; }
    else { s.visible = false; }
  }
}
function updateDodgeOutline() {
  if (!dodgeOutline.length) return;
  if (dodgeOutline[0].__isGraphics) {
    const g = dodgeOutline[0];
    g.clear(); g.lineStyle(3, 0xffffff, 0.95);
    g.strokeRoundedRect(player.x - 18, player.y - 18, 36, 36, 6);
    g.visible = true; 
    return;
  }
  for (const s of dodgeOutline) {
    if (!s.visible) continue;
    s.x = player.x + s.__ox; 
    s.y = player.y + s.__oy;
    // 👇 Hindari null frame
    safeCopyPlayerFrameTo(s);
    s.setDepth((player.depth ?? 0) + 1);
  }
}


// UI (player)
function initUI() {
  uiGfx = this.add.graphics();
  uiTextPlayer = this.add.text(12, 10, '', { fontFamily: 'monospace', fontSize: 14, color: '#ffffff' })
    .setScrollFactor(0).setDepth(9999);
  uiGfx.setScrollFactor(0).setDepth(9998);
}
function refreshUI() {
  uiGfx.clear();
  const x = 10, y = 30, w = 160, h = 10;
  uiGfx.fillStyle(0x222222, 0.8).fillRect(x, y, w, h);
  const ratio = Phaser.Math.Clamp(playerHP / PLAYER_MAX_HP, 0, 1);
  uiGfx.fillStyle(0x31d27d, 1).fillRect(x+1, y+1, Math.floor((w-2)*ratio), h-2);
  uiTextPlayer.setText(`HP: ${Math.max(0, Math.ceil(playerHP))}/${PLAYER_MAX_HP}`);
}

// === PLAYER USERNAME TEXT ===
function initPlayerUsernameText() {
  // Clean up any existing username text
  if (playerUsernameText) {
    try { playerUsernameText.destroy(); } catch {}
    playerUsernameText = null;
  }
  
  // Get username from authentication system
  const username = getPlayerUsername();
  
  if (username && player) {
    // Create username text that follows the player
    playerUsernameText = this.add.text(player.x, player.y + 25, username, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center'
    }).setOrigin(0.5, 0.5).setDepth(player.depth + 1);
  }
}

function updatePlayerUsernameText() {
  if (playerUsernameText && player) {
    // Update position to follow player
    playerUsernameText.setPosition(player.x, player.y + 25);
    // Ensure username text is always on top
    playerUsernameText.setDepth(player.depth + 1);
  }
}

function getPlayerUsername() {
  // Try multiple sources for username
  if (window.MONKNIGHT_AUTH?.username) {
    return window.MONKNIGHT_AUTH.username;
  }
  
  if (PLAYER_USERNAME) {
    return PLAYER_USERNAME;
  }
  
  // Check localStorage
  const storedUser = localStorage.getItem('mgid_user');
  if (storedUser) {
    // If it's a wallet address (starts with 0x), don't show it
    if (storedUser.startsWith('0x')) {
      return null; // Don't show wallet addresses as usernames
    }
    return storedUser;
  }
  
  return null;
}

// === TIME ATTACK UI (kecil, kanan-atas) ===
function initTimeAttackUI() {
  // Kalau ada sisa dari scene lain / objek invalid → hancurkan
  if (uiTextTimer && (uiTextTimer.destroyed || uiTextTimer.scene !== this)) {
    try { uiTextTimer.destroy(); } catch {}
    uiTextTimer = null;
  }
  // Buat baru untuk scene ini
  if (!uiTextTimer) {
    uiTextTimer = this.add.text(this.scale.width - 12, 10, '00:00.00', {
      fontFamily: 'monospace', fontSize: 16, color: '#ffe066'
    }).setScrollFactor(0).setDepth(10000).setOrigin(1, 0);

    // Bersihkan otomatis ketika scene ditutup
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      try { uiTextTimer?.destroy(); } catch {}
      uiTextTimer = null;
    });

    // Tunda 1 tick supaya internal frame siap
    this.time.delayedCall(0, () => updateTimeAttackUI(this));
    return;
  }

  updateTimeAttackUI(this);
}
function updateTimeAttackUI(scene) {
  // Jangan sentuh kalau objeknya tidak valid / bukan milik scene ini
  if (!uiTextTimer || uiTextTimer.destroyed || uiTextTimer.scene !== scene) return;

  let ms = TA_getElapsed();
  if (typeof ms !== 'number') ms = taActive ? (scene.time.now - taStartMs) : 0;
  ms = Math.max(0, Math.floor(ms));

  try {
    uiTextTimer.setText(formatTime(ms));
    uiTextTimer.setColor(taActive ? '#ffe066' : '#a3ff8f');
  } catch (e) {
    // Kalau kebetulan objek invalid di tengah transisi, buang biar aman
    try { uiTextTimer?.destroy(); } catch {}
    uiTextTimer = null;
  }
}


// Format fallback (kalau TimeAttack.formatMs tidak tersedia)
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  const pad = (n, w=2) => String(n).padStart(w, '0');
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

// Helper: banner kemenangan + submit
function showWinOverlay(scene, elapsedMs) {
  // Panel sederhana di tengah
  const w = scene.scale.width, h = scene.scale.height;
  const gfx = scene.add.graphics().setScrollFactor(0).setDepth(10001);
  gfx.fillStyle(0x000000, 0.55).fillRoundedRect(w*0.5-180, h*0.5-70, 360, 140, 12);
  gfx.lineStyle(2, 0xffffff, 0.95).strokeRoundedRect(w*0.5-180, h*0.5-70, 360, 140, 12);

  // Check if this is a new best time
  const best = TA_call('getBestLocal');
  const isBest = (typeof best === 'number') ? (elapsedMs < best) : true;
  
  const titleText = isBest ? 'NEW BEST!' : 'VICTORY!';
  const titleColor = isBest ? '#ffd700' : '#a3ff8f';

  const t1 = scene.add.text(w*0.5, h*0.5-24, titleText, {
    fontFamily: 'monospace', fontSize: 28, color: titleColor
  }).setScrollFactor(0).setDepth(10002).setOrigin(0.5, 0.5);

  const t2 = scene.add.text(w*0.5, h*0.5+16, `Time: ${formatTime(elapsedMs)}`, {
    fontFamily: 'monospace', fontSize: 20, color: '#ffe066'
  }).setScrollFactor(0).setDepth(10002).setOrigin(0.5, 0.5);

  // balik ke menu setelah 1.6 detik
  scene.time.delayedCall(1600, () => {
    try { gfx.destroy(); t1.destroy(); t2.destroy(); } catch {}
    scene.scene.start('MainMenu'); // atau restart map battle, terserah flow kamu
  });

  // Play success SFX only if new best
  if (isBest) {
    try { scene.sfx?.success?.play?.(); } catch {}
  }
}

// Util: stop TA + ambil elapsed yang aman
function stopAndGetElapsed(scene) {
  let elapsed = taStop(scene, { submit: false });
  if (typeof elapsed !== 'number') elapsed = (taActive ? (scene.time.now - taStartMs) : 0);
  return Math.max(0, Math.floor(elapsed));
}

// Boss bar
function createBossBar() {
  destroyBossBar();
  const w = 320, h = 14;
  bossBar = { gfx: this.add.graphics().setScrollFactor(0).setDepth(9999), x: (this.scale.width - w) / 2, y: 10, w, h };
  updateBossHPBar(this, bossHP, BOSS_MAX_HP);
}
function updateBossHPBar(scene, hp, max) {
  if (!bossBar) return;
  const {gfx,x,y,w,h} = bossBar;
  gfx.clear();
  gfx.lineStyle(2, 0xffffff, 0.95).strokeRect(x, y, w, h);
  gfx.fillStyle(0x000000, 0.45).fillRect(x+1, y+1, w-2, h-2);
  const ratio = Phaser.Math.Clamp(hp / max, 0, 1);
  gfx.fillStyle(0xff3b30, 1).fillRect(x+1, y+1, Math.floor((w-2)*ratio), h-2);
}
function destroyBossBar() { if (bossBar) { bossBar.gfx.destroy(); bossBar = null; } }

// Damage + death/respawn
function damagePlayer(amount) {
  if (isDead) return;
  playerHP = Math.max(0, playerHP - amount);
  refreshUI();

  if (playerHP > 0) {
    try { player.scene.sfx?.hitSound?.play?.(); } catch {}
    player.setTintFill(0xffffff);
    player.scene.time.delayedCall(50, () => player.clearTint());
  } else {
    player.clearTint();
    killPlayer(player.scene);
  }
}
function killPlayer(scene) {
  if (isDead) return;
  isDead = true; isInvulnerable = true;

  taStop(scene, { submit: false });

  player.setVelocity(0, 0);
  if (player.body) player.body.enable = false;

  const dir = playerLastDir || 'down';
  const key = dir === 'up' ? 'death_up' : (dir === 'down' ? 'death_down' : 'death_side');
  const flip = (dir === 'left');
  player.setFlipX(flip);
  if (scene.anims.exists(key)) { player.anims.timeScale = 1; player.play(key); }

  // play death sfx once
  try { if (!scene.sfx?.heroDead?.isPlaying) scene.sfx?.heroDead?.play?.(); } catch {}

  scene.tweens.add({ targets: player, alpha: { from: 1, to: 0.3 }, duration: 600, ease: 'Quad.easeOut' });

  scene.time.delayedCall(1600, () => {
    playerHP = PLAYER_MAX_HP;
    isDead = false; isInvulnerable = false;
    scene.cameras.main.fadeOut(200, 0, 0, 0);
    scene.time.delayedCall(220, () => {
      scene.cameras.main.fadeIn(200, 0, 0, 0);
      scene.scene.restart({ mapKey: currentMapKey });
    });
  });
}

// Fireball helpers
function ensureFireballFallback(scene) {
  if (scene.textures.exists(FB_FALLBACK_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const R = 8;
  g.fillStyle(0xff5522, 1).fillCircle(R, R, R);
  g.lineStyle(2, 0xffffff, 0.9).strokeCircle(R, R, R - 2);
  g.generateTexture(FB_FALLBACK_KEY, R * 2, R * 2);
  g.destroy();
}
function drawFireballTracer(scene, x0, y0, x1, y1) {
  if (!scene.__fbTracer) scene.__fbTracer = scene.add.graphics().setDepth(9999).setScrollFactor(1);
  const g = scene.__fbTracer;
  g.clear();
  g.lineStyle(2, 0xffffff, 0.6);
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokePath();
  scene.time.delayedCall(180, () => g.clear());
}

// Fireball core
function shootFireball(scene, boss, target, distOverride = null) {
  if (!fireballs) return;

  // If boss is at or below 50% HP, fire in 5 radial directions like fireworks
  if (boss.hp <= BOSS_MAX_HP / 2) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const ang = (i * (Math.PI * 2 / count));
      const ux = Math.cos(ang), uy = Math.sin(ang);
      spawnDirectionalFireball(scene, boss, ux, uy, 520);
    }
    return;
  }

  // Normal shot: aim at player
  const dx = (target.x - boss.x), dy = (target.y - boss.y);
  const d  = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  spawnDirectionalFireball(scene, boss, ux, uy, distOverride ?? d);
}

function spawnDirectionalFireball(scene, boss, ux, uy, travelDistEstimate = 520) {
  drawFireballTracer(scene,
    boss.x + ux * FIREBALL_SPAWN_OFFSET,
    boss.y + uy * FIREBALL_SPAWN_OFFSET,
    boss.x + ux * (FIREBALL_SPAWN_OFFSET + 80),
    boss.y + uy * (FIREBALL_SPAWN_OFFSET + 80)
  );

  const baseMs = (travelDistEstimate + 32) / FIREBALL_SPEED * 1000;
  const lifeMs = Math.min(4000, Math.ceil(baseMs) + FIREBALL_EXTRA_BUFFER_MS);

  const useFallback = !scene.textures.exists('fireball');
  const texKey = useFallback ? FB_FALLBACK_KEY : 'fireball';

  const fb = scene.physics.add.sprite(
    boss.x + ux * FIREBALL_SPAWN_OFFSET,
    boss.y + uy * FIREBALL_SPAWN_OFFSET,
    texKey, 0
  );

  fb.setActive(true).setVisible(true);
  fb.body.moves = true; fb.body.immovable = false; fb.body.setAllowGravity?.(false);
  fb.setDepth((player?.depth ?? 0) + 1);

  if (!useFallback && scene.anims.exists('fireball_fly')) fb.play('fireball_fly', true);
  else if (useFallback) scene.tweens.add({ targets: fb, scale: { from: 1.0, to: 1.2 }, yoyo: true, repeat: -1, duration: 120 });

  const fw = fb.body?.sourceWidth  ?? fb.width  ?? 16;
  const fh = fb.body?.sourceHeight ?? fb.height ?? 16;
  const minSide = Math.max(8, Math.min(fw, fh));
  const radius  = Math.max(4, Math.floor(minSide / 2) - 2);
  const offX    = Math.max(0, Math.floor((fw - radius * 2) / 2));
  const offY    = Math.max(0, Math.floor((fh - radius * 2) / 2));
  fb.body.setCircle(radius, offX, offY);

  fb._armedAt = scene.time.now + FIREBALL_ARM_MS;
  fb.body.checkCollision.none = true;
  scene.time.delayedCall(FIREBALL_ARM_MS, () => { if (fb.active) fb.body.checkCollision.none = false; });

  fb.setDataEnabled();
  fb.setData('vx', ux * FIREBALL_SPEED);
  fb.setData('vy', uy * FIREBALL_SPEED);
  // Set damage based on boss phase at spawn time
  const phaseMult = getBossPhaseMultiplier(boss.hp);
  fb.setData('dmg', Math.ceil(FIREBALL_HIT * phaseMult));
  fb.setVelocity(fb.getData('vx'), fb.getData('vy'));

  fb.explodes = (boss.hp <= BOSS_MAX_HP / 2);
  fireballs.add(fb);

  scene.time.delayedCall(lifeMs, () => {
    if (!fb.active) return;
    if (fb.explodes && scene.anims.exists('fireball_explode') && !useFallback) spawnExplosion(scene, fb.x, fb.y);
    fb.destroy();
  });
}
function maintainFireballVelocity() {
  if (!fireballs) return;
  fireballs.children?.each?.((fb) => {
    if (!fb || !fb.active || !fb.body) return;
    const vx = fb.getData('vx'), vy = fb.getData('vy');
    if (vx == null || vy == null) return;
    if (fb.body.velocity.x !== vx || fb.body.velocity.y !== vy) {
      fb.body.velocity.x = vx; fb.body.velocity.y = vy;
    }
  });
}

// ============== Rocket Skill ==============
function castRocketSkill(scene) {
  if (isDead) return false;
  const now = scene.time.now;
  if (now < nextRocketAt) return false;
  nextRocketAt = now + ROCKET_CD_MS;

  try { scene.sfx?.rocketSkill?.play?.(); } catch {}

  // Sedikit anim serang biar ada feedback
  const dir = playerLastDir;
  const atkKey = getAnimKey('pierce', dir);
  isAttacking = true; attackCD = true; lastAttackAt = now;
  if (scene.anims.exists(atkKey)) playAttackWithSpeed(scene, atkKey, DESIRED_ANIM_MS.pierce);
  scene.time.delayedCall(ATTACK_UNLOCK_MS, () => { isAttacking = false; });
  scene.time.delayedCall(ATTACK_COOLDOWN_MS, () => { attackCD = false; });

  // Unit vector & sudut yang bisa DIAGONAL
  const { ux, uy } = getAimUnitVector();
  const angleDeg = Phaser.Math.RadToDeg(Math.atan2(uy, ux)) + 90;

  // Spawn sedikit di depan pemain
  const spawnOffset = 28;
  const sx = player.x + ux * spawnOffset;
  const sy = player.y + uy * spawnOffset;

  // pakai atlas rocket_fire; fallback ke fireball bila atlas belum ada
  const useAtlas = scene.textures.exists('rocket_fire');
  const texKey   = useAtlas ? 'rocket_fire' : (scene.textures.exists('fireball') ? 'fireball' : FB_FALLBACK_KEY);
  const startFrame = useAtlas ? 'rocket_0' : 0;

  const rocket = scene.physics.add.sprite(sx, sy, texKey, startFrame);
  rocket.setDepth((player?.depth ?? 0) + 1);
  rocket.setOrigin(0.5, 0.5);
  if (useAtlas && scene.anims.exists('rocket_fire')) rocket.play('rocket_fire', true);
  else if (!useAtlas && scene.anims.exists('fireball_fly')) rocket.play('fireball_fly', true);

  rocket.setAngle(angleDeg);

  // Collider kecil di tengah supaya akurat
  rocket.body.setAllowGravity?.(false);
  rocket.body.setSize(20, 20);
  rocket.body.setOffset((rocket.body.sourceWidth - 20) / 2, (rocket.body.sourceHeight - 20) / 2);

  // Kecepatan + simpan ke data biar stabil
  const vx = ux * ROCKET_SPEED;
  const vy = uy * ROCKET_SPEED;
  rocket.setDataEnabled();
  rocket.setData('vx', vx);
  rocket.setData('vy', vy);
  rocket.setData('dmg', ROCKET_DMG);
  rocket.setVelocity(vx, vy);

  if (mapLayers['Walls']) {
    scene.physics.add.collider(rocket, mapLayers['Walls'], (r) => { try { r.destroy(); } catch {} });
  }

  const travelMs = Math.ceil((ROCKET_MAX_TRAVEL / ROCKET_SPEED) * 1000) + 60;
  scene.time.delayedCall(travelMs, () => { try { rocket.destroy(); } catch {} });

  if (!scene.__maintainRockets) {
    scene.__maintainRockets = true;
    scene.events.on('update', () => {
      rockets?.children?.each?.(r => {
        if (!r?.active || !r.body) return;
        const dvx = r.getData('vx'), dvy = r.getData('vy');
        if (dvx == null || dvy == null) return;
        if (r.body.velocity.x !== dvx || r.body.velocity.y !== dvy) {
          r.body.velocity.x = dvx; r.body.velocity.y = dvy;
        }
      });
    });
  }

  rockets.add(rocket);
  return true;
}
function spawnMinions(boss, count = 3) {
  const scene = boss.scene;
  if (!mobs) mobs = scene.physics.add.group();
  const radius = 48;
  for (let i = 0; i < count; i++) {
    const ang = (i * (Math.PI * 2 / count));
    const sx = boss.x + Math.cos(ang) * radius;
    const sy = boss.y + Math.sin(ang) * radius;
    const m = scene.physics.add.sprite(sx, sy, 'minion_idle', 0).play('minion_idle');
    m.setCollideWorldBounds(true);
    m.setScale(1.5);
    m.setOrigin(0.5, 0.8);
    m.hp = 30;
    m.isBoss = false;
    // smaller body
    const TORSO_W = 14, TORSO_H = 18;
    m.body.setSize(TORSO_W, TORSO_H);
    m.body.setOffset((m.body.sourceWidth - TORSO_W)/2, (m.body.sourceHeight - TORSO_H)/2);
    mobs.add(m);
    if (mapLayers['Walls']) scene.physics.add.collider(m, mapLayers['Walls']);
  }
}
function spawnExplosion(scene, x, y) {
  const ex = scene.add.sprite(x, y, 'fireball', 8);
  ex.setDepth((player?.depth ?? 0) + 1);
  if (scene.anims.exists('fireball_explode')) ex.play('fireball_explode');

  const zone = scene.add.zone(x, y, EXPLOSION_RADIUS * 2, EXPLOSION_RADIUS * 2);
  scene.physics.add.existing(zone, true);
  zone.__hit = false;
  const overlap = scene.physics.add.overlap(player, zone, () => {
    if (zone.__hit) return;
    zone.__hit = true;
    if (!isInvulnerable) {
      const mult = getBossPhaseMultiplier(bossHP);
      damagePlayer(Math.ceil(EXPLOSION_HIT * mult));
    }
    try { overlap?.destroy(); } catch {}
    try { zone.destroy(); } catch {}
  });
  ex.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => ex.destroy());
}
