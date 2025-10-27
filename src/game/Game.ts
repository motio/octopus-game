import { Application, Graphics, Text, TextStyle, TilingSprite, Container, Assets, Sprite, Texture } from 'pixi.js';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GAME_DURATION,
  PLAYER_MAX_HEALTH,
  PLAYER_HEALTH_PER_HIT,
  PLAYER_INVINCIBLE_DURATION,
  PLAYER_SIZE,
  BULLET_SPEED,
  BULLET_SIZE,
  BULLET_INTERVAL,
  OCTOPUS_SIZE,
  OCTOPUS_MIN_SPEED,
  OCTOPUS_MAX_SPEED,
  OCTOPUS_SPAWN_INTERVAL,
  OCTOPUS_COLORS,
  BACKGROUND_SCROLL_SPEED,
} from '../constants/game';
import type { GameScene, Octopus, Bullet } from '../types/game';

export class Game {
  private app!: Application;
  private initialized: boolean = false;
  private scene: GameScene = 'start';
  private score: number = 0;
  private timeLeft: number = GAME_DURATION;
  private playerHealth: number = PLAYER_MAX_HEALTH;
  private isInvincible: boolean = false;
  
  private player!: Sprite;
  private bullets: Bullet[] = [];
  private octopuses: Octopus[] = [];
  private bulletGraphics: Map<number, Graphics> = new Map();
  private octopusGraphics: Map<number, Container> = new Map();
  
  private background!: TilingSprite;
  private gameContainer!: Container;
  
  private octopusTextures: Texture[] = []; // 2コマ分のテクスチャ
  private readonly ANIM_FRAME_DURATION = 300; // ミリ秒（フレーム切替間隔）
  
  private lastBulletTime: number = 0;
  private lastOctopusTime: number = 0;
  private nextBulletId: number = 0;
  private nextOctopusId: number = 0;
  private gameStartTime: number = 0;
  private invincibleStartTime: number = 0;
  
  private timeText!: Text;
  private timeValueText!: Text;
  private timeValueBaseX!: number; // パルスエフェクト用の基準X座標
  private timeValueBaseY!: number; // パルスエフェクト用の基準Y座標
  private scoreText!: Text;
  private scoreValueText!: Text;
  
  private lastTouchX: number | null = null;
  private lastTouchY: number | null = null;
  
  private onSceneChange?: (scene: GameScene) => void;
  private onScoreChange?: (score: number) => void;
  private onTimeChange?: (time: number) => void;
  private onHealthChange?: (health: number) => void;

  /**
   * ゲームインスタンスを作成し、PixiJSアプリケーションを初期化する
   */
  constructor(canvas: HTMLCanvasElement) {
    this.init(canvas);
  }

