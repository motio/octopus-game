export type GameScene = 'start' | 'game' | 'gameover';

export interface GameState {
  scene: GameScene;
  score: number;
  timeLeft: number;
  playerHealth: number;
  isInvincible: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export interface Octopus {
  id: number;
  x: number;
  y: number;
  speed: number;
  health: number;
  maxHealth: number;
  color: number;
  animFrame: number; // アニメーションフレーム (0 or 1)
  animTime: number;  // 次のフレーム切り替えまでの時間
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
}
