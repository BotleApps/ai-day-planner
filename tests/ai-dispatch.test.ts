import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test callAI() in isolation by mocking the two provider clients.
vi.mock('../lib/sap-ai-core', () => ({
  chat: vi.fn(async (_settings: unknown, sys: string, user: string, max?: number) =>
    `SAP:${sys.length}:${user.length}:${max ?? 'default'}`),
}));
vi.mock('../lib/gemini', () => ({
  geminiChat: vi.fn(async (_key: string, _model: string, sys: string, user: string, max?: number) =>
    `GEM:${sys.length}:${user.length}:${max ?? 'default'}`),
}));

import { DEFAULT_AI_SETTINGS, type AISettings } from '../lib/ai-settings';
import { callAI } from '../lib/ai-dispatch';
import { chat } from '../lib/sap-ai-core';
import { geminiChat } from '../lib/gemini';

describe('lib/ai-dispatch callAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to SAP when provider=sap', async () => {
    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: 'sec',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'd',
    };
    const out = await callAI(settings, 'sys', 'user-msg', 1000);
    expect(out).toBe('SAP:3:8:1000');
    expect(chat).toHaveBeenCalledOnce();
    expect(geminiChat).not.toHaveBeenCalled();
  });

  it('routes to Gemini when provider=gemini and key/model present', async () => {
    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      provider: 'gemini',
      geminiApiKey: 'AIza-stub',
      geminiModel: 'gemini-2.0-flash',
    };
    const out = await callAI(settings, 'sys', 'msg', 2000);
    expect(out).toBe('GEM:3:3:2000');
    expect(geminiChat).toHaveBeenCalledOnce();
    expect(chat).not.toHaveBeenCalled();
  });

  it('throws for Gemini without API key', async () => {
    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      provider: 'gemini',
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash',
    };
    await expect(callAI(settings, 's', 'u')).rejects.toThrow(/Gemini/);
  });

  it('throws for Gemini without model', async () => {
    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      provider: 'gemini',
      geminiApiKey: 'AIza',
      geminiModel: '',
    };
    await expect(callAI(settings, 's', 'u')).rejects.toThrow(/Gemini/);
  });

  it('passes default maxTokens=4000 when omitted', async () => {
    const settings: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: 'sec',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'd',
    };
    await callAI(settings, 's', 'u');
    expect(chat).toHaveBeenCalledWith(settings, 's', 'u', 4000);
  });
});
