import type { IconName } from '../../../components/icons/Icon';
import type { DeviceKind } from '../../../domain/algorithms/devices';

export const KIND_ICON: Record<DeviceKind, IconName> = {
  router: 'router',
  switch: 'lan',
  phone: 'phone',
  computer: 'computer',
  printer: 'printer',
  tv: 'tv',
  speaker: 'speaker',
  nas: 'storage',
  camera: 'camera',
  iot: 'chip',
  unknown: 'device',
};
