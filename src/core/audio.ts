export type SoundCue =
  | "uiSelect"
  | "uiConfirm"
  | "uiError"
  | "uiOpen"
  | "uiClose"
  | "coins"
  | "dock"
  | "board"
  | "equip"
  | "attack"
  | "crateBreak"
  | "harpoon"
  | "metalHit"
  | "hurt"
  | "sandStep"
  | "treasure"
  | "victory";

type SoundConfig = {
  src: string;
  volume: number;
  pool: number;
  rateJitter?: number;
  retriggerMs?: number;
};

type PlayOptions = {
  volume?: number;
  rate?: number;
  rateJitter?: number;
};

type MusicMood = {
  mode: "sailing" | "walking";
  speed: number;
  inMenu?: boolean;
  danger?: boolean;
};

const MUSIC_SRC = "/audio/music/sandsea-loop.ogg";

const SFX: Record<SoundCue, SoundConfig> = {
  uiSelect: { src: "/audio/sfx/ui-select.ogg", volume: 0.22, pool: 4, rateJitter: 0.04, retriggerMs: 35 },
  uiConfirm: { src: "/audio/sfx/ui-confirm.ogg", volume: 0.28, pool: 3, rateJitter: 0.03 },
  uiError: { src: "/audio/sfx/ui-error.ogg", volume: 0.26, pool: 2, retriggerMs: 140 },
  uiOpen: { src: "/audio/sfx/ui-open.ogg", volume: 0.24, pool: 2 },
  uiClose: { src: "/audio/sfx/ui-close.ogg", volume: 0.2, pool: 2 },
  coins: { src: "/audio/sfx/coins.ogg", volume: 0.42, pool: 4, rateJitter: 0.05, retriggerMs: 55 },
  dock: { src: "/audio/sfx/dock.ogg", volume: 0.34, pool: 2, rateJitter: 0.04 },
  board: { src: "/audio/sfx/board.ogg", volume: 0.34, pool: 2, rateJitter: 0.04 },
  equip: { src: "/audio/sfx/equip.ogg", volume: 0.3, pool: 3, rateJitter: 0.05 },
  attack: { src: "/audio/sfx/sword.ogg", volume: 0.34, pool: 4, rateJitter: 0.08, retriggerMs: 120 },
  crateBreak: { src: "/audio/sfx/wood-break.ogg", volume: 0.48, pool: 4, rateJitter: 0.08, retriggerMs: 70 },
  harpoon: { src: "/audio/sfx/harpoon.ogg", volume: 0.38, pool: 3, rateJitter: 0.05, retriggerMs: 90 },
  metalHit: { src: "/audio/sfx/metal-hit.ogg", volume: 0.42, pool: 4, rateJitter: 0.08, retriggerMs: 55 },
  hurt: { src: "/audio/sfx/hurt.ogg", volume: 0.42, pool: 3, rateJitter: 0.05, retriggerMs: 120 },
  sandStep: { src: "/audio/sfx/sand-step.ogg", volume: 0.16, pool: 6, rateJitter: 0.12, retriggerMs: 75 },
  treasure: { src: "/audio/sfx/treasure.ogg", volume: 0.36, pool: 2 },
  victory: { src: "/audio/sfx/victory.ogg", volume: 0.34, pool: 2 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function approach(current: number, target: number, delta: number, speed: number) {
  return current + (target - current) * (1 - Math.exp(-speed * delta));
}

class GameAudio {
  private initialized = false;
  private unlocked = false;
  private music: HTMLAudioElement | null = null;
  private musicStartAt = Infinity;
  private targetMusicVolume = 0.18;
  private pools = new Map<SoundCue, HTMLAudioElement[]>();
  private lastPlayed = new Map<SoundCue, number>();

  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.music = new Audio(MUSIC_SRC);
    this.music.loop = true;
    this.music.preload = "auto";
    this.music.volume = 0;

    for (const cue of Object.keys(SFX) as SoundCue[]) {
      this.pools.set(cue, this.createPool(SFX[cue]));
    }

    const unlock = () => this.unlock();
    window.addEventListener("click", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!this.music || !this.unlocked) return;
      if (document.hidden) {
        this.music.pause();
      } else {
        void this.startMusic();
      }
    });
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.musicStartAt = performance.now() + 350;
  }

  update(delta: number, mood: MusicMood) {
    if (!this.music) return;
    const speedAmount = clamp(Math.abs(mood.speed) / 140, 0, 1);
    const base = mood.mode === "sailing" ? 0.2 : 0.16;
    const moving = mood.mode === "sailing" ? speedAmount * 0.08 : 0.02;
    const menuDuck = mood.inMenu ? -0.08 : 0;
    const dangerLift = mood.danger ? 0.05 : 0;
    this.targetMusicVolume = clamp(base + moving + menuDuck + dangerLift, 0.08, 0.32);

    if (!this.unlocked || document.hidden) return;
    this.music.volume = approach(this.music.volume, this.targetMusicVolume, delta, 2.8);
    if (this.music.paused && performance.now() >= this.musicStartAt) void this.startMusic();
  }

  play(cue: SoundCue, options: PlayOptions = {}) {
    if (!this.initialized) this.init();
    if (!this.unlocked) return;

    const config = SFX[cue];
    const now = performance.now();
    const previous = this.lastPlayed.get(cue) ?? -Infinity;
    if (config.retriggerMs && now - previous < config.retriggerMs) return;
    this.lastPlayed.set(cue, now);

    const audio = this.nextAudio(cue, config);
    const jitter = options.rateJitter ?? config.rateJitter ?? 0;
    const rate = (options.rate ?? 1) + (Math.random() * 2 - 1) * jitter;
    audio.volume = clamp(config.volume * (options.volume ?? 1), 0, 1);
    audio.playbackRate = clamp(rate, 0.55, 1.8);
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers reject seeking before metadata is ready; play still works.
    }
    void audio.play().catch(() => undefined);
  }

  private async startMusic() {
    if (!this.music) return;
    try {
      await this.music.play();
    } catch {
      // Autoplay can still be blocked on some browsers; the next gesture retries.
    }
  }

  private createPool(config: SoundConfig) {
    return Array.from({ length: config.pool }, () => this.createAudio(config.src));
  }

  private nextAudio(cue: SoundCue, config: SoundConfig) {
    const pool = this.pools.get(cue) ?? this.createPool(config);
    this.pools.set(cue, pool);
    const available = pool.find((audio) => audio.paused || audio.ended);
    if (available) return available;
    const extra = this.createAudio(config.src);
    pool.push(extra);
    return extra;
  }

  private createAudio(src: string) {
    const audio = new Audio(src);
    audio.preload = "auto";
    return audio;
  }
}

export const gameAudio = new GameAudio();