  /**
   * PixiJSアプリケーションの初期化処理を行う
   */
  private async init(canvas: HTMLCanvasElement) {
    try {
      console.log('Starting game initialization...');
      
      this.app = new Application();
      await this.app.init({
        canvas,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x000000,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      
      console.log('PixiJS app initialized');

      await this.loadAssets();
      console.log('Assets loaded');
      
      this.setupBackground();
      console.log('Background setup complete');
      
      this.setupGame();
      console.log('Game setup complete');
      
      this.app.ticker.add((ticker) => this.gameLoop(ticker.deltaTime));
      this.initialized = true;
      
      console.log('Game initialization complete!');
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  }

  /**
   * ゲームで使用する画像アセットを読み込む
   */
  private async loadAssets() {
    try {
      // 既にロード済みかチェック（HMR対応）
      const hasAssets = Assets.cache.has('starfield') && 
                        Assets.cache.has('rocket') && 
                        Assets.cache.has('octopus-sheet');
      
      if (hasAssets) {
        console.log('Assets already loaded, reusing...');
      } else {
        // 背景テクスチャを事前ロード
        await Assets.load({ alias: 'starfield', src: '/assets/starfield.png' });
        await Assets.load({ alias: 'rocket', src: '/assets/rocket.png' });
        await Assets.load({ alias: 'octopus-sheet', src: '/assets/sprite-octopus.png' });
      }
      
      // タコスプライトシート(240x120 = 120x120 × 2コマ)を分割
      const baseTexture = Assets.get<Texture>('octopus-sheet');
      
      if (!baseTexture) {
        throw new Error('Failed to load octopus-sheet texture');
      }
      
      // Canvas で各フレームを抽出
      this.octopusTextures = [
        this.extractFrame(baseTexture, 0, 0, 120, 120),
        this.extractFrame(baseTexture, 120, 0, 120, 120),
      ];
      
      console.log('Assets loaded successfully');
    } catch (error) {
      console.error('Failed to load assets:', error);
      throw error;
    }
  }

  private extractFrame(texture: Texture, x: number, y: number, width: number, height: number): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // 元のテクスチャから部分領域を抽出
    const source = texture.source;
    const resource = source.resource as any;
    
    if (!resource) {
      console.error('Texture resource not loaded');
      return Texture.EMPTY;
    }
    
    try {
      ctx.drawImage(resource, x, y, width, height, 0, 0, width, height);
      // Canvas から新しいテクスチャを作成
      return Texture.from(canvas);
    } catch (error) {
      console.error('Failed to extract frame:', error, resource);
      return Texture.EMPTY;
    }
  }

  /**
   * スクロールする星空背景を生成してステージに追加する
   */
  private setupBackground() {
    const texture = Assets.get('starfield');
    // 紹介３：タイリングテクスチャ（継ぎ目が分からない画像）
    this.background = new TilingSprite({
      texture,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    });
    // Retinaディスプレイでは2x画像を論理サイズでくっきり表示するため縮小
    if (window.devicePixelRatio >= 2) {
      this.background.tileScale.set(0.5, 0.5);
    }
    this.app.stage.addChild(this.background);
  }

  /**
   * プレイヤー、UI、タッチイベントなどのゲーム要素をセットアップする
   */
  private setupGame() {
    this.gameContainer = new Container();
    this.app.stage.addChild(this.gameContainer);

  // プレイヤー（飛行機）画像を作成（120x120 を読み込み、表示は 60x60 に縮小）
  const rocketTexture = Assets.get('rocket');
  this.player = new Sprite(rocketTexture);
  this.player.anchor.set(0.5);
  // 120px 原寸を GAME ロジック上 60px に見せたいので scale 0.5
  this.player.scale.set(0.5);
  this.player.x = GAME_WIDTH / 2;
  this.player.y = GAME_HEIGHT - 100;
  this.gameContainer.addChild(this.player);

    // UI テキスト
    // ラベルスタイル（ラベルも数値と同じエフェクト）
    const labelStyle = new TextStyle({
      fontFamily: 'Orbitron, Arial, sans-serif',
      fontSize: 16,
      fill: 0xffffff,
      fontWeight: '700',
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: 0x00ffff,
        blur: 3,
        angle: Math.PI / 6,
        distance: 1,
      },
    });
    
    // 数値スタイル（大きめ・目立つ）
    const valueStyle = new TextStyle({
      fontFamily: 'Orbitron, Arial, sans-serif',
      fontSize: 28,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: 0x00ffff,
        blur: 3,
        angle: Math.PI / 6,
        distance: 1,
      },
    });

    // タイマー表示（左上）
    this.timeText = new Text({ text: 'TIME', style: labelStyle });
    this.timeText.x = 10;
    this.timeText.y = 10;
    this.app.stage.addChild(this.timeText);
    
    this.timeValueText = new Text({ text: `${GAME_DURATION}`, style: valueStyle });
    this.timeValueText.anchor.set(0.5, 0.5); // 中心を基準点に
    // 初期位置を計算して保存（左上から開始位置 + テキスト中心までのオフセット）
    this.timeValueBaseX = 10 + 24; // 左マージン + おおよその半分の幅
    this.timeValueBaseY = 28 + 18; // 上マージン + おおよその半分の高さ
    this.timeValueText.x = this.timeValueBaseX;
    this.timeValueText.y = this.timeValueBaseY;
    this.app.stage.addChild(this.timeValueText);

    // スコア表示（右上）
    this.scoreText = new Text({ text: 'SCORE', style: labelStyle });
    this.scoreText.anchor.set(1, 0);
    this.scoreText.x = GAME_WIDTH - 15;
    this.scoreText.y = 10;
    this.app.stage.addChild(this.scoreText);
    
    this.scoreValueText = new Text({ text: '0', style: valueStyle });
    this.scoreValueText.anchor.set(1, 0);
    this.scoreValueText.x = GAME_WIDTH - 15;
    this.scoreValueText.y = 28;
    this.app.stage.addChild(this.scoreValueText);

    // タッチイベント
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', (e) => this.onTouchStart(e));
    this.app.stage.on('pointermove', (e) => this.onTouchMove(e));
    this.app.stage.on('pointerup', () => this.onTouchEnd());
    this.app.stage.on('pointerupoutside', () => this.onTouchEnd());
  }

