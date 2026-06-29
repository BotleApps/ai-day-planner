import { describe, it, expect } from 'vitest';
import { isAIConfigured, DEFAULT_AI_SETTINGS, type AISettings } from '../lib/ai-settings';

describe('lib/ai-settings isAIConfigured', () => {
  it('returns false when AI is disabled', () => {
    const s: AISettings = { ...DEFAULT_AI_SETTINGS, enabled: false };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('SAP: returns false without a clientId', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientSecret: 'fresh-secret',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('SAP: returns true with fresh clientSecret', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: 'fresh',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('SAP: returns true with server-side clientSecretConfigured flag (after reload)', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      clientSecret: '',                  // not in client (server masked it)
      clientSecretConfigured: true,      // but server has it stored
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('SAP: returns false when neither secret nor configured flag is present', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'sap',
      clientId: 'cid',
      authUrl: 'https://auth',
      apiUrl: 'https://api',
      deploymentId: 'dep',
    };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('Gemini: returns false without an API key', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiModel: 'gemini-2.0-flash',
    };
    expect(isAIConfigured(s)).toBe(false);
  });

  it('Gemini: returns true with fresh API key', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKey: 'AIza...',
      geminiModel: 'gemini-2.0-flash',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('Gemini: returns true with server-side geminiApiKeyConfigured flag', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKey: '',
      geminiApiKeyConfigured: true,
      geminiModel: 'gemini-2.0-flash',
    };
    expect(isAIConfigured(s)).toBe(true);
  });

  it('Gemini: returns false when model is missing even if key configured', () => {
    const s: AISettings = {
      ...DEFAULT_AI_SETTINGS,
      enabled: true,
      provider: 'gemini',
      geminiApiKeyConfigured: true,
      geminiModel: '',
    };
    expect(isAIConfigured(s)).toBe(false);
  });
});
