import type { IconName } from '../../components/icons/Icon';

export type ToolId =
  | 'ping'
  | 'traceroute'
  | 'dns-lookup'
  | 'reverse-dns'
  | 'port-scanner'
  | 'http-headers'
  | 'tls-certificate'
  | 'ip-info'
  | 'reachability'
  | 'lan-scanner'
  | 'speed-test'
  | 'connection-monitor';

export type ToolCategory = 'diagnostics' | 'discovery' | 'web' | 'performance';

/**
 * `planned`   – on the roadmap, not implemented; the UI shows it as disabled.
 * `available` – implemented and covered by tests.
 */
export type ToolStatus = 'planned' | 'available';

export interface ToolDefinition {
  id: ToolId;
  category: ToolCategory;
  icon: IconName;
  status: ToolStatus;
  /** Roadmap milestone in which the tool ships (see README → Roadmap). */
  milestone: number;
}

/** Display order of categories. Names and descriptions live in src/i18n. */
export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  'diagnostics',
  'discovery',
  'web',
  'performance',
];

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'ping',
    category: 'diagnostics',
    icon: 'pulse',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'dns-lookup',
    category: 'diagnostics',
    icon: 'globe',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'reverse-dns',
    category: 'diagnostics',
    icon: 'globe',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'traceroute',
    category: 'diagnostics',
    icon: 'route',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'reachability',
    category: 'diagnostics',
    icon: 'info',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'ip-info',
    category: 'diagnostics',
    icon: 'info',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'lan-scanner',
    category: 'discovery',
    icon: 'lan',
    status: 'planned',
    milestone: 6,
  },
  {
    id: 'port-scanner',
    category: 'discovery',
    icon: 'plug',
    status: 'planned',
    milestone: 6,
  },
  {
    id: 'http-headers',
    category: 'web',
    icon: 'document',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'tls-certificate',
    category: 'web',
    icon: 'lock',
    status: 'planned',
    milestone: 5,
  },
  {
    id: 'speed-test',
    category: 'performance',
    icon: 'gauge',
    status: 'planned',
    milestone: 7,
  },
  {
    id: 'connection-monitor',
    category: 'performance',
    icon: 'pulse',
    status: 'planned',
    milestone: 8,
  },
];

export function toolsByCategory(
  tools: readonly ToolDefinition[] = TOOLS,
): { category: ToolCategory; tools: ToolDefinition[] }[] {
  return TOOL_CATEGORIES.map(category => ({
    category,
    tools: tools.filter(tool => tool.category === category),
  })).filter(group => group.tools.length > 0);
}
