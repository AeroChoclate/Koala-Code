import React, { useEffect } from 'react';
import { getModelContextLimit, estimateTokenCount } from '@koala/shared';

interface ContextUsageBarProps {
  messages: { role: 'user' | 'agent'; content: string }[];
  model: string;
  onAutoSummarize?: (usagePercentage: number) => void;
}

export function ContextUsageBar({ messages, model, onAutoSummarize }: ContextUsageBarProps) {
  const contextLimit = getModelContextLimit(model);
  
  const totalTokens = messages.reduce((sum, msg) => {
    return sum + estimateTokenCount(msg.content);
  }, 0);
  
  const usagePercentage = Math.min((totalTokens / contextLimit) * 100, 100);
  const isNearLimit = usagePercentage > 70;
  const isAtLimit = usagePercentage > 90;

  useEffect(() => {
    if (usagePercentage >= 80 && onAutoSummarize) {
      onAutoSummarize(usagePercentage);
    }
  }, [usagePercentage, onAutoSummarize]);
  
  const getBarColor = () => {
    if (isAtLimit) return 'bg-[var(--vscode-errorForeground)]';
    if (isNearLimit) return 'bg-[var(--vscode-editorWarning-foreground)]';
    return 'bg-[var(--vscode-gitDecoration-addedResourceForeground)]';
  };
  
  const getTextColor = () => {
    if (isAtLimit) return 'text-[var(--vscode-errorForeground)]';
    if (isNearLimit) return 'text-[var(--vscode-editorWarning-foreground)]';
    return 'text-[var(--vscode-gitDecoration-addedResourceForeground)]';
  };
  
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };
  
  return (
    <div className="px-3 py-2 border-b border-[var(--koala-border)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_90%,white_10%)]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
          Context Usage
        </span>
        <span className={`text-[10px] font-mono ${getTextColor()}`}>
          {formatNumber(totalTokens)} / {formatNumber(contextLimit)}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[var(--vscode-progressBar-background)] rounded-full overflow-hidden">
        <div 
          className={`h-full ${getBarColor()} transition-all duration-300 ease-out`}
          style={{ width: `${usagePercentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className={`text-[9px] ${getTextColor()}`}>
          {usagePercentage.toFixed(1)}% used
        </span>
        <span className="text-[9px] text-[var(--vscode-descriptionForeground)]">
          {model || 'No model selected'}
        </span>
      </div>
    </div>
  );
}
