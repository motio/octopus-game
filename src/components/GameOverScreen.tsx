import React from 'react';
import './GameOverScreen.css';

interface GameOverScreenProps {
  score: number;
  onRestart: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ score, onRestart }) => {
  return (
    <div className="gameover-screen">
      <h1>GAME OVER</h1>
      <div className="score-display">
        <div className="score-label">FINAL SCORE</div>
        <div className="score-value">{score}</div>
      </div>
      <button className="restart-button" onClick={onRestart}>
        PLAY AGAIN
      </button>
    </div>
  );
};
