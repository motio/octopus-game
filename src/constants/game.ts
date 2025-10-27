// ゲーム設定
export const GAME_WIDTH = 375;  // スマートフォン縦持ち想定
export const GAME_HEIGHT = 667;
export const GAME_DURATION = 60; // 60秒

// プレイヤー設定
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_HEALTH_PER_HIT = 25;
export const PLAYER_INVINCIBLE_DURATION = 3000; // 3秒
export const PLAYER_SIZE = 60;
export const PLAYER_SPEED = 5;

// 弾の設定
export const BULLET_SPEED = 16; // deltaTime補正後のPC元速度に合わせて2倍化
export const BULLET_SIZE = 8;
export const BULLET_INTERVAL = 200; // 0.2秒ごとに発射

// タコの設定
export const OCTOPUS_SIZE = 50;
export const OCTOPUS_MIN_SPEED = 2; // deltaTime補正後のPC元速度に合わせて2倍化
export const OCTOPUS_MAX_SPEED = 7; // deltaTime補正後のPC元速度に合わせて2倍化
// 紹介４：タコの出現間隔
export const OCTOPUS_SPAWN_INTERVAL = 900; // タコの出現間隔
export const OCTOPUS_COLORS = [
  // 赤
  0xff6b9d,
  // 青
  0x6bcfff,
  // 黄
  0xffd96b,
  // 紫
  0x9d6bff,
  // 緑
  0x6bff8e
];

// 背景スクロール速度
export const BACKGROUND_SCROLL_SPEED = 0.8; // deltaTime補正後のPC元速度に合わせて2倍化
