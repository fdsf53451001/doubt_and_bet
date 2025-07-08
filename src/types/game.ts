// 遊戲配置常數
export const GAME_CONFIG = {
  PLAYERS_COUNT: 5,
  INITIAL_HOLES: 5,
  INITIAL_CHIPS: 4,
  CARDS_PER_COLOR: 10,
  MAX_HOLES: 5,
  POSITION_SHUFFLE_ROUNDS: 10,
  PENALTY_START_ROUND: 15,
  PENALTY_INTERVAL: 5,
  WINNING_PLAYERS: 3,
  HOLE_VALUE_MULTIPLIER: 1, // 牌孔相對於籌碼的價值倍數
};

// 卡牌顏色枚舉
export enum CardColor {
  RED = 'red',
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
  PURPLE = 'purple',
  RAINBOW = 'rainbow',
}

// 卡牌類型
export interface Card {
  id: string;
  color: CardColor;
}

// 玩家動作類型
export enum PlayerActionType {
  PREDICTION = 'prediction',
  ACCEPT_CHALLENGE = 'accept_challenge',
  CHALLENGE_PREDICTION = 'challenge_prediction',
  BET_RAISE = 'bet_raise',
  BET_CALL = 'bet_call',
  BET_FOLD = 'bet_fold',
}

// 玩家動作記錄
export interface PlayerAction {
  type: PlayerActionType;
  round: number;
  description: string;
  timestamp: number;
  isLatest?: boolean; // 標記是否為最新動作
}

// 玩家類型
export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  holes: number;
  chips: number;
  hand: Card[];
  isEliminated: boolean;
  position: number;
  teamMembers: string[]; // 合作夥伴的ID
  lastAction?: PlayerAction; // 最後一個動作
}

// 預測類型
export interface Prediction {
  playerId: string;
  color: CardColor;
  count: number;
  bet: Bet;
}

// 下注類型
export interface Bet {
  chips: number;
  holes: number;
}

// 遊戲階段枚舉
export enum GamePhase {
  SETUP = 'setup',
  DEALING = 'dealing',
  PREDICTION = 'prediction',
  CHALLENGE = 'challenge',
  BETTING = 'betting',
  REVEAL = 'reveal',
  ROUND_END = 'round_end',
  GAME_END = 'game_end',
}

// 挑戰回應類型
export enum ChallengeResponse {
  ACCEPT = 'accept',
  CHALLENGE = 'challenge',
}

// 下注動作類型
export enum BettingAction {
  RAISE = 'raise',
  CALL = 'call',
  FOLD = 'fold',
}

// 遊戲狀態類型
export interface GameState {
  phase: GamePhase;
  round: number;
  currentPlayerIndex: number;
  players: Player[];
  deck: Card[];
  currentPrediction: Prediction | null;
  bettingRound: {
    currentPlayerIndex: number;
    totalBet: Bet;
    playerBets: Map<string, Bet>;
    lastRaisePlayer: string | null;
    challengerId: string; // 挑戰者ID
    predictorId: string;  // 預測者ID
    minimumBet: Bet; // 最低下注金額
  } | null;
  winner: string | null;
  lastRoundLoser: string | null; // 上一回合的輸家ID
  gameLog: string[];
  lastActionPlayerId?: string; // 最後執行動作的玩家ID
  showAllCards?: boolean; // 是否顯示所有玩家的手牌
}

// AI 決策上下文
export interface AIContext {
  player: Player;
  gameState: GameState;
  visibleCards: Card[]; // 包含自己和隊友的手牌
  prediction: Prediction | null;
}

// AI 決策結果
export interface AIDecision {
  type: 'prediction' | 'challenge' | 'betting' | 'resource_exchange';
  thought?: string; // AI的思考過程
  prediction?: {
    color: CardColor;
    count: number;
    bet: Bet;
  };
  challengeResponse?: ChallengeResponse;
  bettingAction?: {
    action: BettingAction;
    bet?: Bet;
  };
  resourceExchange?: {
    chipsToHoles: number;
    holesToChips: number;
  };
}
