import React, { useState } from 'react';
import { CardColor, Bet, ChallengeResponse, BettingAction } from '../types/game';
import { calculateBetValue, isBetHigherOrEqual } from '../utils/gameLogic';

interface GameControlsProps {
  phase: string;
  currentPrediction: any;
  bettingRound: any; // 添加下注回合信息
  canMakePrediction: boolean;
  canRespondToChallenge: boolean;
  canMakeBet: boolean;
  onMakePrediction: (color: CardColor, count: number, bet: Bet) => void;
  onRespondToChallenge: (response: ChallengeResponse) => void;
  onMakeBettingAction: (action: BettingAction, bet?: Bet) => void;
  onReveal: () => void;
  onStartNewRound: () => void;
}

const colorOptions = [
  { value: CardColor.RED, label: '紅色' },
  { value: CardColor.YELLOW, label: '黃色' },
  { value: CardColor.GREEN, label: '綠色' },
  { value: CardColor.BLUE, label: '藍色' },
  { value: CardColor.PURPLE, label: '紫色' },
  { value: CardColor.RAINBOW, label: '彩虹' },
];

export const GameControls: React.FC<GameControlsProps> = ({
  phase,
  currentPrediction,
  bettingRound, // 添加 bettingRound 參數
  canMakePrediction,
  canRespondToChallenge,
  canMakeBet,
  onMakePrediction,
  onRespondToChallenge,
  onMakeBettingAction,
  onReveal,
  onStartNewRound,
}) => {
  const [selectedColor, setSelectedColor] = useState<CardColor>(CardColor.RED);
  const [predictCount, setPredictCount] = useState(1);
  const [betChips, setBetChips] = useState(1);
  const [betHoles, setBetHoles] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>(''); // 添加錯誤訊息狀態

  const handleMakePrediction = () => {
    onMakePrediction(selectedColor, predictCount, { chips: betChips, holes: betHoles });
  };

  const handleRaise = () => {
    const newBet = { chips: betChips, holes: betHoles };
    
    // 驗證加注金額
    if (bettingRound && bettingRound.totalBet) {
      const currentBet = bettingRound.totalBet;
      
      // 檢查是否首次下注
      const isFirstBet = bettingRound.playerBets.size === 0;
      
      if (isFirstBet) {
        // 首次下注，需要至少匹配最低下注
        const minimumBet = bettingRound.minimumBet;
        if (!isBetHigherOrEqual(newBet, minimumBet)) {
          setErrorMessage(`下注金額必須至少 ${minimumBet.chips} 籌碼 + ${minimumBet.holes} 牌孔（總價值 ${calculateBetValue(minimumBet)}）`);
          return;
        }
      } else {
        // 加注必須比當前下注更高
        if (!isBetHigherOrEqual(newBet, currentBet) || calculateBetValue(newBet) <= calculateBetValue(currentBet)) {
          setErrorMessage(`加注必須大於當前下注 ${currentBet.chips} 籌碼 + ${currentBet.holes} 牌孔（總價值 ${calculateBetValue(currentBet)}）`);
          return;
        }
      }
    }
    
    setErrorMessage(''); // 清除錯誤訊息
    onMakeBettingAction(BettingAction.RAISE, newBet);
  };

  const handleCall = () => {
    // 跟注使用當前總下注金額
    if (bettingRound && bettingRound.totalBet) {
      const currentBet = bettingRound.totalBet;
      onMakeBettingAction(BettingAction.CALL, currentBet);
    } else {
      onMakeBettingAction(BettingAction.CALL);
    }
  };

  if (phase === 'setup') {
    return <div className="text-center text-gray-600">遊戲設置中...</div>;
  }

  if (phase === 'game_end') {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">遊戲結束！</h2>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          重新開始
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">遊戲控制</h3>

      {canMakePrediction && (
        <div className="space-y-4">
          <h4 className="font-semibold">做出預測</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">選擇顏色:</label>
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value as CardColor)}
                className="w-full p-2 border rounded-lg"
              >
                {colorOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">預測數量:</label>
              <input
                type="number"
                min={currentPrediction ? currentPrediction.count + 1 : 1}
                value={predictCount}
                onChange={(e) => setPredictCount(Math.max(Number(e.target.value), currentPrediction ? currentPrediction.count + 1 : 1))}
                className="w-full p-2 border rounded-lg"
              />
              {currentPrediction && (
                <p className="text-xs text-gray-600 mt-1">
                  必須大於之前的預測: {currentPrediction.count}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">下注籌碼:</label>
              <input
                type="number"
                min={0}
                value={betChips}
                onChange={(e) => setBetChips(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">下注牌孔:</label>
              <input
                type="number"
                min={0}
                value={betHoles}
                onChange={(e) => setBetHoles(Number(e.target.value))}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <button
            onClick={handleMakePrediction}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            確認預測
          </button>
        </div>
      )}

      {canRespondToChallenge && currentPrediction && (
        <div className="space-y-4">
          <h4 className="font-semibold">回應挑戰</h4>
          <div className="p-3 bg-gray-100 rounded-lg">
            <p>當前預測: {currentPrediction.color} 顏色 {currentPrediction.count} 張</p>
            <p>下注: {currentPrediction.bet.chips} 籌碼 + {currentPrediction.bet.holes} 牌孔</p>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => onRespondToChallenge(ChallengeResponse.ACCEPT)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              接受 (需做出更高預測)
            </button>
            <button
              onClick={() => onRespondToChallenge(ChallengeResponse.CHALLENGE)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              挑戰
            </button>
          </div>
        </div>
      )}

      {canMakeBet && (
        <div className="space-y-4">
          <h4 className="font-semibold">下注階段</h4>
          
          {/* 顯示當前下注信息 */}
          {bettingRound && bettingRound.totalBet && (
            <div className="p-3 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-600">
                當前下注：{bettingRound.totalBet.chips} 籌碼 + {bettingRound.totalBet.holes} 牌孔 
                （總價值：{calculateBetValue(bettingRound.totalBet)}）
              </p>
              {bettingRound.playerBets.size === 0 && bettingRound.minimumBet && (
                <p className="text-sm text-gray-600">
                  最低下注：{bettingRound.minimumBet.chips} 籌碼 + {bettingRound.minimumBet.holes} 牌孔
                  （總價值：{calculateBetValue(bettingRound.minimumBet)}）
                </p>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">籌碼:</label>
              <input
                type="number"
                min={0}
                value={betChips}
                onChange={(e) => {
                  setBetChips(Number(e.target.value));
                  setErrorMessage(''); // 清除錯誤訊息
                }}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">牌孔:</label>
              <input
                type="number"
                min={0}
                value={betHoles}
                onChange={(e) => {
                  setBetHoles(Number(e.target.value));
                  setErrorMessage(''); // 清除錯誤訊息
                }}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          {/* 錯誤訊息顯示 */}
          {errorMessage && (
            <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRaise}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              加注
            </button>
            <button
              onClick={handleCall}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              跟注
            </button>
            <button
              onClick={() => onMakeBettingAction(BettingAction.FOLD)}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              棄牌
            </button>
          </div>
        </div>
      )}

      {phase === 'reveal' && (
        <button
          onClick={onReveal}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          揭示結果
        </button>
      )}

      {phase === 'round_end' && (
        <button
          onClick={onStartNewRound}
          className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          開始下一回合
        </button>
      )}
    </div>
  );
};