  /**
   * タッチ開始イベントを処理する（スワイプ基準点として記録）
   */
  private onTouchStart(e: any) {
    if (this.scene !== 'game') return;
    // スワイプの開始位置を記録
    const pos = e.global;
    this.lastTouchX = pos.x;
    this.lastTouchY = pos.y;
  }

  /**
   * タッチ移動イベントを処理し、プレイヤーをスワイプ差分で移動する
   */
  private onTouchMove(e: any) {
    if (this.scene !== 'game') return;
    
    const pos = e.global;
    
    // 前回のタッチ位置がある場合、差分で飛行機を移動
    if (this.lastTouchX !== null && this.lastTouchY !== null) {
      const deltaX = pos.x - this.lastTouchX;
      const deltaY = pos.y - this.lastTouchY;
      
      this.player.x = Math.max(
        PLAYER_SIZE / 2,
        Math.min(GAME_WIDTH - PLAYER_SIZE / 2, this.player.x + deltaX)
      );
      this.player.y = Math.max(
        PLAYER_SIZE / 2,
        Math.min(GAME_HEIGHT - PLAYER_SIZE / 2, this.player.y + deltaY)
      );
    }
    
    // 現在の位置を次回の基準として記録
    this.lastTouchX = pos.x;
    this.lastTouchY = pos.y;
  }

  /**
   * タッチ終了イベントを処理し、スワイプ状態をリセットする
   */
  private onTouchEnd() {
    // スワイプ基準点をクリア
    this.lastTouchX = null;
    this.lastTouchY = null;
  }

  /**
   * ゲームを開始し、初期状態をリセットする
   */
  public startGame() {
    console.log('startGame called, initialized:', this.initialized);
    
    // すでにゲーム中の場合は何もしない
    if (this.scene === 'game') {
      console.log('Already in game scene');
      return;
    }

    console.log('Starting new game...');
    this.scene = 'game';
    this.score = 0;
    this.timeLeft = GAME_DURATION;
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.isInvincible = false;
    this.bullets = [];
    this.octopuses = [];
    this.gameStartTime = Date.now();
    this.lastBulletTime = 0;
    this.lastOctopusTime = 0;
    
    console.log('Game state reset:', {
      gameStartTime: this.gameStartTime,
      timeLeft: this.timeLeft,
      playerHealth: this.playerHealth
    });
    
    // 既存のグラフィックをクリア
    this.bulletGraphics.forEach(g => g.destroy());
    this.bulletGraphics.clear();
    this.octopusGraphics.forEach(g => g.destroy());
    this.octopusGraphics.clear();
    
  this.player.x = GAME_WIDTH / 2;
  this.player.y = GAME_HEIGHT - 100;
  this.player.alpha = 1;
    
    this.updateUI();
    
    // コールバックを呼ぶ
    if (this.onSceneChange) {
      this.onSceneChange('game');
    }
  }

  /**
   * スタート画面に戻り、ゲーム状態をクリーンアップする
   */
  public returnToStart() {
    // すでにスタート画面の場合は何もしない
    if (this.scene === 'start') {
      return;
    }

    this.scene = 'start';
    
    // ゲーム状態をリセット
    this.bullets = [];
    this.octopuses = [];
    this.bulletGraphics.forEach(g => g.destroy());
    this.bulletGraphics.clear();
    this.octopusGraphics.forEach(g => g.destroy());
    this.octopusGraphics.clear();
    
    // コールバックを呼ぶ
    if (this.onSceneChange) {
      this.onSceneChange('start');
    }
  }

