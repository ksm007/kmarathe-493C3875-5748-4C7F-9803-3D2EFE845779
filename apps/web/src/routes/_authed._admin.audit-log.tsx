import { useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { AuditLogEntry } from '@nx-temp/data';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '~/lib/api-client';
import { getStoredSession } from '~/lib/auth-storage';
import { formatError, formatMetadata } from '~/lib/format';
import { queryClient } from '~/lib/query-client';
import { useCurrentUser } from '~/lib/use-current-user';

const defaultAuditLimit = 50;

export const Route = createFileRoute('/_authed/_admin/audit-log')({
  loader: () => {
    const organizationId = getStoredSession()?.user.organizationId;
    return queryClient.prefetchQuery({
      queryKey: ['audit-log', organizationId, defaultAuditLimit],
      queryFn: () => apiClient.auditLog({ limit: defaultAuditLimit }),
    });
  },
  component: AuditLogRoute,
});

function AuditLogRoute() {
  const currentUser = useCurrentUser();
  const [limit, setLimit] = useState(defaultAuditLimit);
  const auditQuery = useQuery({
    queryKey: ['audit-log', currentUser.organizationId, limit],
    queryFn: () => apiClient.auditLog({ limit }),
  });

  const entries = auditQuery.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={1}>Audit</Title>
          <Text c="dimmed" mt={4}>
            {entries.length} recent entries
          </Text>
        </Box>
        <Group gap="sm">
          <Select
            allowDeselect={false}
            data={[
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
            value={String(limit)}
            w={96}
            onChange={(value) => setLimit(Number(value ?? defaultAuditLimit))}
          />
          <Button
            leftSection={<RefreshCw size={16} />}
            loading={auditQuery.isFetching}
            variant="default"
            onClick={() => auditQuery.refetch()}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {auditQuery.isError ? (
        <Alert color="red">{formatError(auditQuery.error)}</Alert>
      ) : null}

      <Paper withBorder radius="md" p={0}>
        <Table.ScrollContainer minWidth={920}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Actor</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Resource</Table.Th>
                <Table.Th>Result</Table.Th>
                <Table.Th>Metadata</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {auditQuery.isPending ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Center py="lg">
                      <Loader size="sm" />
                    </Center>
                  </Table.Td>
                </Table.Tr>
              ) : entries.length ? (
                entries.map((entry) => <AuditRow key={entry.id} entry={entry} />)
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" py="md">
                      No audit entries
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm">{new Date(entry.createdAt).toLocaleString()}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{entry.actorEmail ?? 'System'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={700}>
          {entry.action}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">
          {entry.resource}
          {entry.resourceId ? ` ${entry.resourceId}` : ''}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={entry.allowed ? 'green' : 'red'} variant="light">
          {entry.allowed ? 'Allowed' : 'Denied'}
        </Badge>
        {entry.reason ? (
          <Text size="xs" c="dimmed" mt={4}>
            {entry.reason}
          </Text>
        ) : null}
      </Table.Td>
      <Table.Td>
        <Text size="xs" c="dimmed" lineClamp={3}>
          {formatMetadata(entry.metadata)}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
