import React, {useState} from 'react';
import {View, Text, Modal, TouchableOpacity, StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useTheme} from '@/theme/theme';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';

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
  const {palette} = useTheme();

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
      <View style={[styles.overlay, {backgroundColor: palette.scrim}]}>
        <View style={[styles.sheet, {backgroundColor: palette.surface}]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, {backgroundColor: palette.border}]} />
          </View>
          <View style={styles.header}>
            <Text style={[styles.title, {color: palette.text}]}>
              Citation style
            </Text>
            <TouchableOpacity
              onPress={onDismiss}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Ionicons name="close" size={22} color={palette.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, {color: palette.textSoft}]}>
            Choose the citation format for your paper's references.
          </Text>

          {/* Style chips */}
          <View style={styles.chipRow}>
            {STYLES.map(s => (
              <Chip
                key={s.id}
                label={s.label}
                selected={style === s.id}
                onPress={() => handleStyleChange(s.id)}
              />
            ))}
          </View>

          {/* Edition chips */}
          {editions && (
            <>
              <Text style={[styles.editionLabel, {color: palette.textSoft}]}>
                Edition
              </Text>
              <View style={styles.chipRow}>
                {editions.map(ed => (
                  <Chip
                    key={ed}
                    label={ed}
                    selected={edition === ed}
                    onPress={() => setEdition(ed)}
                  />
                ))}
              </View>
            </>
          )}

          <Button
            label={`Use ${styleName}${edition ? ` · ${edition}` : ''}`}
            variant="primary"
            onPress={() => onConfirm({style, edition})}
            style={styles.confirmButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  handleWrap: {alignItems: 'center', marginBottom: 14},
  handle: {width: 36, height: 4, borderRadius: 2},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {fontSize: 19, fontWeight: '700'},
  subtitle: {fontSize: 13, lineHeight: 19, marginBottom: 18},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  editionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 8,
  },
  confirmButton: {marginTop: 12},
});
