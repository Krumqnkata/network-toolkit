import React, { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import {
  AppText,
  Badge,
  Button,
  Card,
  InfoRow,
  ProgressBar,
  SectionHeader,
  TextField,
  type BadgeTone,
} from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import type { StoredRecord } from '../../../database/storage';
import {
  analyzeSurvey,
  rateRoom,
  roomBand,
  type RoomMeasurement,
  type RoomRating,
  type Survey,
} from '../../../domain/algorithms/survey';
import { signalPercent } from '../../../domain/algorithms/wifi';
import {
  formatDateTime,
  useLanguage,
  useStrings,
  type Language,
  type Strings,
} from '../../../i18n';
import { logError } from '../../../utils/errors';
import { ErrorNotice, FormCard, ToolFrame } from '../../network-tools/components/ToolFrame';
import { finishSurvey, measureRoom, removeRoom, surveys, useSurveyStore } from '../services/survey';

const RATING_COLOR: Record<RoomRating, keyof ThemeColors> = {
  excellent: 'success',
  good: 'success',
  fair: 'warning',
  weak: 'danger',
  poor: 'danger',
  unknown: 'textMuted',
};
const RATING_TONE: Record<RoomRating, BadgeTone> = {
  excellent: 'success',
  good: 'success',
  fair: 'warning',
  weak: 'danger',
  poor: 'danger',
  unknown: 'neutral',
};

/** "Kitchen", "Kitchen and Bedroom", "Kitchen, Office and Bedroom". */
export function joinRooms(rooms: readonly string[], and: string): string {
  if (rooms.length <= 1) return rooms[0] ?? '';
  return `${rooms.slice(0, -1).join(', ')} ${and} ${rooms[rooms.length - 1]}`;
}

function roomLine(room: RoomMeasurement, s: Strings): string {
  const t = s.survey;
  const band = roomBand(room);
  return [
    room.rssi !== null ? `${room.rssi} dBm` : null,
    band ? `${band} GHz` : null,
    room.apVendor,
    room.linkSpeedMbps !== null ? `${room.linkSpeedMbps} Mbps` : null,
    room.routerMs !== null ? t.router(Math.round(room.routerMs)) : null,
    room.routerLossPercent ? t.lost(room.routerLossPercent) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Plain-text report of a survey, for sharing. */
export function formatSurveyReport(survey: Survey, s: Strings, language: Language): string {
  const t = s.survey;
  const analysis = analyzeSurvey(survey);
  return [
    t.reportTitle,
    `${formatDateTime(survey.createdAt, language)}${survey.ssid ? ` · ${survey.ssid}` : ''}`,
    '',
    ...survey.rooms.map(
      room =>
        `${room.room}: ${t.ratings[analysis.ratings[room.room] ?? 'unknown']} — ${roomLine(
          room,
          s,
        )}`,
    ),
    '',
    `${t.adviceTitle}:`,
    ...analysis.advice.map(item => {
      const text = t.advice[item.id];
      return `- ${text.title}. ${text.body(joinRooms(item.rooms, t.and))}`;
    }),
  ].join('\n');
}

export function WifiSurveyScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.survey;
  const { survey, measuring, progress, error } = useSurveyStore();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredRecord<Survey>[]>([]);

  const loadHistory = () =>
    surveys
      .list(10)
      .then(setHistory)
      .catch(caught => logError('survey', caught));

  useEffect(() => {
    loadHistory();
  }, []);

  const measured = new Set(survey?.rooms.map(room => room.room) ?? []);
  const suggestions = t.suggestions.filter(room => !measured.has(room));
  const analysis = survey ? analyzeSurvey(survey) : null;

  const onMeasure = () => {
    const room = name.trim();
    if (!room) {
      setNameError(t.nameNeeded);
      return;
    }
    setNameError(null);
    measureRoom(room)
      .then(() => setName(''))
      .catch(() => {});
  };

  return (
    <ToolFrame toolId="wifi-survey">
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        <TextField
          testID="survey-room"
          label={t.roomName}
          placeholder={t.roomPlaceholder}
          value={name}
          onChangeText={value => {
            setName(value);
            setNameError(null);
          }}
          onSubmitEditing={onMeasure}
          editable={!measuring}
          error={nameError}
        />
        <View style={[styles.chips, { gap: theme.spacing.xs }]}>
          {suggestions.map(room => (
            <Pressable
              key={room}
              testID={`survey-suggestion-${room}`}
              accessibilityRole="button"
              accessibilityLabel={room}
              disabled={!!measuring}
              onPress={() => {
                setName(room);
                setNameError(null);
              }}
              style={[
                styles.chip,
                {
                  borderColor: name === room ? theme.colors.accent : theme.colors.border,
                  backgroundColor: name === room ? theme.colors.accentMuted : 'transparent',
                  borderRadius: theme.radius.pill,
                  paddingHorizontal: theme.spacing.md,
                },
              ]}
            >
              <AppText variant="caption" color={name === room ? 'accent' : 'textSecondary'}>
                {room}
              </AppText>
            </Pressable>
          ))}
        </View>
        {measuring ? (
          <ProgressBar value={progress} label={t.measuring(measuring)} />
        ) : (
          <Button testID="survey-measure" label={t.measure} onPress={onMeasure} block />
        )}
      </FormCard>

      {error ? (
        error.message === 'not-wifi' ? (
          <Card>
            <AppText testID="survey-not-wifi" color="textSecondary">
              {t.notWifi}
            </AppText>
          </Card>
        ) : (
          <ErrorNotice error={error} />
        )
      ) : null}

      {survey && analysis ? (
        <>
          <SectionHeader title={t.rooms} />
          <Card padded={false}>
            {survey.rooms.map((room, index) => {
              const rating = analysis.ratings[room.room] ?? rateRoom(room);
              const color = theme.colors[RATING_COLOR[rating]];
              return (
                <View
                  key={room.room}
                  testID={`survey-room-${room.room}`}
                  accessible
                  accessibilityLabel={`${room.room}: ${t.ratings[rating]}, ${roomLine(room, s)}`}
                  style={[
                    styles.room,
                    {
                      padding: theme.spacing.lg,
                      gap: theme.spacing.xs,
                      borderBottomColor: theme.colors.border,
                      borderBottomWidth:
                        index < survey.rooms.length - 1 ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <View style={[styles.row, { gap: theme.spacing.sm }]}>
                    <AppText variant="heading" style={styles.flex}>
                      {room.room}
                    </AppText>
                    <Pressable
                      testID={`survey-remove-${room.room}`}
                      accessibilityRole="button"
                      accessibilityLabel={t.remove(room.room)}
                      hitSlop={10}
                      disabled={!!measuring}
                      onPress={() => removeRoom(room.room)}
                    >
                      <Icon name="close" color={theme.colors.textMuted} size={18} />
                    </Pressable>
                  </View>
                  {/* Badges on their own line, so long Bulgarian labels never squeeze the name. */}
                  <View style={[styles.row, styles.wrap, { gap: theme.spacing.xs }]}>
                    <Badge label={t.ratings[rating]} tone={RATING_TONE[rating]} />
                    {analysis.best === room.room && survey.rooms.length > 1 ? (
                      <Badge label={t.best} tone="success" />
                    ) : null}
                    {analysis.worst === room.room ? <Badge label={t.worst} tone="danger" /> : null}
                  </View>
                  <View
                    style={[
                      styles.track,
                      {
                        backgroundColor: theme.colors.surfaceRaised,
                        borderRadius: theme.radius.pill,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.fill,
                        {
                          width: `${
                            room.rssi !== null ? Math.max(4, signalPercent(room.rssi)) : 0
                          }%`,
                          backgroundColor: color,
                          borderRadius: theme.radius.pill,
                        },
                      ]}
                    />
                  </View>
                  <AppText variant="caption" color="textSecondary">
                    {roomLine(room, s)}
                  </AppText>
                </View>
              );
            })}
          </Card>

          <SectionHeader title={t.adviceTitle} />
          <Card testID="survey-advice">
            <View style={{ gap: theme.spacing.md }}>
              {analysis.advice.map(item => {
                const text = t.advice[item.id];
                return (
                  <View key={item.id} testID={`survey-advice-${item.id}`} style={{ gap: 2 }}>
                    <AppText variant="heading">{text.title}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {text.body(joinRooms(item.rooms, t.and))}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </Card>

          <View style={[styles.row, styles.wrap, { gap: theme.spacing.sm }]}>
            <Button
              testID="survey-share"
              label={t.share}
              variant="secondary"
              onPress={() => Share.share({ message: formatSurveyReport(survey, s, language) })}
            />
            <Button
              testID="survey-finish"
              label={t.finish}
              variant="secondary"
              onPress={() => finishSurvey().then(loadHistory)}
            />
          </View>
        </>
      ) : null}

      {history.length > 0 ? (
        <>
          <SectionHeader title={t.history} />
          <Card>
            {history.map(({ id, data }) => {
              const past = analyzeSurvey(data);
              const weak = Object.values(past.ratings).filter(
                rating => rating === 'weak' || rating === 'poor',
              ).length;
              return (
                <InfoRow
                  key={id}
                  label={`${formatDateTime(data.createdAt, language)}${
                    data.ssid ? ` · ${data.ssid}` : ''
                  }`}
                  value={t.historyRow(data.rooms.length, weak)}
                  mono={false}
                />
              );
            })}
          </Card>
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    paddingVertical: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fill: {
    height: '100%',
  },
  flex: {
    flex: 1,
  },
  room: {
    flexDirection: 'column',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
  wrap: {
    flexWrap: 'wrap',
  },
});
