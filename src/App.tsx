import { useEffect, useRef, useState } from 'react';
import { Game } from './game/Game';
import { StartScreen } from './components/StartScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { HealthBar } from './components/HealthBar';
import { PLAYER_MAX_HEALTH } from './constants/game';
import type { GameScene } from './types/game';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const initializedRef = useRef(false);
  const [scene, setScene] = useState<GameScene>('start');
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(PLAYER_MAX_HEALTH);

  useEffect(() => {
    // React Strict ModeやHMRでの二重初期化を防ぐ
    if (initializedRef.current && gameRef.current) {
      console.log('Already initialized, skipping...');
      return;
    }

    const initGame = async () => {
      try {
        if (canvasRef.current && !gameRef.current) {
          console.log('Initializing game...');
          initializedRef.current = true;
          const game = new Game(canvasRef.current);
          gameRef.current = game;

          // ゲームの初期化を待つ
          await new Promise(resolve => setTimeout(resolve, 100));

          console.log('Setting up callbacks...');
          game.setOnSceneChange((newScene) => {
            console.log('Scene changed to:', newScene);
            setScene(newScene);
            if (newScene === 'gameover') {
              setScore(game.getScore());
            }
          });

          game.setOnScoreChange(setScore);
          game.setOnHealthChange(setHealth);
          
          console.log('Game initialization in App complete');
        }
      } catch (error) {
        console.error('Failed to initialize game in App:', error);
        initializedRef.current = false;
      }
    };

    initGame();

    return () => {
      // HMR時はクリーンアップをスキップ（開発環境のみ）
      if (import.meta.env.DEV && import.meta.hot) {
        console.log('HMR detected, skipping cleanup');
        return;
      }
      
      console.log('Cleaning up game...');
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  const handleStart = () => {
    console.log('handleStart called, gameRef:', gameRef.current);
    if (gameRef.current) {
      setHealth(PLAYER_MAX_HEALTH);
      setScore(0);
      gameRef.current.startGame();
    } else {
      console.error('Game reference is null!');
    }
  };

  const handleRestart = () => {
    console.log('handleRestart called');
    if (gameRef.current) {
      gameRef.current.returnToStart();
    }
  };

  return (
    <div className="app">
      {scene === 'start' && <StartScreen onStart={handleStart} />}
      {scene === 'gameover' && <GameOverScreen score={score} onRestart={handleRestart} />}
      
      <canvas 
        ref={canvasRef} 
        className={scene === 'game' ? 'game-canvas active' : 'game-canvas'}
      />
      
      {scene === 'game' && <HealthBar health={health} maxHealth={PLAYER_MAX_HEALTH} />}
    </div>
  );
}

export default App;
