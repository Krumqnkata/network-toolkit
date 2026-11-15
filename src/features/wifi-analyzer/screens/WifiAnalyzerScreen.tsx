import React from 'react';

import { useTheme } from '../../../app/theme';
import { Card, EmptyState, Screen } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';

export function WifiAnalyzerScreen() {
  const theme = useTheme();
  return (
    <Screen title="Wi-Fi Analyzer" subtitle="Nearby networks, channels and signal strength.">
      <Card>
        <EmptyState
          icon={<Icon name="wifi" color={theme.colors.accent} size={28} />}
          title="Scanning is not available yet"
          description="Network scanning across 2.4, 5 and 6 GHz with channel and overlap analysis ships in milestone 4. Location and nearby-device permissions will be requested only when you start a scan."
        />
      </Card>
    </Screen>
  );
}
