import React from 'react';
import './HealthBar.css';

interface HealthBarProps {
  health: number;
  maxHealth: number;
}

export const HealthBar: React.FC<HealthBarProps> = ({ health, maxHealth }) => {
  const percentage = (health / maxHealth) * 100;
  const isLow = percentage <= 25;

  return (
    <div className="health-bar">
      <div 
        className="health-bar-wrapper"
        style={{ width: `${percentage}%` }}
      >
        <div className={`health-bar-gradient ${isLow ? 'low' : ''}`} />
      </div>
    </div>
  );
};
