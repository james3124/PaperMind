import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';

interface Heading {
  level: number;
  text:  string;
  index: number;
}

interface Props {
  headings:  Heading[];
  onJump:    (index: number) => void;
  onClose:   () => void;
}

export default function OutlinePanel({ headings, onJump, onClose }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Outline</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.list}>
        {headings.length === 0 ? (
          <Text style={styles.empty}>No headings yet.{'\n'}Add headings to see them here.</Text>
        ) : (
          headings.map((h, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.item, { paddingLeft: 12 + (h.level - 1) * 16 }]}
              onPress={() => { onJump(h.index); onClose(); }}
            >
              <Text
                style={[styles.itemText, h.level === 1 && styles.h1Text]}
                numberOfLines={2}
              >
                {h.text}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 240, backgroundColor: '#f9fafb', borderRightWidth: 1, borderRightColor: '#e5e7eb', zIndex: 100 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title:     { fontSize: 15, fontWeight: '700', color: '#111827' },
  close:     { fontSize: 16, color: '#6b7280' },
  list:      { flex: 1 },
  item:      { paddingVertical: 10, paddingRight: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemText:  { fontSize: 13, color: '#374151' },
  h1Text:    { fontWeight: '700' },
  empty:     { padding: 16, fontSize: 13, color: '#9ca3af', lineHeight: 20 },
});