import React from 'react';
import { useGameLogic } from '../hooks/useGameLogic';
import { GameSetup } from './GameSetup';
import { PlayerComponent } from './PlayerComponent';
import { GameControls } from './GameControls';
import { GamePhase } from '../types/game';
import { AIConfigSettings } from './AIConfig';

export const Game: React.FC = () => {
  const {
    gameState,
    initializeGame,
    makePrediction,
    respondToChallenge,
    makeBettingAction,
    revealAndSettle,
    startNewRound,
  } = useGameLogic();

  const humanPlayer = gameState.players.find(p => !p.isAI);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  const canMakePrediction = Boolean(gameState.phase === GamePhase.PREDICTION && 
                           humanPlayer && 
                           currentPlayer?.id === humanPlayer.id);

  const canRespondToChallenge = Boolean(gameState.phase === GamePhase.CHALLENGE && 
                               humanPlayer && 
                               currentPlayer?.id === humanPlayer.id);

  const canMakeBet = Boolean(gameState.phase === GamePhase.BETTING && 
                    humanPlayer && 
                    gameState.bettingRound?.currentPlayerIndex === gameState.players.findIndex(p => p.id === humanPlayer.id));

  if (gameState.phase === GamePhase.SETUP) {
    return <GameSetup onStartGame={(playerName, teamSetup, aiConfig) => initializeGame(playerName, teamSetup, aiConfig)} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 遊戲標題和狀態 */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">挑戰並下注遊戲</h1>
          <div className="text-lg text-gray-600">
            回合 {gameState.round} | 
            階段: {getPhaseDisplayName(gameState.phase)} |
            當前玩家: {currentPlayer?.name || '無'}
          </div>
        </div>

        {/* 玩家區域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {gameState.players.map((player) => (
            <PlayerComponent
              key={player.id}
              player={player}
              isCurrentPlayer={player.id === currentPlayer?.id}
              isHumanPlayer={!player.isAI}
              showCards={gameState.showAllCards || !player.isAI || (humanPlayer?.teamMembers.includes(player.id) ?? false)}
              isLatestAction={gameState.lastActionPlayerId === player.id}
              currentPrediction={gameState.currentPrediction}
            />
          ))}
        </div>

        {/* 當前預測顯示 */}
        {gameState.currentPrediction && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            {/* <h3 className="font-semibold text-yellow-800 mb-2"></h3> */}
            <p className="text-yellow-700">
              <b>當前預測:   </b>
              {gameState.players.find(p => p.id === gameState.currentPrediction!.playerId)?.name} 
              預測 {gameState.currentPrediction.color} 顏色有 {gameState.currentPrediction.count} 張，
              下注 {gameState.currentPrediction.bet.chips} 籌碼 + {gameState.currentPrediction.bet.holes} 牌孔
            </p>
          </div>
        )}

        {/* 下注狀態顯示 */}
        {gameState.bettingRound && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            {/* <h3 className="font-semibold text-red-800 mb-2">下注階段:</h3> */}
            <p className="text-red-700">
              <b>下注階段:   </b>
              累計獎池: {(() => {
                const totalFromBets = Array.from(gameState.bettingRound.playerBets.values()).reduce(
                  (total, bet) => ({ chips: total.chips + bet.chips, holes: total.holes + bet.holes }),
                  { chips: 0, holes: 0 }
                );
                const originalBet = gameState.currentPrediction?.bet || { chips: 0, holes: 0 };
                return `${totalFromBets.chips + originalBet.chips} 籌碼 + ${totalFromBets.holes + originalBet.holes} 牌孔`;
              })()}
            </p>
          </div>
        )}

        {/* 遊戲控制 */}
        <div className="mb-6">
          <GameControls
            phase={gameState.phase}
            currentPrediction={gameState.currentPrediction}
            bettingRound={gameState.bettingRound} // 添加 bettingRound 參數
            canMakePrediction={canMakePrediction}
            canRespondToChallenge={canRespondToChallenge}
            canMakeBet={canMakeBet}
            onMakePrediction={makePrediction}
            onRespondToChallenge={respondToChallenge}
            onMakeBettingAction={makeBettingAction}
            onReveal={revealAndSettle}
            onStartNewRound={startNewRound}
          />
        </div>

        {/* 遊戲日誌 */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <h3 className="font-semibold mb-3">遊戲日誌</h3>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {gameState.gameLog.map((log, index) => (
              <div key={index} className="text-sm text-gray-600">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function getPhaseDisplayName(phase: GamePhase): string {
  const phaseNames = {
    [GamePhase.SETUP]: '設置',
    [GamePhase.DEALING]: '發牌',
    [GamePhase.PREDICTION]: '預測',
    [GamePhase.CHALLENGE]: '挑戰',
    [GamePhase.BETTING]: '下注',
    [GamePhase.REVEAL]: '揭示',
    [GamePhase.ROUND_END]: '回合結束',
    [GamePhase.GAME_END]: '遊戲結束',
  };
  return phaseNames[phase] || '未知';
}
