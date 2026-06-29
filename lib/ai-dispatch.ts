// Unified AI dispatch — routes through the correct provider without duplicating runChat logic.
// Server-side only.

import { chat } from '@/lib/sap-ai-core';
import { geminiChat } from '@/lib/gemini';
import { AISettings } from '@/lib/ai-settings';

export async function callAI(
  settings: AISettings,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4000,
): Promise<string> {
  if (settings.provider === 'gemini') {
    if (!settings.geminiApiKey || !settings.geminiModel) {
      throw new Error('Gemini API key and model are required');
    }
    return geminiChat(settings.geminiApiKey, settings.geminiModel, systemPrompt, userMessage, maxTokens);
  }
  return chat(settings, systemPrompt, userMessage, maxTokens);
}
