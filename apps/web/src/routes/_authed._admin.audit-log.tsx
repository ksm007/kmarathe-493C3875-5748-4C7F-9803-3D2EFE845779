import { useMemo, useState } from 'react';
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
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
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

const auditColumnHelper = createColumnHelper<AuditLogEntry>();

function AuditLogRoute() {
  const currentUser = useCurrentUser();
  const [limit, setLimit] = useState(defaultAuditLimit);
  const [sorting, setSorting] = useState<SortingState>([]);

  const auditQuery = useQuery({
    queryKey: ['audit-log', currentUser.organizationId, limit],
    queryFn: () => apiClient.auditLog({ limit }),
  });

  const entries = auditQuery.data ?? [];

  const columns = useMemo(
    () => [
      auditColumnHelper.accessor('createdAt', {
        header: 'Time',
        cell: (info) => (
          <Text size="sm">{new Date(info.getValue()).toLocaleString()}</Text>
        ),
      }),
      auditColumnHelper.accessor('actorEmail', {
        header: 'Actor',
        cell: (info) => (
          <Text size="sm">{info.getValue() ?? 'System'}</Text>
        ),
      }),
      auditColumnHelper.accessor('action', {
        header: 'Action',
        cell: (info) => (
          <Text size="sm" fw={700}>
            {info.getValue()}
          </Text>
        ),
      }),
      auditColumnHelper.display({
        id: 'resource',
        header: 'Resource',
        cell: (info) => {
          const entry = info.row.original;
          return (
            <Text size="sm">
              {entry.resource}
              {entry.resourceId ? ` ${entry.resourceId}` : ''}
            </Text>
          );
        },
      }),
      auditColumnHelper.accessor('allowed', {
        header: 'Result',
        cell: (info) => {
          const entry = info.row.original;
          return (
            <>
              <Badge color={info.getValue() ? 'green' : 'red'} variant="light">
                {info.getValue() ? 'Allowed' : 'Denied'}
              </Badge>
              {entry.reason ? (
                <Text size="xs" c="dimmed" mt={4}>
                  {entry.reason}
                </Text>
              ) : null}
            </>
          );
        },
      }),
      auditColumnHelper.accessor('metadata', {
        header: 'Metadata',
        enableSorting: false,
        cell: (info) => (
          <Text size="xs" c="dimmed" lineClamp={3}>
            {formatMetadata(info.getValue())}
          </Text>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

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
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Table.Th
                      key={header.id}
                      style={
                        header.column.getCanSort()
                          ? { cursor: 'pointer', userSelect: 'none' }
                          : undefined
                      }
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getIsSorted() === 'asc'
                        ? ' ↑'
                        : header.column.getIsSorted() === 'desc'
                          ? ' ↓'
                          : null}
                    </Table.Th>
                  ))}
                </Table.Tr>
              ))}
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
              ) : table.getRowModel().rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" py="md">
                      No audit entries
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <Table.Tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
