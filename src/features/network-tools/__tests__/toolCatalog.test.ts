import { TOOL_CATEGORIES, TOOLS, toolsByCategory, type ToolDefinition } from '../toolCatalog';

describe('tool catalog', () => {
  it('has unique tool ids', () => {
    const ids = TOOLS.map(tool => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every tool to a known category', () => {
    const categoryIds = new Set(TOOL_CATEGORIES.map(category => category.id));
    for (const tool of TOOLS) {
      expect(categoryIds).toContain(tool.category);
    }
  });

  it('does not mark any tool as available before it is implemented', () => {
    // Flip a tool to `available` only together with its implementation and tests.
    expect(TOOLS.filter(tool => tool.status === 'available')).toEqual([]);
  });
});

describe('toolsByCategory', () => {
  it('keeps every tool exactly once, in category order', () => {
    const groups = toolsByCategory();
    expect(groups.flatMap(group => group.tools)).toHaveLength(TOOLS.length);
    expect(groups.map(group => group.category.id)).toEqual(
      TOOL_CATEGORIES.map(category => category.id).filter(id =>
        TOOLS.some(tool => tool.category === id),
      ),
    );
  });

  it('omits categories without tools', () => {
    const onlyPing: ToolDefinition[] = TOOLS.filter(tool => tool.id === 'ping');
    const groups = toolsByCategory(onlyPing);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category.id).toBe('diagnostics');
  });
});
