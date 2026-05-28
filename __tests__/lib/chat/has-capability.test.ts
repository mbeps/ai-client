import { describe, it, expect } from 'vitest';
import { hasCapability, MODELS } from '@/constants/models';

describe('hasCapability', () => {
  it('should return true if model has the capability', () => {
    const visionModel = MODELS.find(m => m.capabilities?.includes('vision'));
    if (visionModel) {
      expect(hasCapability(visionModel, 'vision')).toBe(true);
    }
  });

  it('should return false if model does not have the capability', () => {
    const noVisionModel = MODELS.find(m => !m.capabilities?.includes('vision'));
    if (noVisionModel) {
      expect(hasCapability(noVisionModel, 'vision')).toBe(false);
    }
  });

  it('should return false if model has no capabilities defined', () => {
    const model = { label: 'Test', value: 'test', capabilities: [] as any };
    expect(hasCapability(model as any, 'vision')).toBe(false);
  });
});
