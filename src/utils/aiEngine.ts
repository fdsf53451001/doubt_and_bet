import { AIContext, AIDecision, CardColor, ChallengeResponse, BettingAction } from '../types/game';
import { countColorCards, getVisibleCards, calculateBetValue, isBetHigherOrEqual } from './gameLogic';

// AI API 配置
const AI_CONFIG = {
  apiKey: process.env.REACT_APP_API_KEY,
  baseUrl: process.env.REACT_APP_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.REACT_APP_MODEL || 'gpt-3.5-turbo',
};

// AI 決策引擎
export class AIEngine {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private maxRetries: number = 5; // 最大重試次數

  constructor(config?: Partial<typeof AI_CONFIG>) {
    this.apiKey = config?.apiKey || AI_CONFIG.apiKey || '';
    this.baseUrl = config?.baseUrl || AI_CONFIG.baseUrl;
    this.model = config?.model || AI_CONFIG.model;
    
    // 如果沒有 API Key，會使用備用邏輯
    if (!this.apiKey) {
      console.warn('未設置 AI API Key，將使用備用AI邏輯');
    } else {
      console.log(`AI配置: 模型=${this.model}, 基礎URL=${this.baseUrl}`);
    }
  }

  // 主要的AI決策函數
  async makeDecision(context: AIContext): Promise<AIDecision> {
    if (!this.validateApiConfig()) {
      console.warn('Invalid API configuration, using fallback decision');
      return this.makeFallbackDecision(context);
    }

    // 實施重試機制
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // console.log(`AI決策嘗試 ${attempt}/${this.maxRetries}`);
        
        const prompt = this.buildPrompt(context);
        // console.log('Built AI prompt:', prompt);
        
        const response = await this.callOpenAI(prompt);
        const decision = this.parseAIResponse(response, context);
        
        // console.log(`AI決策成功 (第${attempt}次嘗試)`);
        return decision;
      } catch (error) {
        console.warn(`AI決策失敗 (第${attempt}次嘗試):`, error);
        
        if (attempt < this.maxRetries) {
          // 等待一段時間後重試 (指數退避)
          const waitTime = Math.pow(1.5, attempt - 1) * 1000; // 1s, 2s, 4s...
          console.log(`等待 ${waitTime}ms 後重試...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    console.warn(`所有 ${this.maxRetries} 次嘗試都失敗，使用備用決策`);
    return this.makeFallbackDecision(context);
  }

  // 建構AI提示
  private buildPrompt(context: AIContext): string {
    const { player, gameState, visibleCards, prediction } = context;
    
    const visibleCardsCounts = this.getColorCounts(visibleCards);
    const teamInfo = player.teamMembers.length > 0 ? 
      `你與玩家 ${player.teamMembers.join(', ')} 是合作夥伴，你們可以互相看到彼此的手牌。` : 
      '你沒有合作夥伴。';

    let prompt = `
    你是一個策略性卡牌遊戲「挑戰並下注」的AI玩家。

    遊戲規則摘要：
    - 6種顏色卡牌（red、yellow、green、blue、purple、rainbow），每種10張
    - 彩虹卡計入所有顏色
    - 玩家預測所有玩家中某個顏色的卡牌總數量
    - 其他玩家可以接受或挑戰預測

    當前遊戲狀態：
    - 回合數：${gameState.round}
    - 你的資源：${player.chips} 個籌碼，${player.holes} 個牌孔
    - ${teamInfo}

    你可以看到的卡牌數量：
    ${Object.entries(visibleCardsCounts).map(([color, count]) => `${color}: ${count}張`).join(', ')}

    總共可見卡牌：${visibleCards.length}張
    總共不可見卡牌：${(() => {
      const totalPlayersCards = gameState.players.reduce((total, p) => total + (p.hand?.length || 0), 0);
      return totalPlayersCards - visibleCards.length;
    })()}張
    `;

    if (gameState.phase === 'prediction') {
      const minCount = prediction ? prediction.count + 1 : 1;
      
      prompt += `
      請做出預測決策：
      1. 選擇一個顏色 (red、yellow、green、blue、purple 其中之一)
      2. 預測該顏色的總數量（記住彩虹卡也會計入）
      3. 決定下注金額（籌碼和牌孔）

      ${prediction ? `注意：由於前一個預測是 ${prediction.count} 張，你的預測必須至少 ${minCount} 張。` : ''}

      回應格式（僅回應JSON，無其他文字）：
      {"type":"prediction","thought":"說明你的思考過程","prediction":{"color":"Red","count":${minCount},"bet":{"chips":1,"holes":0}}}`;
    }

    if (gameState.phase === 'challenge' && prediction) {
      prompt += `
      當前預測：${prediction.color} 顏色 ${prediction.count} 張，下注 ${prediction.bet.chips} 籌碼 + ${prediction.bet.holes} 牌孔

      你需要思考你能看到的牌是否足夠支持這個預測，大概率不支持時才會挑戰，你需要謹慎挑戰因為這可能讓你丟失籌碼與牌孔
      請決定是接受還是挑戰：
      - accept：你需要做出更高的預測
      - challenge：進入下注對決

      回應格式（僅回應JSON，無其他文字）：
      {"type":"challenge","thought":"說明你的思考過程","challengeResponse":"accept"}`;
    }

    if (gameState.phase === 'betting' && gameState.bettingRound) {
      const bettingRound = gameState.bettingRound;
      const currentBet = bettingRound.totalBet;
      const minimumBet = bettingRound.minimumBet;
      const isFirstBet = bettingRound.playerBets.size === 0;
      const isChallenger = player.id === bettingRound.challengerId;
      const isPredictor = player.id === bettingRound.predictorId;
      
      prompt += `
      下注階段信息：
      - 你的角色：${isChallenger ? '挑戰者' : '預測者'}
      - 最低下注：${minimumBet.chips} 籌碼 + ${minimumBet.holes} 牌孔
      - 當前總下注：${currentBet.chips} 籌碼 + ${currentBet.holes} 牌孔
      - 當前總價值：${calculateBetValue(currentBet)}
      - 是否首次下注：${isFirstBet ? '是' : '否'}

      ${isFirstBet && isChallenger ? 
        `作為挑戰者，你必須先下注，下注最少需要一個籌碼或牌孔。` :
        `對手已下注，你需要決定如何回應。`
      }

      如果你選擇跟注或加注，你需要妥善分配籌碼與牌孔，尤其是牌孔減少會導致你下一回合收到的牌減少，影響你的資訊量

      可選動作：
      ${!isFirstBet ? 
        `- call：跟注（匹配當前下注）` :
        ``
      }
      - raise：加注（必須比當前下注更高）
      - fold：棄牌（放棄對決，失去已下注的資源，棄牌應當在你明確會輸時才使用）

      回應格式（僅回應JSON，無其他文字）：
      {"type":"betting","thought":"說明你的思考過程","bettingAction":{"action":"call","bet":{"chips":${currentBet.chips},"holes":${currentBet.holes}}}}`;
    }

    // console.log('AI prompt built:', prompt);

    return prompt;
  }

  // 驗證 API 配置
  private validateApiConfig(): boolean {
    if (!this.apiKey) {
      console.warn('No API key provided');
      return false;
    }
    
    if (!this.baseUrl) {
      console.warn('No base URL provided');
      return false;
    }
    
    if (!this.model) {
      console.warn('No model specified');
      return false;
    }
    
    // 檢查 API key 格式
    if (!this.apiKey.startsWith('sk-') && !this.apiKey.startsWith('sk_')) {
      console.warn('API key format may be different from OpenAI (OpenRouter keys start with sk-or-)');
      // 不阻止執行，因為可能是其他 API 提供商
    }
    
    return true;
  }

  // 調用AI API
  private async callOpenAI(prompt: string): Promise<string> {
    const apiUrl = `${this.baseUrl}/chat/completions`;
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '你是一個策略性卡牌遊戲的AI玩家。請根據遊戲規則和當前狀況做出最佳決策。請務必回應有效的JSON格式，不要包含任何解釋或額外文字。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI API error: ${response.status} - ${errorText}`);
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid AI API response structure:', data);
        throw new Error('Invalid AI API response structure');
      }
      
      const content = data.choices[0].message.content;
      // console.log('AI API response received:', content);
      
      if (!content || content.trim() === '') {
        console.error('Empty AI API response');
        throw new Error('Empty AI API response');
      }
      
      return content;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  // 解析AI回應
  private parseAIResponse(response: string, context: AIContext): AIDecision {
    try {
      // console.log('AI raw response:', response);
      
      // 檢查回應是否為空
      if (!response || response.trim() === '') {
        console.warn('Empty AI response');
        throw new Error('Empty AI response');
      }
      
      // 嘗試清理回應文字中的非JSON內容
      let cleaned = response.trim();
      
      // 如果回應以非 { 開頭，可能包含其他文字
      if (!cleaned.startsWith('{')) {
        // 嘗試提取JSON部分
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        } else {
          console.warn('No JSON found in AI response');
          throw new Error('No valid JSON found in AI response');
        }
      }
      
      const decision = JSON.parse(cleaned);
      console.log('Parsed AI decision:', decision);
      
      // 顯示AI的思考過程
      if (decision.thought) {
        console.log('AI思考過程:', decision.thought);
      }
      
      // 驗證決策對象不為空
      if (!decision || typeof decision !== 'object') {
        console.warn('Invalid AI decision object');
        throw new Error('Invalid AI decision object');
      }
      
      // 驗證決策的有效性
      if (decision.type === 'prediction' && decision.prediction) {
        if (!Object.values(CardColor).includes(decision.prediction.color)) {
          console.warn('Invalid color in AI prediction, using default');
          decision.prediction.color = CardColor.RED; // 默認顏色
        }
        
        // 確保預測數量符合最低要求
        const minCount = context.prediction ? context.prediction.count + 1 : 1;
        if (decision.prediction.count < minCount) {
          console.warn('AI prediction count too low, adjusting');
          decision.prediction.count = minCount;
        }
      }

      // 驗證決策類型是否符合當前遊戲階段
      if (!this.validateDecisionType(decision, context)) {
        console.warn('Invalid decision type for current game phase');
        throw new Error('Invalid decision type for current game phase');
      }

      return decision;
    } catch (error) {
      console.warn('Failed to parse AI response:', error);
      console.warn('Original response:', response);
      throw error; // 重新拋出錯誤而不是返回fallback
    }
  }

