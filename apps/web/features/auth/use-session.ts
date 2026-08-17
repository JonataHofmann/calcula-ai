'use client';

import { useQuery } from '@tanstack/react-query';
import type { SessionUser } from '@finance/contracts';
import { useEffect } from 'react';
import { getLoginUrl, getMe, UnauthenticatedError } from '../../services/auth-api';

export function useSession(): { user: SessionUser | undefined; isLoading: boolean } {
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMe,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      if (error instanceof UnauthenticatedError) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const isUnauthenticated = query.error instanceof UnauthenticatedError;

  useEffect(() => {
    if (isUnauthenticated) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(getLoginUrl(returnTo));
    }
  }, [isUnauthenticated]);

  return { user: query.data, isLoading: query.isLoading };
}
