import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { apiClient } from '~/lib/api-client';
import { queryClient } from '~/lib/query-client';
import { TaskDetailModal } from '~/features/tasks/task-detail-modal';

export const Route = createFileRoute('/_authed/tasks/$id')({
  loader: ({ params }) =>
    queryClient.prefetchQuery({
      queryKey: ['task-detail', params.id],
      queryFn: () => apiClient.getTaskDetail(params.id),
    }),
  component: TaskDetailRoute,
});

function TaskDetailRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClientInstance = useQueryClient();

  return (
    <TaskDetailModal
      taskId={id}
      onClose={() => void navigate({ to: '/tasks' })}
      onTasksChanged={() =>
        queryClientInstance.invalidateQueries({ queryKey: ['tasks'] })
      }
    />
  );
}
