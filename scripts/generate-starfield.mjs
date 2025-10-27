#!/usr/bin/env node
/**
 * 860x860 のタイル可能な星空PNGを生成します。
 * 出力: public/assets/starfield.png
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { PNG } from 'pngjs';

const WIDTH = 860;
const HEIGHT = 860; // 正方形化
const OUTPUT = 'public/assets/starfield.png';

// 星の設定
const STAR_DENSITY = 0.00085; // 全体ピクセルに対する星の割合
const LARGE_STAR_RATIO = 0.07; // 大きめの星の割合
const MEDIUM_STAR_RATIO = 0.18; // 中くらいの星の割合

// ベースカラー（円環的に循環させて垂直方向シームレス化）
const BASE_TOP = { r: 12, g: 8, b: 32 };
const BASE_MID = { r: 24, g: 12, b: 50 };
const BASE_BOTTOM = { r: 12, g: 8, b: 32 }; // TOP と近い値にしてループ

// 乱数シード（再現性確保したい場合は固定値）
function rand() {
  return Math.random();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createGradientBackground(png) {
  // 垂直方向を 0..1..0 の往復カーブで循環させる
  for (let y = 0; y < HEIGHT; y++) {
    const t = y / (HEIGHT - 1); // 0..1
    const wave = t < 0.5 ? (t / 0.5) : ((1 - t) / 0.5); // 0→1→0
    // wave で MID へ寄せる
    const r = Math.round(BASE_TOP.r + (BASE_MID.r - BASE_TOP.r) * wave);
    const g = Math.round(BASE_TOP.g + (BASE_MID.g - BASE_TOP.g) * wave);
    const b = Math.round(BASE_TOP.b + (BASE_MID.b - BASE_TOP.b) * wave);
    for (let x = 0; x < WIDTH; x++) {
      const idx = (WIDTH * y + x) << 2;
      // 水平/垂直両方向に 2π 周期のノイズを用いてタイル時に継ぎ目が出ないようにする
      const nx = (2 * Math.PI * x) / WIDTH;
      const ny = (2 * Math.PI * y) / HEIGHT;
      // 周期性を保った複合サインノイズ（星雲の揺らぎ）
      const noise = (Math.sin(nx * 1.0 + ny * 1.3) + Math.sin(nx * 2.1 - ny * 0.9)) * 4;
      png.data[idx] = clampByte(r + noise);
      png.data[idx + 1] = clampByte(g + noise * 0.6);
      png.data[idx + 2] = clampByte(b + noise * 0.8);
      png.data[idx + 3] = 255;
    }
  }
  // 上下 12px をブレンドして完全に一致させる（正方形向け保険）
  const blendBand = 12;
  for (let y = 0; y < blendBand; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const topIdx = (WIDTH * y + x) << 2;
      const bottomIdx = (WIDTH * (HEIGHT - 1 - y) + x) << 2;
      // 上下平均
      for (let c = 0; c < 3; c++) {
        const avg = (png.data[topIdx + c] + png.data[bottomIdx + c]) >> 1;
        png.data[topIdx + c] = avg;
        png.data[bottomIdx + c] = avg;
      }
    }
  }
  // 左右も同様に 12px ブレンドして水平方向シームレス性を強化
  for (let x = 0; x < blendBand; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const leftIdx = (WIDTH * y + x) << 2;
      const rightIdx = (WIDTH * y + (WIDTH - 1 - x)) << 2;
      for (let c = 0; c < 3; c++) {
        const avg = (png.data[leftIdx + c] + png.data[rightIdx + c]) >> 1;
        png.data[leftIdx + c] = avg;
        png.data[rightIdx + c] = avg;
      }
    }
  }
}

function drawStar(png, cx, cy, radius, color) {
  // ガウスぼかし風のグローを作る。
  // core 半径 = radius、外側グローは radius * 2 まで緩やかに減衰。
  const outer = radius * 2 + 1;
  const sigma = radius * 0.8 || 0.8; // 半径が小さい星も少し拡散
  const twoSigmaSq = 2 * sigma * sigma;
  for (let y = -outer; y <= outer; y++) {
    for (let x = -outer; x <= outer; x++) {
      const distSq = x * x + y * y;
      if (distSq <= outer * outer) {
        // ガウス減衰
        const intensity = Math.exp(-distSq / twoSigmaSq);
        if (intensity < 0.02) continue; // 極端に弱い部分は省略して高速化
        let px = cx + x;
        let py = cy + y;
        // ラップ
        if (px < 0) px += WIDTH;
        if (px >= WIDTH) px -= WIDTH;
        if (py < 0) py += HEIGHT;
        if (py >= HEIGHT) py -= HEIGHT;
        const idx = (WIDTH * py + px) << 2;
        // 既存ピクセルを取得
        const br = png.data[idx];
        const bg = png.data[idx + 1];
        const bb = png.data[idx + 2];
        // 加算 + 補間でホットスポットを形成
        // 中心付近 (intensity ~1) では星色へ近づき、外側は淡い加算
        const mix = intensity; // 0..1
        png.data[idx] = clampByte(br + (color.r - br) * mix * 0.9 + color.r * intensity * 0.1);
        png.data[idx + 1] = clampByte(bg + (color.g - bg) * mix * 0.9 + color.g * intensity * 0.1);
        png.data[idx + 2] = clampByte(bb + (color.b - bb) * mix * 0.9 + color.b * intensity * 0.1);
        png.data[idx + 3] = 255;
      }
    }
  }
}

function addStars(png) {
  const totalPixels = WIDTH * HEIGHT;
  const starCount = Math.round(totalPixels * STAR_DENSITY);

  for (let i = 0; i < starCount; i++) {
    // 星の位置
    const x = Math.floor(rand() * WIDTH);
    const y = Math.floor(rand() * HEIGHT);

    // 星のカテゴリ
    const categoryRand = rand();
    let radius = 1;
    if (categoryRand < LARGE_STAR_RATIO) {
      radius = 3; // 大きい星
    } else if (categoryRand < LARGE_STAR_RATIO + MEDIUM_STAR_RATIO) {
      radius = 2; // 中くらい
    }

    // 色バリエーション（青白 / 黄白 / ピンク系 / 純白）
    const palette = [
      { r: 220, g: 230, b: 255 },
      { r: 255, g: 250, b: 210 },
      { r: 255, g: 220, b: 240 },
      { r: 255, g: 255, b: 255 },
    ];
    const color = palette[Math.floor(rand() * palette.length)];

    drawStar(png, x, y, radius, color);
  }
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function main() {
  console.log('Generating starfield PNG...');
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  createGradientBackground(png);
  addStars(png);

  if (!existsSync('public/assets')) {
    mkdirSync('public/assets', { recursive: true });
  }

  const buffer = PNG.sync.write(png);
  writeFileSync(OUTPUT, buffer);
  console.log(`Starfield generated: ${OUTPUT}`);
}

main();
