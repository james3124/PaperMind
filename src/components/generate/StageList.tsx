import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '@/theme/theme';

interface Props {
  stages: string[];
  currentStage: number;
  completedStages: Set<number>;
  errorStages: Set<number>;
}

export default function StageList({
  stages,
  currentStage,
  completedStages,
  errorStages,
}: Props) {
  const {palette} = useTheme();

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {stages.map((label, i) => {
        const num = i + 1;
        const done = completedStages.has(num);
        const active = currentStage === num && !done;
        const errored = errorStages.has(num);
        const last = i === stages.length - 1;

        return (
          <View key={num} style={styles.rowWrap}>
            {!last && (
              <View
                style={[
                  styles.rail,
                  styles.railSpan,
                  {
                    backgroundColor:
                      done || (errored && !done)
                        ? palette.border
                        : palette.surfaceAlt,
                  },
                ]}
              />
            )}
            <View style={styles.row}>
              <View
                style={[
                  styles.icon,
                  !done &&
                    !active &&
                    !errored && {
                      backgroundColor: palette.surfaceAlt,
                    },
                ]}>
                {done && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={palette.success}
                  />
                )}
                {active && (
                  <ActivityIndicator size="small" color={palette.accent} />
                )}
                {errored && !done && (
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={palette.danger}
                  />
                )}
                {!done && !active && !errored && (
                  <Text style={[styles.pending, {color: palette.textMuted}]}>
                    {num}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  {color: palette.textMuted},
                  done && {color: palette.textSoft},
                  active && [styles.activeLabel, {color: palette.accent}],
                  errored && !done && {color: palette.danger},
                ]}>
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  rowWrap: {position: 'relative'},
  rail: {
    position: 'absolute',
    left: 17,
    width: 2,
    borderRadius: 1,
  },
  railSpan: {top: 28, bottom: -6},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 14,
    backgroundColor: 'transparent',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pending: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  label: {fontSize: 14, flex: 1},
  activeLabel: {fontWeight: '600'},
});
