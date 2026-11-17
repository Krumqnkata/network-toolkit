import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { App } from '../src/app/App';
import { speedResults, type SpeedResult } from '../src/database/repositories';
import NativeExportModule from '../src/native/specs/NativeExportModule';
import NativeSpeedTestModule from '../src/native/specs/NativeSpeedTestModule';
import NativeStorageModule from '../src/native/specs/NativeStorageModule';

const speed = NativeSpeedTestModule as jest.Mocked<typeof NativeSpeedTestModule>;
const exporter = NativeExportModule as jest.Mocked<typeof NativeExportModule>;

function result(
  hoursAgo: number,
  downloadMbps: number,
  extra: Partial<SpeedResult> = {},
): SpeedResult {
  return {
    phase: 'done',
    progress: 1,
    currentMbps: null,
    downloadMbps,
    uploadMbps: downloadMbps / 2,
    idleLatencyMs: 11,
    jitterMs: 1,
    downloadLatencyMs: 20,
    uploadLatencyMs: 25,
    packetLossPercent: 0,
    bytesDownloaded: 300_000_000,
    bytesUploaded: 100_000_000,
    serverColo: 'SOF',
    serverCity: 'Sofia',
    serverCountry: 'BG',
    error: null,
    finishedAt: Date.now() - hoursAgo * 3_600_000,
    scheduled: true,
    transport: 'wifi',
    rssi: -55,
    ...extra,
  };
}

async function openReport() {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Tools, tab/ }));
  await user.press(screen.getByRole('button', { name: /^Provider Report/ }));
  return user;
}

describe('Provider report', () => {
  beforeEach(() => {
    NativeStorageModule.setSetting('update.auto', 'false');
    speed.setSchedule.mockClear();
    exporter.shareFile.mockClear();
  });

  it('compares tests with the plan, schedules tests and exports a spreadsheet', async () => {
    for (const [hours, down, extra] of [
      [2, 210, {}],
      [26, 230, {}],
      [50, 220, {}],
      [5, 60, { rssi: -80 }],
    ] as const) {
      await speedResults.add(result(hours, down, extra), Date.now() - hours * 3_600_000);
    }
    const user = await openReport();
    expect(await screen.findByTestId('report-verdict')).toHaveTextContent(/Enter your plan/);
    expect(screen.getByTestId('report-excluded')).toHaveTextContent(/1 test was left out/);

    await user.type(screen.getByTestId('report-plan-down'), '500');
    await user.type(screen.getByTestId('report-plan-up'), '100');
    await user.press(screen.getByTestId('report-save-plan'));
    await waitFor(() =>
      expect(screen.getByTestId('report-verdict')).toHaveTextContent(
        /Well below your plan.*only 44% of your plan/,
      ),
    );
    expect(screen.getByTestId('report-stats')).toHaveTextContent(/220 Mbps · 44% of plan/);
    expect(await NativeStorageModule.getSetting('report.planDown')).toBe('500');

    // The schedule is set natively (JobScheduler); the data estimate uses the last test.
    expect(screen.getByText(/Each test uses about 200 MB/)).toBeOnTheScreen();
    await user.press(screen.getByRole('radio', { name: 'Every 6 h' }));
    expect(speed.setSchedule).toHaveBeenCalledWith(6);

    await user.press(screen.getByTestId('report-share-csv'));
    const [name, csv] = exporter.shareFile.mock.calls[0]!;
    expect(name).toMatch(/^speed-report-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.split('\n')).toHaveLength(4);
    expect(csv).toContain(',220,110,11,wifi,-55,yes,500,100');
  });

  it('starts with no tests', async () => {
    await openReport();
    expect(await screen.findByTestId('report-verdict')).toHaveTextContent(/No tests yet/);
    expect(screen.queryByTestId('report-stats')).toBeNull();
  });
});
