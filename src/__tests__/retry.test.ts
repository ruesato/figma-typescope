import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, batchRetry, isRetryFailure } from '../main/utils/retry';

describe('Retry Utility', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, {
        delays: [10, 20, 40], // Use shorter delays for testing
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 3,
          delays: [10, 20, 40],
        })
      ).rejects.toThrow('Failed after 3 attempts');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      await retryWithBackoff(fn, {
        delays: [10, 20],
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should use default options', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
    });

    it('should handle non-Error rejections', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, {
        delays: [10],
      });

      expect(result).toBe('success');
    });
  });

  describe('batchRetry', () => {
    it('should handle all successful operations', async () => {
      const ops = [
        vi.fn().mockResolvedValue('result1'),
        vi.fn().mockResolvedValue('result2'),
        vi.fn().mockResolvedValue('result3'),
      ];

      const results = await batchRetry(ops);

      expect(results).toEqual(['result1', 'result2', 'result3']);
    });

    it('should handle mixed success and failure', async () => {
      const ops = [
        vi.fn().mockResolvedValue('success'),
        vi.fn().mockRejectedValue(new Error('Failed operation')),
        vi.fn().mockResolvedValue('another success'),
      ];

      const results = await batchRetry(ops, {
        maxAttempts: 1,
        delays: [10],
      });

      expect(results[0]).toBe('success');
      expect(results[1]).toEqual({ failed: true, error: expect.stringContaining('Failed') });
      expect(results[2]).toBe('another success');
    });

    it('should retry failed operations', async () => {
      const op1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temp fail'))
        .mockResolvedValueOnce('recovered');

      const results = await batchRetry([op1], {
        maxAttempts: 2,
        delays: [10],
      });

      expect(results[0]).toBe('recovered');
      expect(op1).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRetryFailure', () => {
    it('should identify failure objects', () => {
      const failure = { failed: true as const, error: 'test error' };
      expect(isRetryFailure(failure)).toBe(true);
    });

    it('should reject success values', () => {
      expect(isRetryFailure('success')).toBe(false);
      expect(isRetryFailure(123)).toBe(false);
      expect(isRetryFailure({ data: 'value' })).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(isRetryFailure(null)).toBe(false);
      expect(isRetryFailure(undefined)).toBe(false);
    });
  });
});
