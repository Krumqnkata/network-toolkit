import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';

import type { MainTabParamList } from '../../../app/navigation/types';
import { Screen, SegmentedControl } from '../../../components/common';
import { useStrings } from '../../../i18n';
import { BluetoothContent } from '../../bluetooth/screens/BluetoothContent';
import { LanScannerContent } from '../../lan-scanner/screens/LanScannerScreen';
import { TopologyContent } from '../../topology/screens/TopologyContent';

export type DevicesMode = 'network' | 'bluetooth' | 'map';

/** Devices tab: devices on the network (LAN scan), nearby over Bluetooth, or the network map. */
export function DevicesScreen() {
  const s = useStrings();
  const route = useRoute<RouteProp<MainTabParamList, 'Devices'>>();
  const [mode, setMode] = useState<DevicesMode>(route.params?.mode ?? 'network');

  useEffect(() => {
    if (route.params?.mode) setMode(route.params.mode);
  }, [route.params?.mode]);

  return (
    <Screen title={s.devices.title}>
      <SegmentedControl
        testID="devices-mode"
        accessibilityLabel={s.devices.title}
        options={[
          { value: 'network', label: s.devices.network },
          { value: 'bluetooth', label: s.devices.bluetooth },
          { value: 'map', label: s.devices.map },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'network' ? (
        <LanScannerContent />
      ) : mode === 'bluetooth' ? (
        <BluetoothContent />
      ) : (
        <TopologyContent />
      )}
    </Screen>
  );
}
