import { badgeLabel, notificationMessage } from '@/features/notifications/notification-text';

const actor = { handle: 'bob', displayName: 'Bob' };

describe('notificationMessage', () => {
  it('種類ごとの文を返す', () => {
    expect(notificationMessage({ type: 'like', actor })).toContain('いいね');
    expect(notificationMessage({ type: 'reply', actor })).toContain('リプライ');
    expect(notificationMessage({ type: 'follow', actor })).toContain('フォロー');
  });

  it('表示名が空なら handle を使う', () => {
    expect(
      notificationMessage({ type: 'follow', actor: { handle: 'bob', displayName: '' } }),
    ).toContain('@bob');
  });
});

describe('badgeLabel', () => {
  it('0 や未取得は出さず、99 を超えたら 99+ にする', () => {
    expect(badgeLabel(undefined)).toBeUndefined();
    expect(badgeLabel(0)).toBeUndefined();
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(99)).toBe('99');
    expect(badgeLabel(100)).toBe('99+');
  });
});
