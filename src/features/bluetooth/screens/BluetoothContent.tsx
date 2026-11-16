import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import {
  AppText,
  Button,
  Card,
  ListRow,
  ProgressBar,
  SectionHeader,
} from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { deviceMaker, guessBluetoothKind, proximity } from '../../../domain/algorithms/bluetooth';
import { useStrings } from '../../../i18n';
import {
  openAppSettings,
  openLocationSettings,
} from '../../../services/permissions/locationPermission';
import { openBluetoothSettings } from '../../../services/permissions/bluetoothPermission';
import { useBluetoothStore } from '../../../stores/bluetoothStore';
import { BT_KIND_ICON, PROXIMITY_COLOR, rssiFill } from '../components/bluetoothIcon';
import {
  refreshBluetoothState,
  requestPermission,
  startScan,
  stopScan,
} from '../services/bluetoothScan';

/** Bluetooth scanner body, shown in the Devices tab. */
export function BluetoothContent() {
  const theme = useTheme();
  const s = useStrings();
  const t = s.bluetooth;
  const navigation = useNavigation();
  const { state, scanning, devices, bonded, scanError, permission } = useBluetoothStore();

  useFocusEffect(
    useCallback(() => {
      refreshBluetoothState();
    }, []),
  );

  // The scan keeps running while a device is opened (finder); it stops when this
  // view goes away, and on its own after MAX_SCAN_MS to save battery.
  useEffect(
    () => () => {
      stopScan();
    },
    [],
  );

  const oldAndroid = Number(Platform.Version) < 31;

  let notice: React.ReactNode = null;
  if (state && !state.supported) {
    notice = (
      <AppText variant="body" color="textSecondary">
        {t.notSupported}
      </AppText>
    );
  } else if (state && !state.enabled) {
    notice = (
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading" color="warning">
          {t.off}
        </AppText>
        <Button testID="bt-open-settings" label={t.turnOn} onPress={openBluetoothSettings} />
      </View>
    );
  } else if (state && !state.scanPermission) {
    notice = (
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading">{t.permissionTitle}</AppText>
        <AppText variant="caption" color="textSecondary">
          {oldAndroid ? t.permissionBodyOld : t.permissionBody}
        </AppText>
        {permission === 'blocked' ? (
          <>
            <AppText variant="caption" color="warning">
              {t.blocked}
            </AppText>
            <Button label={t.openSettings} variant="secondary" onPress={openAppSettings} />
          </>
        ) : (
          <Button testID="bt-allow" label={t.allow} onPress={() => requestPermission()} />
        )}
      </View>
    );
  } else if (state && state.needsLocation && !state.locationEnabled) {
    notice = (
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="body" color="warning">
          {t.locationOff}
        </AppText>
        <Button label={s.permissions.openLocationSettings} onPress={openLocationSettings} />
      </View>
    );
  }

  const ready = state?.supported && state.enabled && state.scanPermission;

  return (
    <>
      <Card style={{ gap: theme.spacing.md }}>
        <AppText variant="body" color="textSecondary">
          {t.intro}
        </AppText>
        {notice}
        {ready && !notice ? (
          scanning ? (
            <Button testID="bt-stop" block variant="secondary" label={t.stop} onPress={stopScan} />
          ) : (
            <Button testID="bt-scan" block label={t.scan} onPress={() => startScan()} />
          )
        ) : null}
        {scanError ? (
          <AppText variant="caption" color="danger">
            {t.scanFailed(scanError)}
          </AppText>
        ) : null}
      </Card>

      {scanning || devices.length > 0 ? (
        <>
          <SectionHeader
            title={scanning && devices.length === 0 ? t.scanning : t.found(devices.length)}
          />
          {scanning && devices.length === 0 ? (
            <AppText variant="body" color="textSecondary">
              {t.empty}
            </AppText>
          ) : null}
          <Card padded={false}>
            {devices.map((device, index) => {
              const kind = guessBluetoothKind(device);
              const maker = deviceMaker(device);
              const near = proximity(device.rssi);
              return (
                <ListRow
                  key={device.address}
                  testID={`bt-device-${device.address}`}
                  title={device.name ?? (maker ? `${maker} · ${t.kinds[kind]}` : t.unnamed)}
                  subtitle={[t.proximity[near], maker && device.name ? maker : null, t.kinds[kind]]
                    .filter(Boolean)
                    .join(' · ')}
                  showDivider={index < devices.length - 1}
                  onPress={() =>
                    navigation.navigate('BluetoothDevice', { address: device.address })
                  }
                  leading={<Icon name={BT_KIND_ICON[kind]} color={theme.colors.accent} />}
                  trailing={
                    <View style={[styles.signal, { gap: theme.spacing.xxs }]}>
                      <AppText variant="mono" color={PROXIMITY_COLOR[near]}>
                        {`${device.rssi}`}
                      </AppText>
                      <View style={styles.bar}>
                        <ProgressBar value={rssiFill(device.rssi)} label={t.proximity[near]} />
                      </View>
                    </View>
                  }
                />
              );
            })}
          </Card>
        </>
      ) : null}

      {bonded.length > 0 ? (
        <>
          <SectionHeader title={t.paired} />
          <Card padded={false}>
            {bonded.map((device, index) => (
              <ListRow
                key={device.address}
                testID={`bt-bonded-${device.address}`}
                title={device.name ?? t.unnamed}
                subtitle={device.address}
                showDivider={index < bonded.length - 1}
                leading={<Icon name="bluetooth" color={theme.colors.textSecondary} />}
              />
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 56,
  },
  signal: {
    alignItems: 'flex-end',
  },
});
