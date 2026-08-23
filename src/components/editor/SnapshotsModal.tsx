import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from 'react-native';

export interface SnapshotRow {
  id: string;
  wordCount: number;
  createdAt: number;
  label?: string;
}

interface Props {
  visible: boolean;
  snapshots: SnapshotRow[];
  busy?: boolean;
  onSnapshotNow: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onDismiss: () => void;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) {
    return 'just now';
  }
  if (min < 60) {
    return `${min} min ago`;
  }
  const hours = Math.floor(min / 60);
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return new Date(ts).toLocaleString();
}

export default function SnapshotsModal({
  visible,
  snapshots,
  busy = false,
  onSnapshotNow,
  onRestore,
  onDelete,
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
            <Text style={styles.title}>Version history</Text>
            <TouchableOpacity onPress={onDismiss}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.snapshotBtn, busy && styles.snapshotBtnDisabled]}
            onPress={onSnapshotNow}
            disabled={busy}>
            <Text style={styles.snapshotText}>
              {busy ? 'Snapshotting…' : 'Snapshot now'}
            </Text>
          </TouchableOpacity>

          <FlatList
            data={snapshots}
            keyExtractor={item => item.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>No snapshots yet</Text>
            }
            renderItem={({item}) => (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.dateText}>
                    {formatRelative(item.createdAt)}
                  </Text>
                  {item.label ? (
                    <Text style={styles.labelText}>{item.label}</Text>
                  ) : null}
                  <Text style={styles.wordCount}>
                    {item.wordCount.toLocaleString()} words
                  </Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => onRestore(item.id)}>
                    <Text style={styles.restoreText}>Restore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDelete(item.id)}>
                    <Text style={styles.deleteText}>🗑 Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    marginBottom: 12,
  },
  title: {fontSize: 18, fontWeight: '700', color: '#111827'},
  close: {fontSize: 18, color: '#6b7280'},
  snapshotBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  snapshotBtnDisabled: {opacity: 0.5},
  snapshotText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  list: {flex: 1},
  empty: {textAlign: 'center', color: '#9ca3af', marginTop: 24, fontSize: 14},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowInfo: {flex: 1},
  dateText: {fontSize: 14, fontWeight: '600', color: '#111827'},
  labelText: {fontSize: 12, color: '#374151', marginTop: 2},
  wordCount: {fontSize: 12, color: '#9ca3af', marginTop: 2},
  actions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  restoreBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  restoreText: {color: '#fff', fontSize: 13, fontWeight: '600'},
  deleteBtn: {paddingHorizontal: 4, paddingVertical: 6},
  deleteText: {color: '#ef4444', fontSize: 13, fontWeight: '600'},
});
