import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';

const STYLES = [
  {label: 'Normal', key: 'header', value: false},
  {label: 'Heading 1', key: 'header', value: 1},
  {label: 'Heading 2', key: 'header', value: 2},
  {label: 'Heading 3', key: 'header', value: 3},
  {label: 'Quote', key: 'blockquote', value: true},
] as const;

interface Props {
  onStyle: (key: string, value: unknown) => void;
}

export default function StyleBar({onStyle}: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {STYLES.map(s => (
          <TouchableOpacity
            key={s.label}
            style={styles.pill}
            onPress={() => onStyle(s.key, s.value)}>
            <Text style={styles.pillText}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  row: {alignItems: 'center', paddingHorizontal: 12, gap: 8},
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
  },
  pillText: {fontSize: 13, color: '#374151', fontWeight: '500'},
});
