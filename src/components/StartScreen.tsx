import React from 'react';
import './StartScreen.css';

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  return (
    <div className="start-screen">
      <h1>🐙<br/>OCTOPUS SHOOTER<br/>🚀</h1>
      <div className="subtitle">タコ異星人を撃退せよ！</div>
      <div className="instructions">
        <p>60秒間で多くのタコを倒そう！</p>
        <p>画面をタップで操作</p>
        <p>体力がなくなるとゲームオーバー</p>
      </div>
      <button className="start-button" onClick={onStart}>
        START GAME
      </button>
    </div>
  );
};
