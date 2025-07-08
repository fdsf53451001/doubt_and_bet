import React from 'react';
import { Card, CardColor } from '../types/game';

interface CardComponentProps {
  card: Card;
  size?: 'small' | 'medium' | 'large';
  isVisible?: boolean;
}

const colorStyles: Record<CardColor, string> = {
  [CardColor.RED]: 'bg-red-500 text-white',
  [CardColor.YELLOW]: 'bg-yellow-400 text-black',
  [CardColor.GREEN]: 'bg-green-500 text-white',
  [CardColor.BLUE]: 'bg-blue-500 text-white',
  [CardColor.PURPLE]: 'bg-purple-500 text-white',
  [CardColor.RAINBOW]: 'bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 via-purple-400 to-pink-400 text-white',
};

const sizeStyles = {
  small: 'w-12 h-16 text-xs',
  medium: 'w-16 h-24 text-sm',
  large: 'w-20 h-28 text-base',
};

const colorNames: Record<CardColor, string> = {
  [CardColor.RED]: '紅',
  [CardColor.YELLOW]: '黃',
  [CardColor.GREEN]: '綠',
  [CardColor.BLUE]: '藍',
  [CardColor.PURPLE]: '紫',
  [CardColor.RAINBOW]: '彩虹',
};

export const CardComponent: React.FC<CardComponentProps> = ({ 
  card, 
  size = 'medium', 
  isVisible = true 
}) => {
  if (!isVisible) {
    return (
      <div className={`${sizeStyles[size]} bg-gray-600 rounded-lg border-2 border-gray-400 flex items-center justify-center`}>
        <div className="text-gray-300">?</div>
      </div>
    );
  }

  return (
    <div className={`${sizeStyles[size]} ${colorStyles[card.color]} rounded-lg border-2 border-gray-300 shadow-md flex flex-col items-center justify-center font-bold`}>
      <div>{colorNames[card.color]}</div>
    </div>
  );
};
