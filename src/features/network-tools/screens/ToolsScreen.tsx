import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { SettingsButton } from '../../../components/common/SettingsButton';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { Badge, Card, ListRow, Screen, SectionHeader } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { useStrings } from '../../../i18n';
import { toolsByCategory, type ToolId } from '../toolCatalog';

export function ToolsScreen() {
  const theme = useTheme();
  const s = useStrings();
  const navigation = useNavigation();
  const groups = toolsByCategory();

  // The speed test and the LAN scanner have their own tabs.
  const openTool = (toolId: ToolId) => {
    if (toolId === 'speed-test') navigation.navigate('Main', { screen: 'SpeedTest' });
    else if (toolId === 'lan-scanner') {
      navigation.navigate('Main', { screen: 'Devices', params: { mode: 'network' } });
    } else if (toolId === 'bluetooth-scanner') {
      navigation.navigate('Main', { screen: 'Devices', params: { mode: 'bluetooth' } });
    } else if (toolId === 'network-map') {
      navigation.navigate('Main', { screen: 'Devices', params: { mode: 'map' } });
    } else navigation.navigate('Tool', { toolId });
  };

  return (
    <Screen title={s.tools.title} subtitle={s.tools.subtitle} headerAction={<SettingsButton />}>
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
                  onPress={available ? () => openTool(tool.id) : undefined}
                  showDivider={index < tools.length - 1}
                  leading={
                    <View
                      style={[
                        styles.iconBox,
                        {
                          backgroundColor: theme.colors.accentMuted,
                          borderRadius: theme.radius.md,
                        },
                      ]}
                    >
                      <Icon
                        name={tool.icon}
                        color={available ? theme.colors.accent : theme.colors.textMuted}
                        size={20}
                      />
                    </View>
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

const styles = StyleSheet.create({
  iconBox: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
