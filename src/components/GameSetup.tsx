import React, { useState } from 'react';
import { AIConfig, AIConfigSettings } from './AIConfig';

interface GameSetupProps {
  onStartGame: (playerName: string, teamSetup: Record<string, string[]>, aiConfig?: AIConfigSettings) => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
  const [playerName, setPlayerName] = useState('玩家');
  const [selectedTeammates, setSelectedTeammates] = useState<string[]>([]);
  const [aiConfig, setAiConfig] = useState<AIConfigSettings>({
    apiKey: '',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo'
  });
  const [isAiConfigExpanded, setIsAiConfigExpanded] = useState(false);

  const aiPlayers = ['AI玩家1', 'AI玩家2', 'AI玩家3', 'AI玩家4'];

  const handleTeammateToggle = (playerId: string) => {
    setSelectedTeammates(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId].slice(0, 2) // 最多2個隊友
    );
  };

  const handleStartGame = () => {
    const teamSetup: Record<string, string[]> = {
      'player-0': selectedTeammates.map(name => name.replace('AI玩家', 'player-')),
    };

    // 設置AI玩家的隊友關係
    selectedTeammates.forEach(teammate => {
      const playerId = teammate.replace('AI玩家', 'player-');
      teamSetup[playerId] = ['player-0'];
    });

    // 傳遞AI配置
    const configToPass = aiConfig.apiKey.trim() ? aiConfig : undefined;
    onStartGame(playerName, teamSetup, configToPass);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-center mb-8">挑戰並下注遊戲</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-lg font-medium mb-2">您的名字:</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none"
            placeholder="輸入您的名字"
          />
        </div>

        <div>
          <label className="block text-lg font-medium mb-4">選擇合作夥伴 (最多2位):</label>
          <div className="grid grid-cols-2 gap-3">
            {aiPlayers.map((player) => (
              <button
                key={player}
                onClick={() => handleTeammateToggle(player)}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  selectedTeammates.includes(player)
                    ? 'border-blue-500 bg-blue-100 text-blue-800'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                }`}
              >
                {player}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            合作夥伴可以看到彼此的手牌，最多選擇2位
          </p>
        </div>

        <AIConfig
          config={aiConfig}
          onConfigChange={setAiConfig}
          isExpanded={isAiConfigExpanded}
          onToggle={() => setIsAiConfigExpanded(!isAiConfigExpanded)}
        />

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">遊戲規則摘要:</h3>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>• 5位玩家，每人初始5個牌孔、4個籌碼</li>
            <li>• 6種顏色卡牌（紅、黃、綠、藍、紫、彩虹），每種10張</li>
            <li>• 預測所有玩家中某顏色的卡牌總數並下注</li>
            <li>• 彩虹卡計入所有顏色</li>
            <li>• 遊戲持續到只剩3位玩家</li>
          </ul>
        </div>

        <button
          onClick={handleStartGame}
          disabled={!playerName.trim()}
          className="w-full py-4 text-xl font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          開始遊戲
        </button>
      </div>
    </div>
  );
};
