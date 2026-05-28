import { describe, it, expect } from 'vitest';
import { MODELS } from '@/constants/models';

describe('Capability Gating Metadata', () => {
  it('should have basic models configured with expected capabilities', () => {
    const gptOss = MODELS.find(m => m.label === 'GPT OSS');
    expect(gptOss?.capabilities).toContain('tool-calling');
    expect(gptOss?.capabilities).toContain('json-output');

    const nanoVl = MODELS.find(m => m.label === 'Nemotron Nano VL');
    expect(nanoVl?.capabilities).toContain('vision');
    expect(nanoVl?.capabilities).not.toContain('tool-calling');
  });
});