  // 驗證決策類型是否符合當前遊戲階段
  private validateDecisionType(decision: any, context: AIContext): boolean {
    console.log('Validating decision type:', decision, 'for game state:', context.gameState.phase);
    const { gameState } = context;
    
    switch (gameState.phase) {
      case 'prediction':
        return decision.type === 'prediction' && decision.prediction;
      case 'challenge':
        return decision.type === 'challenge' && decision.challengeResponse;
      case 'betting':
        return decision.type === 'betting' && decision.bettingAction;
      case 'setup':
      case 'dealing':
      case 'reveal':
      case 'round_end':
      case 'game_end':
        // 這些階段不需要玩家輸入，直接返回false
        console.warn(`AI should not be called during phase: ${gameState.phase}`);
        return false;
      default:
        console.warn(`Unknown game phase: ${gameState.phase}`);
        return false;
    }
  }

  // 備用決策邏輯（當AI API不可用時）
  private makeFallbackDecision(context: AIContext): AIDecision {
    const { player, gameState, visibleCards, prediction } = context;

    if (gameState.phase === 'prediction') {
      // 基本策略：選擇可見卡牌最多的顏色
      const colorCounts = this.getColorCounts(visibleCards);
      const bestColor = Object.entries(colorCounts).reduce((a, b) => 
        colorCounts[a[0]] > colorCounts[b[0]] ? a : b
      )[0] as CardColor;

      const visibleCount = colorCounts[bestColor];
      const baseEstimate = Math.max(visibleCount + 2, Math.floor(visibleCount * 1.5));
      
      // 如果有之前的預測，確保新預測更高
      const minCount = prediction ? prediction.count + 1 : 1;
      const estimatedTotal = Math.max(baseEstimate, minCount);

      return {
        type: 'prediction',
        thought: `選擇${bestColor}顏色，因為這是可見卡牌最多的顏色（${visibleCount}張）。預測總數為${estimatedTotal}張。`,
        prediction: {
          color: bestColor,
          count: estimatedTotal,
          bet: { chips: 1, holes: 0 }
        }
      };
    }

    if (gameState.phase === 'challenge' && prediction) {
      const visibleCards = getVisibleCards(player, gameState.players);
      const visibleCount = countColorCards([{...player, hand: visibleCards}], prediction.color);
      
      // 如果可見的卡牌數量已經接近預測數量，選擇挑戰
      const shouldChallenge = visibleCount >= prediction.count * 0.8;
      
      return {
        type: 'challenge',
        thought: shouldChallenge ? 
          `挑戰這個預測，因為可見的${prediction.color}卡牌已有${visibleCount}張，接近預測的${prediction.count}張。` :
          `接受這個預測，可見的${prediction.color}卡牌只有${visibleCount}張，遠低於預測的${prediction.count}張。`,
        challengeResponse: shouldChallenge ? ChallengeResponse.CHALLENGE : ChallengeResponse.ACCEPT
      };
    }

    if (gameState.phase === 'betting') {
      // 下注策略
      if (player.chips < 1) {
        // 籌碼不足，棄牌
        return {
          type: 'betting',
          thought: '籌碼不足，選擇棄牌以保存資源。',
          bettingAction: {
            action: BettingAction.FOLD
          }
        };
      }

      const bettingRound = gameState.bettingRound;
      if (!bettingRound) return this.makeFallbackDecision(context);

      // 檢查是否是挑戰者的第一次下注
      const isFirstBet = bettingRound.playerBets.size === 0;
      
      if (isFirstBet && player.id === bettingRound.challengerId) {
        // 挑戰者必須先下注，至少匹配預測者的原始下注
        const minBet = bettingRound.minimumBet;
        
        // 決定是否加注
        if (calculateBetValue({ chips: player.chips, holes: player.holes }) > calculateBetValue(minBet) + 1) {
          // 有足夠籌碼，考慮加注
          const raiseBet = { chips: minBet.chips + 1, holes: minBet.holes };
          if (isBetHigherOrEqual(raiseBet, minBet)) {
            return {
              type: 'betting',
              thought: `作為挑戰者，我有足夠資源加注。將下注提高到${raiseBet.chips}籌碼+${raiseBet.holes}牌孔來增加壓力。`,
              bettingAction: {
                action: BettingAction.RAISE,
                bet: raiseBet
              }
            };
          }
        } else {
          // 只能匹配最低下注
          return {
            type: 'betting',
            thought: `作為挑戰者，我的資源有限，只能匹配最低下注${minBet.chips}籌碼+${minBet.holes}牌孔。`,
            bettingAction: {
              action: BettingAction.CALL
            }
          };
        }
      } else {
        // 對手已經下注，需要決定跟注還是加注
        const currentBet = bettingRound.totalBet;
        
        if (calculateBetValue({ chips: player.chips, holes: player.holes }) >= calculateBetValue(currentBet) + 1) {
          // 有足夠籌碼，30% 概率加注
          if (Math.random() < 0.3) {
            const raiseBet = { chips: currentBet.chips + 1, holes: currentBet.holes };
            return {
              type: 'betting',
              thought: `我有足夠資源，決定加注到${raiseBet.chips}籌碼+${raiseBet.holes}牌孔來增加壓力。`,
              bettingAction: {
                action: BettingAction.RAISE,
                bet: raiseBet
              }
            };
          }
        }
        
        // 跟注
        return {
          type: 'betting',
          thought: `選擇跟注${currentBet.chips}籌碼+${currentBet.holes}牌孔，匹配對手的下注。`,
          bettingAction: {
            action: BettingAction.CALL,
            bet: currentBet
          }
        };
      }
    }

    // 默認決策
    return {
      type: 'prediction',
      thought: '使用默認決策，選擇紅色預測1張卡牌。',
      prediction: {
        color: CardColor.RED,
        count: 1,
        bet: { chips: 1, holes: 0 }
      }
    };
  }

  // 計算可見卡牌的顏色數量
  private getColorCounts(cards: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    Object.values(CardColor).forEach(color => {
      counts[color] = 0;
    });

    cards.forEach(card => {
      counts[card.color]++;
      // 彩虹卡計入所有顏色
      if (card.color === CardColor.RAINBOW) {
        Object.values(CardColor).forEach(color => {
          if (color !== CardColor.RAINBOW) {
            counts[color]++;
          }
        });
      }
    });

    return counts;
  }
}
