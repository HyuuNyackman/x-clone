import { useEffect } from 'react';

import { startAuthListener } from '@/features/auth/auth-store';

export function useAuthListener() {
  useEffect(() => startAuthListener(), []);
}
