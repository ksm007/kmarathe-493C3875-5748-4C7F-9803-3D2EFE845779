import { useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
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
  const router = useRouter();
  const queryClientInstance = useQueryClient();

  const handleClose = () => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: '/tasks' });
    }
  };

  return (
    <TaskDetailModal
      taskId={id}
      onClose={handleClose}
      onTasksChanged={() =>
        queryClientInstance.invalidateQueries({ queryKey: ['tasks'] })
      }
    />
  );
}
