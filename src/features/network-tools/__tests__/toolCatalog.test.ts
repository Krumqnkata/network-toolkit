import { translations } from '../../../i18n';
import { TOOL_SCREENS } from '../screens/ToolHostScreen';
import { TOOL_CATEGORIES, TOOLS, toolsByCategory, type ToolDefinition } from '../toolCatalog';

describe('tool catalog', () => {
  it('has unique tool ids', () => {
    const ids = TOOLS.map(tool => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('assigns every tool to a known category', () => {
    for (const tool of TOOLS) {
      expect(TOOL_CATEGORIES).toContain(tool.category);
    }
  });

  it('has a name and description for every tool in every language', () => {
    for (const strings of Object.values(translations)) {
      for (const tool of TOOLS) {
        expect(strings.tools.items[tool.id].name).not.toHaveLength(0);
        expect(strings.tools.items[tool.id].description).not.toHaveLength(0);
      }
    }
  });

  it('marks a tool available exactly when its screen is implemented', () => {
    // Flip a tool to `available` only together with its implementation and tests.
    for (const tool of TOOLS) {
      expect([tool.id, tool.status === 'available']).toEqual([tool.id, tool.id in TOOL_SCREENS]);
    }
  });

  it('ships every milestone 5 tool', () => {
    expect(TOOLS.filter(tool => tool.milestone === 5).every(t => t.status === 'available')).toBe(
      true,
    );
  });
});

describe('toolsByCategory', () => {
  it('keeps every tool exactly once, in category order', () => {
    const groups = toolsByCategory();
    expect(groups.flatMap(group => group.tools)).toHaveLength(TOOLS.length);
    expect(groups.map(group => group.category)).toEqual(
      TOOL_CATEGORIES.filter(id => TOOLS.some(tool => tool.category === id)),
    );
  });

  it('omits categories without tools', () => {
    const onlyPing: ToolDefinition[] = TOOLS.filter(tool => tool.id === 'ping');
    const groups = toolsByCategory(onlyPing);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBe('lookup');
  });
});
