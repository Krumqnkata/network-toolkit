import React from 'react';

import { useTheme } from '../../../app/theme';
import { Badge, Card, ListRow, Screen, SectionHeader } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { useStrings } from '../../../i18n';
import { toolsByCategory } from '../toolCatalog';

export function ToolsScreen() {
  const theme = useTheme();
  const s = useStrings();
  const groups = toolsByCategory();

  return (
    <Screen title={s.tools.title} subtitle={s.tools.subtitle}>
      {groups.map(({ category, tools }) => (
        <React.Fragment key={category}>
          <SectionHeader title={s.tools.categories[category]} />
          <Card padded={false}>
            {tools.map((tool, index) => {
              const available = tool.status === 'available';
              const text = s.tools.items[tool.id];
              return (
                <ListRow
                  key={tool.id}
                  testID={`tool-${tool.id}`}
                  title={text.name}
                  subtitle={text.description}
                  disabled={!available}
                  showDivider={index < tools.length - 1}
                  leading={
                    <Icon
                      name={tool.icon}
                      color={available ? theme.colors.accent : theme.colors.textMuted}
                    />
                  }
                  trailing={
                    available ? (
                      <Icon name="chevronRight" color={theme.colors.textMuted} size={20} />
                    ) : (
                      <Badge label={s.common.milestone(tool.milestone)} />
                    )
                  }
                />
              );
            })}
          </Card>
        </React.Fragment>
      ))}
    </Screen>
  );
}
