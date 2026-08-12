import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';

const AI_ACTIONS = [
  { id: 'rewrite',       label: '✏️ Rewrite',       prompt: 'Rewrite the following text to improve clarity and flow while preserving the academic tone:' },
  { id: 'grammar',       label: '✓ Fix Grammar',     prompt: 'Fix all grammar, punctuation, and spelling errors in the following text:' },
  { id: 'explain',       label: '💡 Explain',         prompt: 'Explain the following academic text in simpler terms:' },
  { id: 'summarize',     label: '📝 Summarize',       prompt: 'Write a concise academic summary of the following text:' },
  { id: 'expand',        label: '↔ Expand',           prompt: 'Expand the following text with more academic detail and supporting evidence:' },
  { id: 'shorten',       label: '↕ Shorten',          prompt: 'Shorten the following text while preserving the key academic points:' },
  { id: 'academicTone',  label: '🎓 Academic Tone',   prompt: 'Rewrite the following text in a formal academic tone:' },
] as const;

interface Props {
  visible:        boolean;
  selectedText:   string;
  onAction:       (prompt: string, selectedText: string) => void;
  onDismiss:      () => void;
}

export default function AiPanel({ visible, selectedText, onAction, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>AI Actions</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.preview} numberOfLines={2}>
            "{selectedText.slice(0, 120)}{selectedText.length > 120 ? '…' : ''}"
          </Text>
          <ScrollView style={styles.list}>
            {AI_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionRow}
                onPress={() => { onAction(action.prompt, selectedText); onDismiss(); }}
              >
                <Text style={styles.actionText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title:      { fontSize: 18, fontWeight: '700' },
  close:      { fontSize: 18, color: '#6b7280' },
  preview:    { fontSize: 13, color: '#6b7280', fontStyle: 'italic', marginBottom: 16, backgroundColor: '#f9fafb', padding: 10, borderRadius: 8 },
  list:       { flex: 1 },
  actionRow:  { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  actionText: { fontSize: 15, color: '#111827' },
});