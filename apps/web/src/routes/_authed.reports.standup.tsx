import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Copy, FileText, RefreshCw, Sparkles } from 'lucide-react';
import { apiClient } from '~/lib/api-client';
import { formatError } from '~/lib/format';
import { useCurrentUser } from '~/lib/use-current-user';

export const Route = createFileRoute('/_authed/reports/standup')({
  component: StandupReportRoute,
});

function StandupReportRoute() {
  const currentUser = useCurrentUser();
  const reportQuery = useQuery({
    queryKey: ['standup-report', currentUser.organizationId],
    queryFn: apiClient.standupReport,
    enabled: false,
  });

  const report = reportQuery.data?.report ?? '';
  const reportBlocks = useMemo(() => renderReportMarkdown(report), [report]);

  const copyReport = async () => {
    if (!report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(report);
      notifications.show({
        color: 'green',
        message: 'Standup report copied to clipboard.',
        title: 'Copied',
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: formatError(error),
        title: 'Copy failed',
      });
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={1}>Reports</Title>
          <Text c="dimmed" mt={4}>
            {currentUser.organizationName}
          </Text>
        </Box>
        <Button
          leftSection={
            report ? <RefreshCw size={16} /> : <Sparkles size={16} />
          }
          loading={reportQuery.isFetching}
          variant={report ? 'default' : 'filled'}
          onClick={() => reportQuery.refetch()}
        >
          {report ? 'Regenerate' : 'Generate'}
        </Button>
      </Group>

      {reportQuery.isError ? (
        <Alert color="red">{formatError(reportQuery.error)}</Alert>
      ) : null}

      <Paper withBorder radius="md" p="lg">
        {reportQuery.isFetching ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : report ? (
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="md">
              <Box>
                <Text fw={800}>Report generated</Text>
                <Text c="dimmed" size="sm">
                  {new Date().toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    weekday: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </Box>
              <Button
                leftSection={<Copy size={16} />}
                size="xs"
                variant="default"
                onClick={copyReport}
              >
                Copy
              </Button>
            </Group>
            <Box className="report-output">{reportBlocks}</Box>
          </Stack>
        ) : (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <ThemeIcon size={56} radius="md" variant="light">
                <FileText size={28} />
              </ThemeIcon>
              <Text fw={800}>No report generated</Text>
              <Text c="dimmed" maw={420} ta="center">
                Generate a standup report when you need the latest team summary.
              </Text>
            </Stack>
          </Center>
        )}
      </Paper>
    </Stack>
  );
}

function renderReportMarkdown(markdown: string) {
  const blocks: ReactNode[] = [];
  const listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    blocks.push(
      <Box component="ul" className="report-list" key={`list-${blocks.length}`}>
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </Box>,
    );
    listItems.length = 0;
  };

  for (const line of markdown.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      flushList();
      continue;
    }

    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      listItems.push(trimmedLine.slice(2));
      continue;
    }

    flushList();
    if (trimmedLine.startsWith('### ')) {
      blocks.push(
        <Title order={4} key={`h3-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine.slice(4))}
        </Title>,
      );
    } else if (trimmedLine.startsWith('## ')) {
      blocks.push(
        <Title order={3} key={`h2-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine.slice(3))}
        </Title>,
      );
    } else if (trimmedLine.startsWith('# ')) {
      blocks.push(
        <Title order={2} key={`h1-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine.slice(2))}
        </Title>,
      );
    } else if (trimmedLine === '---') {
      blocks.push(<Divider key={`hr-${blocks.length}`} />);
    } else {
      blocks.push(
        <Text key={`p-${blocks.length}`}>
          {renderInlineMarkdown(trimmedLine)}
        </Text>,
      );
    }
  }

  flushList();
  return blocks;
}

function renderInlineMarkdown(text: string) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${token}-${match.index}`}>{token.slice(2, -2)}</strong>,
      );
    } else {
      parts.push(<em key={`${token}-${match.index}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
