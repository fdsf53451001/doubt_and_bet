import React from 'react';
import { Player, Prediction } from '../types/game';
import { CardComponent } from './CardComponent';

interface PlayerComponentProps {
  player: Player;
  isCurrentPlayer?: boolean;
  isHumanPlayer?: boolean;
  showCards?: boolean;
  isLatestAction?: boolean; // 是否為最新動作的玩家
  currentPrediction?: Prediction | null; // 當前預測信息
}

export const PlayerComponent: React.FC<PlayerComponentProps> = ({
  player,
  isCurrentPlayer = false,
  isHumanPlayer = false,
  showCards = false,
  isLatestAction = false,
  currentPrediction = null,
}) => {
  return (
    <div className={`p-4 rounded-lg border-2 ${
      isCurrentPlayer 
        ? 'border-blue-500 bg-blue-50' 
        : 'border-gray-300 bg-white'
    } ${player.isEliminated ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-lg">{player.name}</h3>
          {isHumanPlayer && <span className="text-blue-600 text-sm">(你)</span>}
          {player.isEliminated && <span className="text-red-600 text-sm">(淘汰)</span>}
        </div>
        <div className="text-sm text-gray-600">
          位置: {player.position + 1}
        </div>
      </div>
      
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
          <span className="text-sm">籌碼: {player.chips}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
          <span className="text-sm">牌孔: {player.holes}</span>
        </div>
      </div>

      {player.teamMembers.length > 0 && (
        <div className="mb-3">
          <span className="text-sm text-green-600">
            合作夥伴: {player.teamMembers.join(', ')}
          </span>
        </div>
      )}

      {/* 顯示玩家的最後動作（包含預測信息） */}
      {player.lastAction && (
        <div className={`mb-3 p-2 rounded text-sm ${
          isLatestAction 
            ? 'bg-orange-100 border border-orange-300 text-orange-800' 
            : 'bg-gray-100 text-gray-600'
        }`}>
          <div>{player.lastAction.description}</div>
          {/* 如果當前預測是這個玩家做的，顯示預測詳細信息 */}
          {currentPrediction && currentPrediction.playerId === player.id && (
            <div className="text-xs mt-1">
              下注 {currentPrediction.bet.chips} 籌碼 + {currentPrediction.bet.holes} 牌孔
            </div>
          )}
          {isLatestAction && (
            <div className="text-xs mt-1 font-medium">最新動作</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {player.hand && player.hand.length > 0 ? (
          player.hand.map((card, index) => (
            <CardComponent
              key={`${card.id}-${index}`}
              card={card}
              size="small"
              isVisible={showCards || isHumanPlayer}
            />
          ))
        ) : (
          // 如果沒有手牌，但玩家有牌孔，顯示背面卡牌
          player.holes > 0 ? (
            Array.from({ length: player.holes }, (_, index) => (
              <CardComponent
                key={`empty-${player.id}-${index}`}
                card={{ id: `empty-${index}`, color: 'red' as any }}
                size="small"
                isVisible={false} // 強制顯示為背面
              />
            ))
          ) : (
            <div className="text-sm text-gray-500 italic">無手牌</div>
          )
        )}
      </div>
    </div>
  );
};
