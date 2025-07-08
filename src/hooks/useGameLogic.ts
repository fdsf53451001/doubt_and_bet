import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  GameState, 
  Player, 
  GamePhase, 
  Prediction, 
  ChallengeResponse, 
  BettingAction, 
  Bet,
  GAME_CONFIG,
  CardColor,
  PlayerAction,
  PlayerActionType
} from '../types/game';
import { 
  createDeck, 
  dealCards, 
  validatePrediction, 
  canAffordBet, 
  combineBets,
  shufflePlayerPositions,
  applyRoundPenalty,
  isGameOver,
  getNextPlayerIndex,
  getVisibleCards,
  countColorCards,
  calculateBetValue,
  isBetHigherOrEqual
} from '../utils/gameLogic';
import { AIEngine } from '../utils/aiEngine';
import { AIConfigSettings } from '../components/AIConfig';

export const useGameLogic = () => {
  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.SETUP,
    round: 1,
    currentPlayerIndex: 0,
    players: [],
    deck: [],
    currentPrediction: null,
    bettingRound: null,
    winner: null,
    lastRoundLoser: null,
    lastActionPlayerId: undefined,
    gameLog: [],
    showAllCards: false,
  });

  const [aiEngine, setAiEngine] = useState(() => new AIEngine());
  const aiProcessingRef = useRef(false); // 使用 useRef 替代 useState

  // 創建玩家動作記錄的輔助函數
  const createPlayerAction = useCallback((
    type: PlayerActionType, 
    description: string, 
    round: number
  ): PlayerAction => ({
    type,
    description,
    round,
    timestamp: Date.now(),
  }), []);

  // 更新玩家動作的輔助函數
  const updatePlayerAction = useCallback((
    players: Player[], 
    playerId: string, 
    action: PlayerAction
  ): Player[] => {
    return players.map(player => {
      if (player.id === playerId) {
        return { ...player, lastAction: action };
      }
      // 清除其他玩家的 isLatest 標記
      return { 
        ...player, 
        lastAction: player.lastAction ? { ...player.lastAction, isLatest: false } : undefined 
      };
    });
  }, []);

  // 初始化遊戲
  const initializeGame = useCallback((playerName: string, teamSetup: Record<string, string[]>, aiConfig?: AIConfigSettings) => {
    // 如果提供了AI配置，創建新的AI引擎實例
    if (aiConfig) {
      const newAiEngine = new AIEngine({
        apiKey: aiConfig.apiKey,
        baseUrl: aiConfig.endpoint,
        model: aiConfig.model
      });
      setAiEngine(newAiEngine);
    }

    const players: Player[] = [];
    
    // 創建人類玩家
    players.push({
      id: 'player-0',
      name: playerName,
      isAI: false,
      holes: GAME_CONFIG.INITIAL_HOLES,
      chips: GAME_CONFIG.INITIAL_CHIPS,
      hand: [],
      isEliminated: false,
      position: 0,
      teamMembers: [],
    });

    // 創建AI玩家
    for (let i = 1; i < GAME_CONFIG.PLAYERS_COUNT; i++) {
      players.push({
        id: `player-${i}`,
        name: `AI玩家${i}`,
        isAI: true,
        holes: GAME_CONFIG.INITIAL_HOLES,
        chips: GAME_CONFIG.INITIAL_CHIPS,
        hand: [],
        isEliminated: false,
        position: i,
        teamMembers: [],
      });
    }

    // 建立相互的合作夥伴關係
    // 首先收集所有的合作組
    const teams = new Map<string, Set<string>>();
    
    Object.entries(teamSetup).forEach(([playerId, teammates]) => {
      if (teammates.length > 0) {
        // 創建一個包含當前玩家和所有合作夥伴的完整組
        const fullTeam = new Set([playerId, ...teammates]);
        
        // 為這個組中的每個成員設置相同的隊友列表
        fullTeam.forEach(memberId => {
          if (!teams.has(memberId)) {
            teams.set(memberId, new Set());
          }
          // 將其他所有成員加入這個玩家的隊友列表
          fullTeam.forEach(otherMemberId => {
            if (otherMemberId !== memberId) {
              teams.get(memberId)!.add(otherMemberId);
            }
          });
        });
      }
    });
    
    // 將收集到的隊友關係應用到玩家對象
    players.forEach(player => {
      const playerTeam = teams.get(player.id);
      if (playerTeam) {
        player.teamMembers = Array.from(playerTeam);
      }
    });

    // 輸出合作夥伴關係以供調試
    console.log('合作夥伴關係建立完成:');
    players.forEach(player => {
      if (player.teamMembers.length > 0) {
        console.log(`${player.name} (${player.id}) 的合作夥伴: ${player.teamMembers.join(', ')}`);
      }
    });

    const deck = createDeck();
    const { updatedDeck, updatedPlayers } = dealCards(deck, players);

    setGameState({
      phase: GamePhase.DEALING,
      round: 1,
      currentPlayerIndex: 0,
      players: updatedPlayers,
      deck: updatedDeck,
      currentPrediction: null,
      bettingRound: null,
      winner: null,
      lastRoundLoser: null,
      lastActionPlayerId: undefined,
      gameLog: [`遊戲開始！回合 1`],
      showAllCards: false,
    });

    // 開始第一輪預測
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.PREDICTION,
        gameLog: [...prev.gameLog, `${updatedPlayers[0].name} 開始預測`],
      }));
    }, 1000);
  }, []);

  // 玩家做出預測
  const makePrediction = useCallback((color: CardColor, count: number, bet: Bet) => {
    setGameState(prev => {
      const currentPlayer = prev.players[prev.currentPlayerIndex];
      
      if (!canAffordBet(currentPlayer, bet)) {
        return prev; // 無法負擔下注
      }

      // 檢查是否需要比之前的預測更高
      if (prev.currentPrediction && count <= prev.currentPrediction.count) {
        // 如果存在之前的預測，新預測必須更高
        return {
          ...prev,
          gameLog: [...prev.gameLog, `預測失敗：數量必須大於 ${prev.currentPrediction.count}`],
        };
      }

      const prediction: Prediction = {
        playerId: currentPlayer.id,
        color,
        count,
        bet,
      };

      const nextPlayerIndex = getNextPlayerIndex(prev.currentPlayerIndex, prev.players);

      // 創建動作記錄
      const action = createPlayerAction(
        PlayerActionType.PREDICTION,
        `預測 ${color} 顏色有 ${count} 張`,
        prev.round
      );
      action.isLatest = true;

      // 更新玩家動作
      const updatedPlayers = updatePlayerAction(prev.players, currentPlayer.id, action);

      return {
        ...prev,
        phase: GamePhase.CHALLENGE,
        currentPrediction: prediction,
        currentPlayerIndex: nextPlayerIndex,
        players: updatedPlayers,
        lastActionPlayerId: currentPlayer.id,
        gameLog: [...prev.gameLog, 
          `${currentPlayer.name} 預測 ${color} 顏色有 ${count} 張，下注 ${bet.chips} 籌碼 + ${bet.holes} 牌孔`
        ],
      };
    });
  }, [createPlayerAction, updatePlayerAction]);

  // 回應挑戰
  const respondToChallenge = useCallback((response: ChallengeResponse) => {
    setGameState(prev => {
      const currentPlayer = prev.players[prev.currentPlayerIndex];
      
      if (response === ChallengeResponse.ACCEPT) {
        // 接受預測，需要做出更高的預測，保留當前預測作為最低基準
        
        // 創建動作記錄
        const action = createPlayerAction(
          PlayerActionType.ACCEPT_CHALLENGE,
          '接受挑戰',
          prev.round
        );
        action.isLatest = true;

        // 更新玩家動作
        const updatedPlayers = updatePlayerAction(prev.players, currentPlayer.id, action);

        return {
          ...prev,
          phase: GamePhase.PREDICTION,
          players: updatedPlayers,
          lastActionPlayerId: currentPlayer.id,
          // 不清除 currentPrediction，讓它作為最低基準
          gameLog: [...prev.gameLog, `${currentPlayer.name} 接受挑戰，需要做出更高的預測`],
        };
      } else {
        // 挑戰預測，進入下注階段
        if (!prev.currentPrediction) return prev;
        
        // 挑戰者需要先下注，從原始預測的下注金額開始
        const initialBet = prev.currentPrediction.bet;
        const bettingRound = {
          currentPlayerIndex: prev.currentPlayerIndex, // 挑戰者先下注
          totalBet: { chips: 0, holes: 0 }, // 重新開始計算下注
          playerBets: new Map(), // 清空下注記錄
          lastRaisePlayer: null,
          challengerId: currentPlayer.id, // 記錄挑戰者
          predictorId: prev.currentPrediction.playerId, // 記錄預測者
          minimumBet: initialBet, // 最低下注金額（預測者的原始下注）
        };

        // 創建動作記錄
        const action = createPlayerAction(
          PlayerActionType.CHALLENGE_PREDICTION,
          '挑戰預測',
          prev.round
        );
        action.isLatest = true;

        // 更新玩家動作
        const updatedPlayers = updatePlayerAction(prev.players, currentPlayer.id, action);

        return {
          ...prev,
          phase: GamePhase.BETTING,
          bettingRound,
          players: updatedPlayers,
          lastActionPlayerId: currentPlayer.id,
          gameLog: [...prev.gameLog, `${currentPlayer.name} 挑戰預測，進入下注階段`],
        };
      }
    });
  }, [createPlayerAction, updatePlayerAction]);

  // 下注動作
  const makeBettingAction = useCallback((action: BettingAction, bet?: Bet) => {
    setGameState(prev => {
      if (!prev.bettingRound || !prev.currentPrediction) return prev;

      const currentPlayer = prev.players[prev.bettingRound.currentPlayerIndex];
      let updatedBettingRound = { ...prev.bettingRound };
      let newPhase = prev.phase;
      let gameLog = [...prev.gameLog];
      let playerAction: PlayerAction | null = null;

      if (action === BettingAction.FOLD) {
        // 棄牌，對手獲勝
        gameLog.push(`${currentPlayer.name} 棄牌`);
        newPhase = GamePhase.ROUND_END;
        
        // 創建動作記錄
        playerAction = createPlayerAction(
          PlayerActionType.BET_FOLD,
          '棄牌',
          prev.round
        );
        
        // 確定獲勝者：如果挑戰者棄牌，預測者獲勝；如果預測者棄牌，挑戰者獲勝
        const winnerId = currentPlayer.id === updatedBettingRound.challengerId ? 
          updatedBettingRound.predictorId : updatedBettingRound.challengerId;
        
        // 直接轉移資源，棄牌者失去之前的下注
        const updatedPlayers = updatePlayerAction(
          prev.players.map(player => {
            if (player.id === winnerId) {
              return {
                ...player,
                chips: player.chips + updatedBettingRound.totalBet.chips,
                holes: Math.min(player.holes + updatedBettingRound.totalBet.holes, GAME_CONFIG.MAX_HOLES),
              };
            }
            if (player.id === currentPlayer.id) {
              const betAmount = updatedBettingRound.playerBets.get(player.id) || { chips: 0, holes: 0 };
              return {
                ...player,
                chips: Math.max(0, player.chips - betAmount.chips),
                holes: Math.max(1, player.holes - betAmount.holes),
              };
            }
            return player;
          }),
          currentPlayer.id,
          { ...playerAction, isLatest: true }
        );
        
        return {
          ...prev,
          phase: newPhase,
          players: updatedPlayers,
          bettingRound: null,
          currentPrediction: null,
          lastActionPlayerId: currentPlayer.id,
          gameLog,
        };
        
      } else if (updatedBettingRound.playerBets.size === 0) {
        // 挑戰者的第一次下注，必須至少匹配預測者的原始下注
        const minBet = updatedBettingRound.minimumBet;
        
        if (action === BettingAction.CALL) {
          // 挑戰者跟注最低金額
          updatedBettingRound.playerBets.set(currentPlayer.id, minBet);
          updatedBettingRound.totalBet = minBet;
          gameLog.push(`${currentPlayer.name} 下注 ${minBet.chips} 籌碼 + ${minBet.holes} 牌孔`);
          
          // 創建動作記錄
          playerAction = createPlayerAction(
            PlayerActionType.BET_CALL,
            `跟注 ${minBet.chips} 籌碼 + ${minBet.holes} 牌孔`,
            prev.round
          );
          
          // 切換到預測者
          const predictorIndex = prev.players.findIndex(p => p.id === updatedBettingRound.predictorId);
          updatedBettingRound.currentPlayerIndex = predictorIndex;
          
        } else if (action === BettingAction.RAISE && bet) {
          // 挑戰者加注
          if (isBetHigherOrEqual(bet, minBet)) {
            updatedBettingRound.playerBets.set(currentPlayer.id, bet);
            updatedBettingRound.totalBet = bet;
            updatedBettingRound.lastRaisePlayer = currentPlayer.id;
            gameLog.push(`${currentPlayer.name} 加注至 ${bet.chips} 籌碼 + ${bet.holes} 牌孔`);
            
            // 創建動作記錄
            playerAction = createPlayerAction(
              PlayerActionType.BET_RAISE,
              `加注至 ${bet.chips} 籌碼 + ${bet.holes} 牌孔`,
              prev.round
            );
            
            // 切換到預測者
            const predictorIndex = prev.players.findIndex(p => p.id === updatedBettingRound.predictorId);
            updatedBettingRound.currentPlayerIndex = predictorIndex;
          }
        }
      } else if (action === BettingAction.CALL && bet) {
        // 跟注，結束下注階段，進入揭示階段
        updatedBettingRound.playerBets.set(currentPlayer.id, bet);
        gameLog.push(`${currentPlayer.name} 跟注 ${bet.chips} 籌碼 + ${bet.holes} 牌孔`);
        newPhase = GamePhase.REVEAL;
        
        // 創建動作記錄
        playerAction = createPlayerAction(
          PlayerActionType.BET_CALL,
          `跟注 ${bet.chips} 籌碼 + ${bet.holes} 牌孔`,
          prev.round
        );
        
      } else if (action === BettingAction.RAISE && bet) {
        // 加注，切換到對手
        updatedBettingRound.playerBets.set(currentPlayer.id, bet);
        updatedBettingRound.totalBet = bet; // 新的總下注金額
        updatedBettingRound.lastRaisePlayer = currentPlayer.id;
        gameLog.push(`${currentPlayer.name} 加注至 ${bet.chips} 籌碼 + ${bet.holes} 牌孔`);
        
        // 創建動作記錄
        playerAction = createPlayerAction(
          PlayerActionType.BET_RAISE,
          `加注至 ${bet.chips} 籌碼 + ${bet.holes} 牌孔`,
          prev.round
        );
        
        // 切換到對手
        const opponentId = currentPlayer.id === updatedBettingRound.challengerId ? 
          updatedBettingRound.predictorId : updatedBettingRound.challengerId;
        const opponentIndex = prev.players.findIndex(p => p.id === opponentId);
        updatedBettingRound.currentPlayerIndex = opponentIndex;
      }

      // 更新玩家動作
      const updatedPlayers = playerAction ? 
        updatePlayerAction(prev.players, currentPlayer.id, { ...playerAction, isLatest: true }) : 
        prev.players;

      return {
        ...prev,
        phase: newPhase,
        currentPlayerIndex: updatedBettingRound.currentPlayerIndex, // 同步更新主要的 currentPlayerIndex
        players: updatedPlayers,
        bettingRound: updatedBettingRound,
        lastActionPlayerId: currentPlayer.id,
        gameLog,
      };
    });
  }, [createPlayerAction, updatePlayerAction]);

  // 揭示手牌並結算
  const revealAndSettle = useCallback(() => {
    setGameState(prev => {
      if (!prev.currentPrediction || !prev.bettingRound) return prev;

      const isSuccess = validatePrediction(prev.currentPrediction, prev.players);
      const predictor = prev.players.find(p => p.id === prev.currentPrediction!.playerId)!;
      const challenger = prev.players.find(p => p.id === prev.bettingRound!.challengerId)!;

      let winner = isSuccess ? predictor : challenger;
      let loser = isSuccess ? challenger : predictor;

      // 計算總獎池：包含預測者的原始下注和實際下注
      const predictorOriginalBet = prev.currentPrediction.bet;
      const predictorBet = prev.bettingRound.playerBets.get(predictor.id) || { chips: 0, holes: 0 };
      const challengerBet = prev.bettingRound.playerBets.get(challenger.id) || { chips: 0, holes: 0 };
      const totalWinnings = {
        chips: predictorOriginalBet.chips + predictorBet.chips + challengerBet.chips,
        holes: predictorOriginalBet.holes + predictorBet.holes + challengerBet.holes
      };

      const updatedPlayers = prev.players.map(player => {
        if (player.id === winner.id) {
          // 獲勝者得到對手的下注，自己的下注返還
          const ownBet = prev.bettingRound!.playerBets.get(player.id) || { chips: 0, holes: 0 };
          const opponentBet = prev.bettingRound!.playerBets.get(loser.id) || { chips: 0, holes: 0 };
          
          return {
            ...player,
            chips: player.chips + opponentBet.chips, // 獲得對手的籌碼
            holes: Math.min(player.holes + opponentBet.holes, GAME_CONFIG.MAX_HOLES), // 獲得對手的牌孔
          };
        }
        if (player.id === loser.id) {
          // 失敗者失去自己的下注
          const betAmount = prev.bettingRound!.playerBets.get(player.id) || { chips: 0, holes: 0 };
          return {
            ...player,
            chips: Math.max(0, player.chips - betAmount.chips),
            holes: Math.max(1, player.holes - betAmount.holes),
          };
        }
        return player;
      });



      return {
        ...prev,
        phase: GamePhase.ROUND_END,
        players: updatedPlayers,
        bettingRound: null,
        currentPrediction: null,
        lastRoundLoser: loser.id, // 記錄輸家ID
        showAllCards: true, // 回合結束時顯示所有玩家手牌
        gameLog: [...prev.gameLog, 
          `揭示結果：${isSuccess ? '預測成功' : '預測失敗'}`,
          `${winner.name} 獲得 ${totalWinnings.chips} 籌碼 + ${totalWinnings.holes} 牌孔`,
          `實際 ${prev.currentPrediction.color} 數量：${countColorCards(prev.players, prev.currentPrediction.color)}`
        ],
      };
    });
  }, []);

  // 開始新回合
  const startNewRound = useCallback(() => {
    setGameState(prev => {
      let updatedPlayers = [...prev.players];
      const newRound = prev.round + 1;

      // 清空所有玩家的手牌，確保每個人都至少有1個牌孔
      updatedPlayers = updatedPlayers.map(player => ({
        ...player,
        hand: [], // 清空手牌
        holes: Math.max(1, player.holes), // 確保至少有1個牌孔
      }));

      // 重新創建完整牌組並重新發牌
      const newDeck = createDeck();
      const { updatedDeck, updatedPlayers: playersWithCards } = dealCards(newDeck, updatedPlayers);
      updatedPlayers = playersWithCards;

      // 檢查位置重排
      if (newRound % GAME_CONFIG.POSITION_SHUFFLE_ROUNDS === 0) {
        updatedPlayers = shufflePlayerPositions(updatedPlayers);
      }

      // 檢查回合懲罰
      if (newRound >= GAME_CONFIG.PENALTY_START_ROUND && 
          (newRound - GAME_CONFIG.PENALTY_START_ROUND) % GAME_CONFIG.PENALTY_INTERVAL === 0) {
        updatedPlayers = applyRoundPenalty(updatedPlayers);
      }

      // 檢查遊戲結束
      if (isGameOver(updatedPlayers)) {
        return {
          ...prev,
          phase: GamePhase.GAME_END,
          players: updatedPlayers,
          round: newRound,
          gameLog: [...prev.gameLog, `遊戲結束！`],
        };
      }

      // 確定下一回合的起始玩家（輸家開始）
      let loserIndex = prev.currentPlayerIndex; // 默認值
      
      // 如果有記錄的上一回合輸家，使用該信息
      if (prev.lastRoundLoser) {
        const foundLoserIndex = prev.players.findIndex(p => p.id === prev.lastRoundLoser);
        if (foundLoserIndex !== -1) {
          loserIndex = foundLoserIndex;
        }
      }

      return {
        ...prev,
        phase: GamePhase.PREDICTION,
        round: newRound,
        currentPlayerIndex: loserIndex,
        players: updatedPlayers,
        deck: updatedDeck,
        currentPrediction: null,
        bettingRound: null,
        lastActionPlayerId: undefined, // 清除上一回合的動作記錄
        showAllCards: false, // 新回合開始時隱藏手牌
        gameLog: [...prev.gameLog, `回合 ${newRound} 開始`],
      };
    });
  }, []);

  // 添加AI想法到游戲日志的輔助函數
  const addAIThoughtToLog = useCallback((playerName: string, thought: string) => {
    if (thought && thought.trim()) {
      setGameState(prev => ({
        ...prev,
        gameLog: [...prev.gameLog, `💭 ${playerName} 想法：${thought}`],
      }));
    }
  }, []);

  // AI自動執行
  useEffect(() => {
    const executeAITurn = async () => {
      // 排除不需要AI輸入的階段
      if (gameState.phase === GamePhase.SETUP || 
          gameState.phase === GamePhase.GAME_END || 
          gameState.phase === GamePhase.DEALING ||
          gameState.phase === GamePhase.REVEAL ||
          gameState.phase === GamePhase.ROUND_END) return;

      // 在下注階段，使用 bettingRound 的 currentPlayerIndex
      let actualCurrentPlayerIndex = gameState.currentPlayerIndex;
      if (gameState.phase === GamePhase.BETTING && gameState.bettingRound) {
        actualCurrentPlayerIndex = gameState.bettingRound.currentPlayerIndex;
      }
      
      const currentPlayer = gameState.players[actualCurrentPlayerIndex];
      
      // 調試信息
      // console.log('AI useEffect triggered:', {
      //   phase: gameState.phase,
      //   gameStateCurrentPlayerIndex: gameState.currentPlayerIndex,
      //   bettingRoundCurrentPlayerIndex: gameState.bettingRound?.currentPlayerIndex,
      //   actualCurrentPlayerIndex,
      //   currentPlayer: currentPlayer ? { id: currentPlayer.id, name: currentPlayer.name, isAI: currentPlayer.isAI } : null,
      //   aiProcessing: aiProcessingRef.current
      // });
      
      if (!currentPlayer) {
        console.log('No current player found');
        return;
      }
      
      if (!currentPlayer.isAI) {
        console.log('Current player is human, skipping AI execution');
        return;
      }
      
      if (aiProcessingRef.current) {
        console.log('AI already processing, skipping');
        return;
      }

      aiProcessingRef.current = true; // 標記AI正在處理
      console.log('AI executing decision for:', currentPlayer.name);

      const visibleCards = getVisibleCards(currentPlayer, gameState.players);
      const aiContext = {
        player: currentPlayer,
        gameState,
        visibleCards,
        prediction: gameState.currentPrediction,
      };

      try {
        const decision = await aiEngine.makeDecision(aiContext);

        // 添加AI的想法到游戲日志
        if (decision.thought) {
          addAIThoughtToLog(currentPlayer.name, decision.thought);
        }

        if (decision.type === 'prediction' && decision.prediction) {
          makePrediction(decision.prediction.color, decision.prediction.count, decision.prediction.bet);
        } else if (decision.type === 'challenge' && decision.challengeResponse) {
          respondToChallenge(decision.challengeResponse);
        } else if (decision.type === 'betting' && decision.bettingAction) {
          makeBettingAction(decision.bettingAction.action, decision.bettingAction.bet);
        }
      } catch (error) {
        console.error('AI decision error:', error);
      } finally {
        // 延遲重置狀態，防止立即重新觸發
        setTimeout(() => { aiProcessingRef.current = false; }, 1000);
      }
    };

    const timer = setTimeout(executeAITurn, 2000); // 2秒延遲模擬思考時間
    return () => clearTimeout(timer);
  }, [
    gameState.phase, 
    gameState.currentPlayerIndex, 
    gameState.bettingRound?.currentPlayerIndex, // 添加 bettingRound 的 currentPlayerIndex
    gameState.players, 
    aiEngine, 
    makePrediction, 
    respondToChallenge, 
    makeBettingAction,
    addAIThoughtToLog
  ]);

  // 自動開始新回合
  // useEffect(() => {
  //   if (gameState.phase === GamePhase.ROUND_END) {
  //     const timer = setTimeout(() => {
  //       startNewRound();
  //     }, 3000); // 3秒後開始新回合
  //     return () => clearTimeout(timer);
  //   }
  // }, [gameState.phase, startNewRound]);

  // 自動進行揭示和結算
  // useEffect(() => {
  //   if (gameState.phase === GamePhase.REVEAL) {
  //     const timer = setTimeout(() => {
  //       revealAndSettle();
  //     }, 2000); // 2秒後進行結算
  //     return () => clearTimeout(timer);
  //   }
  // }, [gameState.phase, revealAndSettle]);

  return {
    gameState,
    initializeGame,
    makePrediction,
    respondToChallenge,
    makeBettingAction,
    revealAndSettle,
    startNewRound,
  };
};
