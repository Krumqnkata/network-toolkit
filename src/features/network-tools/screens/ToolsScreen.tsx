import React from 'react';

import { useTheme } from '../../../app/theme';
import { Badge, Card, ListRow, Screen, SectionHeader } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { toolsByCategory } from '../toolCatalog';

export function ToolsScreen() {
  const theme = useTheme();
  const groups = toolsByCategory();

  return (
    <Screen title="Tools" subtitle="Diagnostics for networks you own or manage.">
      {groups.map(({ category, tools }) => (
        <React.Fragment key={category.id}>
          <SectionHeader title={category.title} />
          <Card padded={false}>
            {tools.map((tool, index) => {
              const available = tool.status === 'available';
              return (
                <ListRow
                  key={tool.id}
                  testID={`tool-${tool.id}`}
                  title={tool.name}
                  subtitle={tool.description}
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
                      <Badge label={`M${tool.milestone}`} />
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
