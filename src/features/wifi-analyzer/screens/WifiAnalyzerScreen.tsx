import React from 'react';

import { useTheme } from '../../../app/theme';
import { Card, EmptyState, Screen } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { useStrings } from '../../../i18n';

export function WifiAnalyzerScreen() {
  const theme = useTheme();
  const s = useStrings();
  return (
    <Screen title={s.wifiAnalyzer.title} subtitle={s.wifiAnalyzer.subtitle}>
      <Card>
        <EmptyState
          icon={<Icon name="wifi" color={theme.colors.accent} size={28} />}
          title={s.wifiAnalyzer.comingTitle}
          description={s.wifiAnalyzer.comingBody}
        />
      </Card>
    </Screen>
  );
}