  /**
   * 毎フレーム実行されるゲームループで、全てのゲームロジックを更新する
   * @param deltaTime - フレーム間の経過時間（60fps基準で1.0）
   */
  private gameLoop(deltaTime: number) {
    if (this.scene !== 'game') return;
    
    // ゲームが正しく開始されていない場合はスキップ
    if (this.gameStartTime === 0) {
      console.warn('gameLoop called but gameStartTime not set');
      return;
    }

    const now = Date.now();
    const elapsed = (now - this.gameStartTime) / 1000;
    this.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    
    // デバッグ: 最初のフレームで異常な値をチェック
    if (elapsed > GAME_DURATION + 1) {
      console.error('Time calculation error!', {
        now,
        gameStartTime: this.gameStartTime,
        elapsed,
        timeLeft: this.timeLeft
      });
    }

    // 背景をスクロール（デルタタイム補正）
    this.background.tilePosition.y += BACKGROUND_SCROLL_SPEED * deltaTime;

    // 無敵状態の点滅処理
    if (this.isInvincible) {
      const invincibleElapsed = now - this.invincibleStartTime;
      if (invincibleElapsed > PLAYER_INVINCIBLE_DURATION) {
        this.isInvincible = false;
        this.player.alpha = 1;
      } else {
        // 点滅エフェクト
        this.player.alpha = Math.sin(invincibleElapsed / 100) > 0 ? 0.3 : 1;
      }
    }

    // 弾を発射
    if (now - this.lastBulletTime > BULLET_INTERVAL) {
      this.shootBullet();
      this.lastBulletTime = now;
    }

    // タコをスポーン
    if (now - this.lastOctopusTime > OCTOPUS_SPAWN_INTERVAL) {
      this.spawnOctopus(elapsed);
      this.lastOctopusTime = now;
    }

    // 弾を更新
    this.updateBullets(deltaTime);

    // タコを更新
    this.updateOctopuses(deltaTime);

    // 衝突判定
    this.checkCollisions();

    // UIを更新
    this.updateUI();

    // ゲーム終了判定
    if (this.timeLeft <= 0 || this.playerHealth <= 0) {
      this.endGame();
    }
  }

  /**
   * プレイヤーの位置から新しい弾を発射する
   */
  private shootBullet() {
    const bullet: Bullet = {
      id: this.nextBulletId++,
      x: this.player.x,
      y: this.player.y - PLAYER_SIZE / 2,
    };
    this.bullets.push(bullet);

    const graphics = new Graphics();
    graphics.circle(0, 0, BULLET_SIZE);
    graphics.fill(0xffff00);
    graphics.x = bullet.x;
    graphics.y = bullet.y;
    this.gameContainer.addChild(graphics);
    this.bulletGraphics.set(bullet.id, graphics);
  }

  /**
   * 画面上部にランダムな位置と速度で新しいタコを生成する
   */
  private spawnOctopus(elapsed: number) {
    // 時間経過でタコの体力が増加（最大5）
    const maxHealth = Math.min(5, Math.floor(elapsed / 10) + 1);
    
    const octopus: Octopus = {
      id: this.nextOctopusId++,
      x: Math.random() * (GAME_WIDTH - OCTOPUS_SIZE) + OCTOPUS_SIZE / 2,
      y: -OCTOPUS_SIZE,
      speed: OCTOPUS_MIN_SPEED + Math.random() * (OCTOPUS_MAX_SPEED - OCTOPUS_MIN_SPEED),
      health: maxHealth,
      maxHealth,
      // 紹介１：タコのスプライト画像にランダムに色をつける
      color: OCTOPUS_COLORS[Math.floor(Math.random() * OCTOPUS_COLORS.length)],
      animFrame: 0,
      animTime: this.ANIM_FRAME_DURATION,
    };
    this.octopuses.push(octopus);

    const container = new Container();
    const sprite = this.createOctopusSprite(octopus);
    container.addChild(sprite);
    container.x = octopus.x;
    container.y = octopus.y;
    this.gameContainer.addChild(container);
    this.octopusGraphics.set(octopus.id, container);
  }

