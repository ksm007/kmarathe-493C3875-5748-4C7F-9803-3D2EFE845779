import type { ReactNode } from 'react';
import {
  Box,
  Center,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { ClipboardList } from 'lucide-react';

export function AuthCard({
  children,
  icon,
  subtitle,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <Box className="auth-page">
      <Container size="xs" py={{ base: 'md', md: 'xl' }}>
        <Center mih="calc(100vh - 48px)">
          <Paper withBorder radius="md" p="xl" shadow="sm" w="100%">
            <Stack gap="lg">
              <Group justify="space-between" gap="md">
                <Group gap="sm">
                  <ThemeIcon size={42} radius="md">
                    <ClipboardList size={21} aria-hidden="true" />
                  </ThemeIcon>
                  <Box>
                    <Text size="sm" fw={800}>
                      Turbo Vets
                    </Text>
                    <Text size="xs" c="dimmed">
                      SaaS work management
                    </Text>
                  </Box>
                </Group>
                <ThemeIcon size={42} radius="md" color="gray" variant="light">
                  {icon}
                </ThemeIcon>
              </Group>

              <Box>
                <Title order={1} size="h2">
                  {title}
                </Title>
                <Text c="dimmed" mt={4}>
                  {subtitle}
                </Text>
              </Box>

              {children}
            </Stack>
          </Paper>
        </Center>
      </Container>
    </Box>
  );
}
