import { createFileRoute } from '@tanstack/react-router';

/**
 * Index for `/tasks`. The board itself lives in the `/_authed/tasks` layout so
 * it stays mounted under the `/tasks/$id` detail modal; this index renders
 * nothing extra.
 */
export const Route = createFileRoute('/_authed/tasks/')({
  component: () => null,
});