  /**
   * タコのスプライトを体力に応じたサイズで作成する
   */
  private createOctopusSprite(octopus: Octopus): Sprite {
    const sprite = new Sprite(this.octopusTextures[octopus.animFrame]);
    sprite.anchor.set(0.5);
    
    // 120px原寸をレティナ対応で60pxベースに、さらに体力でスケール
    const healthScale = octopus.health / octopus.maxHealth;
    const baseScale = 0.5; // 120px → 60px (OCTOPUS_SIZE相当)
    sprite.scale.set(baseScale * healthScale);
    
    // 紹介１：タコのスプライト画像にランダムに色をつける
    // tint で色変更
    sprite.tint = octopus.color;
    
    return sprite;
  }

  /**
   * 全ての弾の位置を更新し、画面外の弾を削除する
   * @param deltaTime - フレーム間の経過時間（60fps基準で1.0）
   */
  private updateBullets(deltaTime: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.y -= BULLET_SPEED * deltaTime;

      const graphics = this.bulletGraphics.get(bullet.id);
      if (graphics) {
        graphics.y = bullet.y;
      }

      // 画面外に出たら削除
      if (bullet.y < -BULLET_SIZE) {
        this.bullets.splice(i, 1);
        graphics?.destroy();
        this.bulletGraphics.delete(bullet.id);
      }
    }
  }

  /**
   * 全てのタコの位置を更新し、画面外のタコを削除する
   * @param deltaTime - フレーム間の経過時間（60fps基準で1.0）
   */
  private updateOctopuses(deltaTime: number) {
    const deltaMs = deltaTime * (1000 / 60); // deltaTimeをミリ秒に変換
    
    for (let i = this.octopuses.length - 1; i >= 0; i--) {
      const octopus = this.octopuses[i];
      octopus.y += octopus.speed * deltaTime;

      // 紹介２：タコのアニメーション
      // アニメーションフレーム更新
      octopus.animTime -= deltaMs;
      if (octopus.animTime <= 0) {
        octopus.animFrame = octopus.animFrame === 0 ? 1 : 0;
        octopus.animTime = this.ANIM_FRAME_DURATION;
        
        // スプライトのテクスチャを切り替え
        const container = this.octopusGraphics.get(octopus.id);
        if (container && container.children[0]) {
          const sprite = container.children[0] as Sprite;
          sprite.texture = this.octopusTextures[octopus.animFrame];
        }
      }

      const container = this.octopusGraphics.get(octopus.id);
      if (container) {
        container.y = octopus.y;
      }

      // 画面外に出たら削除
      if (octopus.y > GAME_HEIGHT + OCTOPUS_SIZE) {
        this.octopuses.splice(i, 1);
        container?.destroy();
        this.octopusGraphics.delete(octopus.id);
      }
    }
  }

  /**
   * 弾とタコ、プレイヤーとタコの衝突判定を行う
   */
  private checkCollisions() {
    // 弾とタコの衝突
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      
      for (let j = this.octopuses.length - 1; j >= 0; j--) {
        const octopus = this.octopuses[j];
        const dx = bullet.x - octopus.x;
        const dy = bullet.y - octopus.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = OCTOPUS_SIZE / 2 + BULLET_SIZE;
        if (distSq < radiusSum * radiusSum) {
          // 弾を削除
          this.bullets.splice(i, 1);
          const bulletGraphics = this.bulletGraphics.get(bullet.id);
          bulletGraphics?.destroy();
          this.bulletGraphics.delete(bullet.id);

          // タコの体力を減らす
          octopus.health--;
          
          if (octopus.health <= 0) {
            // タコを削除してスコア追加
            this.octopuses.splice(j, 1);
            const octopusContainer = this.octopusGraphics.get(octopus.id);
            octopusContainer?.destroy();
            this.octopusGraphics.delete(octopus.id);
            
            this.score += octopus.maxHealth * 10;
            this.onScoreChange?.(this.score);
          } else {
            // タコを小さく再描画（スプライト版）
            const container = this.octopusGraphics.get(octopus.id);
            if (container && container.children[0]) {
              const sprite = container.children[0] as Sprite;
              const healthScale = octopus.health / octopus.maxHealth;
              sprite.scale.set(0.5 * healthScale);
            }
          }
          
          break;
        }
      }
    }

    // プレイヤーとタコの衝突
    if (!this.isInvincible) {
      for (let i = this.octopuses.length - 1; i >= 0; i--) {
        const octopus = this.octopuses[i];
  const dx = this.player.x - octopus.x;
        const dy = this.player.y - octopus.y;
        const distSq = dx * dx + dy * dy;
        const radiusSum = PLAYER_SIZE / 2 + OCTOPUS_SIZE / 2;
        if (distSq < radiusSum * radiusSum) {
          // タコを削除
          this.octopuses.splice(i, 1);
          const container = this.octopusGraphics.get(octopus.id);
          container?.destroy();
          this.octopusGraphics.delete(octopus.id);

          // プレイヤーにダメージ
          this.playerHealth -= PLAYER_HEALTH_PER_HIT;
          this.isInvincible = true;
          this.invincibleStartTime = Date.now();
          this.onHealthChange?.(this.playerHealth);
        }
      }
    }
  }

  /**
   * 時間とスコアの表示を更新する
   */
  private updateUI() {
    const timeValue = Math.ceil(this.timeLeft);
    this.timeValueText.text = `${timeValue}`;
    this.scoreValueText.text = `${this.score}`;
    
    // 残り時間に応じて色を変更
    let color = 0x00ff00; // 緑（安全）
    let glowColor = 0x00ff00;
    
    if (timeValue <= 10) {
      color = 0xff0000; // 赤（危険）
      glowColor = 0xff0000;
      // 10秒以下でパルスエフェクト
      const pulse = Math.sin(Date.now() / 200) * 0.15 + 0.85;
      this.timeValueText.scale.set(pulse);
    } else if (timeValue <= 20) {
      color = 0xff8800; // オレンジ（警告）
      glowColor = 0xff8800;
      this.timeValueText.scale.set(1);
    } else if (timeValue <= 30) {
      color = 0xffff00; // 黄色（注意）
      glowColor = 0xffff00;
      this.timeValueText.scale.set(1);
    } else {
      this.timeValueText.scale.set(1);
    }
    
    // TIMEラベルと数値の色とグローを更新
    this.timeText.style.fill = color;
    this.timeValueText.style.fill = color;
    if (this.timeText.style.dropShadow) {
      this.timeText.style.dropShadow.color = glowColor;
    }
    if (this.timeValueText.style.dropShadow) {
      this.timeValueText.style.dropShadow.color = glowColor;
    }
    
    this.onTimeChange?.(timeValue);
  }

  /**
   * ゲームを終了してゲームオーバー画面に遷移する
   */
  private endGame() {
    console.log('endGame called!', {
      timeLeft: this.timeLeft,
      playerHealth: this.playerHealth,
      reason: this.timeLeft <= 0 ? 'Time up' : 'Health depleted'
    });
    this.scene = 'gameover';
    this.onSceneChange?.('gameover');
  }

  /**
   * 現在のスコアを取得する
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * シーン変更時のコールバック関数を設定する
   */
  public setOnSceneChange(callback: (scene: GameScene) => void) {
    this.onSceneChange = callback;
  }

  /**
   * スコア変更時のコールバック関数を設定する
   */
  public setOnScoreChange(callback: (score: number) => void) {
    this.onScoreChange = callback;
  }

  /**
   * 残り時間変更時のコールバック関数を設定する
   */
  public setOnTimeChange(callback: (time: number) => void) {
    this.onTimeChange = callback;
  }

  /**
   * 体力変更時のコールバック関数を設定する
   */
  public setOnHealthChange(callback: (health: number) => void) {
    this.onHealthChange = callback;
  }

  /**
   * PixiJSアプリケーションとすべてのリソースを破棄する
   */
  public destroy() {
    if (!this.initialized) {
      return;
    }

    try {
      // グラフィックスをクリーンアップ
      this.bulletGraphics.forEach(g => g?.destroy());
      this.bulletGraphics.clear();
      this.octopusGraphics.forEach(g => g?.destroy());
      this.octopusGraphics.clear();

      // プレイヤースプライト破棄
      if (this.player) {
        this.player.destroy();
      }

      // アプリケーションを破棄
      if (this.app) {
        this.app.destroy(true, { children: true });
      }
      
      this.initialized = false;
    } catch (error) {
      console.warn('Error during game cleanup:', error);
    }
  }
}
