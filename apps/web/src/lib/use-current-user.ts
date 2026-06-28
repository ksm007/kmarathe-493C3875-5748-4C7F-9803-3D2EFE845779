import type { CurrentUser } from '@nx-temp/data';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from './api-client';
import { getStoredSession } from './auth-storage';

/**
 * Returns the signed-in user for the authenticated area.
 *
 * The `_authed` route guard guarantees a stored session before any component
 * that calls this hook renders, so the session user seeds `initialData` and the
 * value is always present. Reading through the `['me']` query keeps the org
 * switcher live: switching orgs writes the new user into this cache key.
 */
export function useCurrentUser(): CurrentUser {
  const session = getStoredSession();
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: apiClient.me,
    initialData: session?.user,
  });

  return data as CurrentUser;
}
