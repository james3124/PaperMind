import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';

interface Props {
  stages:          string[];
  currentStage:    number;
  completedStages: Set<number>;
  errorStages:     Set<number>;
}

export default function StageList({ stages, currentStage, completedStages, errorStages }: Props) {
  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {stages.map((label, i) => {
        const num     = i + 1;
        const done    = completedStages.has(num);
        const active  = currentStage === num && !done;
        const errored = errorStages.has(num);

        return (
          <View key={num} style={[styles.row, active && styles.activeRow]}>
            <View style={styles.icon}>
              {done    && <Text style={styles.check}>✓</Text>}
              {active  && <ActivityIndicator size="small" color="#6366f1" />}
              {errored && !done && <Text style={styles.errorIcon}>✗</Text>}
              {!done && !active && !errored && (
                <Text style={styles.pending}>{num}</Text>
              )}
            </View>
            <Text
              style={[
                styles.label,
                done    && styles.doneLabel,
                active  && styles.activeLabel,
                errored && !done && styles.errorLabel,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:     { flex: 1 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, gap: 14 },
  activeRow:  { backgroundColor: '#f0f0ff', borderRadius: 8, marginHorizontal: -4 },
  icon:       { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  check:      { fontSize: 18, color: '#22c55e' },
  errorIcon:  { fontSize: 16, color: '#ef4444' },
  pending:    { fontSize: 13, color: '#d1d5db', fontWeight: '600' },
  label:      { fontSize: 14, color: '#9ca3af', flex: 1 },
  doneLabel:  { color: '#374151' },
  activeLabel:{ color: '#6366f1', fontWeight: '600' },
  errorLabel: { color: '#ef4444' },
});