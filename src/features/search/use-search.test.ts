import { act, renderHook } from '@testing-library/react-native';

import { normalizeQuery, useDebouncedValue } from '@/features/search/use-search';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('入力が止まって指定の時間がたつまで、値を変えない', async () => {
    const { result, rerender } = await renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 400),
      {
        initialProps: { v: '' },
      },
    );
    await rerender({ v: 'a' });
    await act(async () => void jest.advanceTimersByTime(300));
    await rerender({ v: 'ab' });
    await act(async () => void jest.advanceTimersByTime(300));
    expect(result.current).toBe('');
    await act(async () => void jest.advanceTimersByTime(100));
    expect(result.current).toBe('ab');
  });
});

describe('normalizeQuery', () => {
  it('前後の空白を取り除く', () => {
    expect(normalizeQuery('  hello ')).toBe('hello');
    expect(normalizeQuery('   ')).toBe('');
  });
});
