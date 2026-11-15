import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';

export interface InfoRowProps {
  label: string;
  /** One value per line; technical values are shown in monospace. */
  value: string | readonly string[];
  mono?: boolean;
  testID?: string;
}

/** Label/value pair for technical details (addresses, frequencies, speeds). */
export function InfoRow({ label, value, mono = true, testID }: InfoRowProps) {
  const theme = useTheme();
  const values = typeof value === 'string' ? [value] : value;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${values.join(', ')}`}
      style={[styles.row, { paddingVertical: theme.spacing.sm, gap: theme.spacing.md }]}
    >
      <AppText variant="caption" color="textMuted" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.values}>
        {values.map(line => (
          <AppText
            key={line}
            variant={mono ? 'mono' : 'body'}
            align="right"
            selectable
            style={styles.value}
          >
            {line}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flexShrink: 0,
    maxWidth: '45%',
    paddingTop: 2,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  value: {
    flexShrink: 1,
  },
  values: {
    alignItems: 'flex-end',
    flex: 1,
  },
});
