import { Card, CardColor, Player, Prediction, Bet, GAME_CONFIG } from '../types/game';

// 創建標準牌組
export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  
  Object.values(CardColor).forEach(color => {
    for (let i = 1; i <= GAME_CONFIG.CARDS_PER_COLOR; i++) {
      deck.push({
        id: `${color}-${i}`,
        color,
      });
    }
  });
  
  return shuffleDeck(deck);
};

// 洗牌函數
export const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 發牌給玩家
export const dealCards = (deck: Card[], players: Player[]): { updatedDeck: Card[], updatedPlayers: Player[] } => {
  const updatedDeck = [...deck];
  const updatedPlayers = players.map(player => {
    const hand: Card[] = [];
    // 確保玩家有有效的 holes 數量
    const holesCount = Math.max(1, player.holes || 0);
    
    for (let i = 0; i < holesCount; i++) {
      if (updatedDeck.length > 0) {
        hand.push(updatedDeck.pop()!);
      }
    }
    
    return { ...player, hand };
  });
  
  return { updatedDeck, updatedPlayers };
};

// 計算特定顏色的卡牌數量（包括彩虹卡）
export const countColorCards = (players: Player[], color: CardColor): number => {
  let count = 0;
  players.forEach(player => {
    player.hand.forEach(card => {
      if (card.color === color || card.color === CardColor.RAINBOW) {
        count++;
      }
    });
  });
  return count;
};

// 驗證預測是否成功
export const validatePrediction = (prediction: Prediction, players: Player[]): boolean => {
  const actualCount = countColorCards(players, prediction.color);
  return actualCount >= prediction.count;
};

// 計算下注總額
export const calculateBetTotal = (bet: Bet): number => {
  return bet.chips + bet.holes;
};

// 合併下注
export const combineBets = (bet1: Bet, bet2: Bet): Bet => {
  return {
    chips: bet1.chips + bet2.chips,
    holes: bet1.holes + bet2.holes,
  };
};

// 檢查玩家是否有足夠資源進行下注
export const canAffordBet = (player: Player, bet: Bet): boolean => {
  return player.chips >= bet.chips && 
         player.holes >= bet.holes && 
         (player.holes - bet.holes) >= 1; // 至少要保留一個牌孔
};

// 獲取玩家的可見卡牌（包括隊友的手牌）
export const getVisibleCards = (player: Player, players: Player[]): Card[] => {
  const visibleCards = [...player.hand];
  
  // 加入隊友的手牌
  player.teamMembers.forEach(teammateId => {
    const teammate = players.find(p => p.id === teammateId);
    if (teammate) {
      visibleCards.push(...teammate.hand);
    }
  });
  
  return visibleCards;
};

// 隨機重排玩家位置
export const shufflePlayerPositions = (players: Player[]): Player[] => {
  const activePlayers = players.filter(p => !p.isEliminated);
  const shuffledPositions = Array.from(Array(activePlayers.length).keys());
  
  for (let i = shuffledPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPositions[i], shuffledPositions[j]] = [shuffledPositions[j], shuffledPositions[i]];
  }
  
  return players.map(player => {
    if (player.isEliminated) return player;
    const newPosition = shuffledPositions.shift()!;
    return { ...player, position: newPosition };
  });
};

// 應用回合懲罰
export const applyRoundPenalty = (players: Player[]): Player[] => {
  return players.map(player => {
    if (player.isEliminated) return player;
    
    if (player.chips > 0) {
      return { ...player, chips: player.chips - 1 };
    } else if (player.holes > 1) {
      return { ...player, holes: player.holes - 1 };
    } else {
      return { ...player, isEliminated: true };
    }
  });
};

// 檢查遊戲是否結束
export const isGameOver = (players: Player[]): boolean => {
  const activePlayers = players.filter(p => !p.isEliminated);
  return activePlayers.length <= GAME_CONFIG.WINNING_PLAYERS;
};

// 獲取遊戲排名
export const getGameRanking = (players: Player[]): Player[] => {
  return [...players].sort((a, b) => {
    const scoreA = a.chips + a.holes;
    const scoreB = b.chips + b.holes;
    return scoreB - scoreA;
  });
};

// 獲取下一個玩家索引
export const getNextPlayerIndex = (currentIndex: number, players: Player[]): number => {
  const activePlayers = players.filter(p => !p.isEliminated);
  const currentPlayer = players[currentIndex];
  const currentPositionInActive = activePlayers.findIndex(p => p.id === currentPlayer.id);
  const nextPositionInActive = (currentPositionInActive + 1) % activePlayers.length;
  const nextPlayer = activePlayers[nextPositionInActive];
  return players.findIndex(p => p.id === nextPlayer.id);
};

// 計算下注的總價值（籌碼 + 牌孔）
export const calculateBetValue = (bet: Bet): number => {
  return bet.chips + (bet.holes * GAME_CONFIG.HOLE_VALUE_MULTIPLIER);
};

// 比較兩個下注的大小
export const isBetHigherOrEqual = (newBet: Bet, minBet: Bet): boolean => {
  return calculateBetValue(newBet) >= calculateBetValue(minBet);
};
