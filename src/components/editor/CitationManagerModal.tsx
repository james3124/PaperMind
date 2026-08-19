import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import {SourcePaper} from '@/services/literatureSearch';
import {formatMarker, formatReference} from '@/services/citationFormat';

interface Props {
  visible: boolean;
  sources: SourcePaper[];
  style: string;
  edition: string;
  onReplace: (index: number) => void;
  onDismiss: () => void;
}

export default function CitationManagerModal({
  visible,
  sources,
  style,
  edition,
  onReplace,
  onDismiss,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Citations</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.list}>
            {sources.length === 0 && (
              <Text style={styles.empty}>
                No sources yet. Sources are attached when a paper is generated.
              </Text>
            )}
            {sources.map((paper, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.badge}>
                  {formatMarker(paper, style, i + 1)}
                </Text>
                <View style={styles.rowBody}>
                  <Text style={styles.titleText} numberOfLines={2}>
                    {paper.title}
                  </Text>
                  <Text style={styles.reference} numberOfLines={3}>
                    {formatReference(paper, style, edition, i + 1)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.replaceBtn}
                  onPress={() => onReplace(i)}>
                  <Text style={styles.replaceText}>Replace</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
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
    padding: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {fontSize: 18, fontWeight: '700'},
  close: {fontSize: 18, color: '#6b7280'},
  list: {flex: 1},
  empty: {fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: 24},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  badge: {
    backgroundColor: '#eef2ff',
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  rowBody: {flex: 1},
  titleText: {fontSize: 14, color: '#111827', fontWeight: '500'},
  reference: {fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 16},
  replaceBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  replaceText: {fontSize: 12, color: '#fff', fontWeight: '600'},
});
