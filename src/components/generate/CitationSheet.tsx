import React, {useState} from 'react';
import {View, Text, Modal, TouchableOpacity, StyleSheet} from 'react-native';

export interface CitationChoice {
  style: string;
  edition: string;
}

const STYLES = [
  {id: 'apa', label: 'APA'},
  {id: 'mla', label: 'MLA'},
  {id: 'ieee', label: 'IEEE'},
  {id: 'chicago', label: 'Chicago'},
  {id: 'harvard', label: 'Harvard'},
  {id: 'vancouver', label: 'Vancouver'},
] as const;

const EDITIONS: Record<string, string[]> = {
  apa: ['6th', '7th'],
  mla: ['8th', '9th'],
  chicago: ['16th', '17th'],
};

const DEFAULT_EDITIONS: Record<string, string> = {
  apa: '7th',
  mla: '9th',
  chicago: '17th',
};

interface Props {
  visible: boolean;
  initialStyle?: string;
  initialEdition?: string;
  onConfirm: (choice: CitationChoice) => void;
  onDismiss: () => void;
}

export default function CitationSheet({
  visible,
  initialStyle = 'apa',
  initialEdition = '7th',
  onConfirm,
  onDismiss,
}: Props) {
  const [style, setStyle] = useState(initialStyle);
  const [edition, setEdition] = useState(initialEdition);

  function handleStyleChange(id: string) {
    setStyle(id);
    setEdition(DEFAULT_EDITIONS[id] ?? '');
  }

  const editions = EDITIONS[style];
  const styleName =
    STYLES.find(s => s.id === style)?.label ?? style.toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Citation Style</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Choose the citation format for your paper's references.
          </Text>

          {/* Style chips */}
          <View style={styles.chipRow}>
            {STYLES.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, style === s.id && styles.chipSelected]}
                onPress={() => handleStyleChange(s.id)}>
                <Text
                  style={[
                    styles.chipText,
                    style === s.id && styles.chipTextSelected,
                  ]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Edition chips */}
          {editions && (
            <>
              <Text style={styles.editionLabel}>Edition</Text>
              <View style={styles.chipRow}>
                {editions.map(ed => (
                  <TouchableOpacity
                    key={ed}
                    style={[styles.chip, edition === ed && styles.chipSelected]}
                    onPress={() => setEdition(ed)}>
                    <Text
                      style={[
                        styles.chipText,
                        edition === ed && styles.chipTextSelected,
                      ]}>
                      {ed}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => onConfirm({style, edition})}>
            <Text style={styles.confirmText}>
              Use {styleName}
              {edition ? ` · ${edition}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {fontSize: 18, fontWeight: '700', color: '#111827'},
  close: {fontSize: 18, color: '#6b7280'},
  subtitle: {fontSize: 13, color: '#6b7280', marginBottom: 16},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipSelected: {backgroundColor: '#6366f1', borderColor: '#6366f1'},
  chipText: {fontSize: 14, color: '#374151', fontWeight: '500'},
  chipTextSelected: {color: '#fff'},
  editionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  confirmButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
