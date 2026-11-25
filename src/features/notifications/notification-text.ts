import type { AppNotification } from '@/features/notifications/notifications-api';

// 通知 1 件の見出し文。
export function notificationMessage(n: Pick<AppNotification, 'type' | 'actor'>): string {
  const name = n.actor.displayName || `@${n.actor.handle}`;
  switch (n.type) {
    case 'like':
      return `${name} さんがあなたの投稿にいいねしました`;
    case 'reply':
      return `${name} さんがあなたの投稿にリプライしました`;
    case 'follow':
      return `${name} さんがあなたをフォローしました`;
  }
}

// タブのバッジに出す文字。0 は出さない。99 を超えたら 99+。
export function badgeLabel(count: number | undefined): string | undefined {
  if (!count || count <= 0) return undefined;
  return count > 99 ? '99+' : String(count);
}
