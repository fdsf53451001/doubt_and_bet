import React, { useState } from 'react';

export interface AIConfigSettings {
  apiKey: string;
  endpoint: string;
  model: string;
}

interface AIConfigProps {
  config: AIConfigSettings;
  onConfigChange: (config: AIConfigSettings) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export const AIConfig: React.FC<AIConfigProps> = ({ 
  config, 
  onConfigChange, 
  isExpanded, 
  onToggle 
}) => {
  const [showApiKey, setShowApiKey] = useState(false);

  const handleConfigChange = (field: keyof AIConfigSettings, value: string) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  const getStatusColor = () => {
    if (config.apiKey.trim()) {
      return 'text-green-600';
    }
    return 'text-yellow-600';
  };

  const getStatusText = () => {
    if (config.apiKey.trim()) {
      return 'AI已配置';
    }
    return '使用fallback AI';
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="font-medium text-gray-700">AI配置</span>
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            配置您的OpenAI API設定。如果不提供，遊戲將使用內建的fallback AI邏輯。
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key <span className="text-gray-500">(可選)</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Endpoint <span className="text-gray-500">(可選)</span>
            </label>
            <input
              type="text"
              value={config.endpoint}
              onChange={(e) => handleConfigChange('endpoint', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model <span className="text-gray-500">(可選)</span>
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => handleConfigChange('model', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="gpt-3.5-turbo"
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">關於AI配置：</div>
                <ul className="space-y-1 text-blue-700">
                  <li>• 提供API Key後，AI將使用OpenAI的語言模型</li>
                  <li>• 不提供時使用內建的fallback邏輯</li>
                  <li>• API Key僅在本次遊戲使用，不會被保存</li>
                  <li>• 自定義endpoint支援其他OpenAI兼容的API</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
