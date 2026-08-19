import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import Document, {STATUS_LABELS, STATUS_COLORS} from '@/db/models/Document';

interface Props {
  document: Document;
  onTap: () => void;
  onStar: () => void;
  onDuplicate: () => void;
  onMarkFinal: () => void;
  onExport: () => void;
  onDelete: () => void;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DocumentCard({
  document,
  onTap,
  onStar,
  onDuplicate,
  onMarkFinal,
  onExport,
  onDelete,
}: Props) {
  const [menuVisible, setMenuVisible] = useState(false);

  const statusColor = STATUS_COLORS[document.status] ?? '#9E9E9E';
  const statusLabel = STATUS_LABELS[document.status] ?? 'Draft';

  function closeMenu() {
    setMenuVisible(false);
  }

  function confirmDelete() {
    closeMenu();
    setTimeout(() => {
      Alert.alert(
        'Delete paper?',
        `"${document.title}" will be permanently deleted.`,
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Delete', style: 'destructive', onPress: onDelete},
        ],
      );
    }, 200);
  }

  const menuActions = [
    {
      icon: '📤',
      label: 'Export as DOCX',
      onPress: () => {
        closeMenu();
        onExport();
      },
    },
    {
      icon: '✅',
      label: 'Mark as Final',
      onPress: () => {
        closeMenu();
        onMarkFinal();
      },
    },
    {
      icon: '📋',
      label: 'Duplicate',
      onPress: () => {
        closeMenu();
        onDuplicate();
      },
    },
    {
      icon: '🗑️',
      label: 'Delete',
      destructive: true,
      onPress: confirmDelete,
    },
  ];

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={onTap}
        activeOpacity={0.82}>
        {/* Doc icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.iconGlyph}>📄</Text>
        </View>

        {/* Text content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={styles.meta}>
            {timeAgo(document.updatedAt)}
            {document.wordCount > 0 ? ` · ${document.wordCount} words` : ''}
          </Text>
        </View>

        {/* Status badge */}
        <View style={[styles.badge, {backgroundColor: `${statusColor}18`}]}>
          <Text style={[styles.badgeText, {color: statusColor}]}>
            {statusLabel}
          </Text>
        </View>

        {/* Star */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onStar}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text
            style={[styles.starIcon, document.starred && styles.starActive]}>
            {document.starred ? '★' : '☆'}
          </Text>
        </TouchableOpacity>

        {/* More */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setMenuVisible(true)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.moreIcon}>⋯</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Context bottom-sheet — tap backdrop to dismiss */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMenu}>
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Doc title */}
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={styles.sheetMeta}>
            {timeAgo(document.updatedAt)}
            {document.wordCount > 0 ? ` · ${document.wordCount} words` : ''}
          </Text>

          <View style={styles.divider} />

          {/* Actions */}
          {menuActions.map(action => (
            <TouchableOpacity
              key={action.label}
              style={styles.action}
              onPress={action.onPress}
              activeOpacity={0.7}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text
                style={[
                  styles.actionLabel,
                  action.destructive && styles.actionDestructive,
                ]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={closeMenu}
            activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* ── Card ─────────────────────────────────────────────── */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0f0f5',
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 1},
  },
  iconWrap: {
    width: 42,
    height: 50,
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGlyph: {fontSize: 22},
  content: {flex: 1},
  title: {fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 3},
  meta: {fontSize: 12, color: '#9ca3af'},
  badge: {paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20},
  badgeText: {fontSize: 11, fontWeight: '700'},
  iconBtn: {padding: 4},
  starIcon: {fontSize: 18, color: '#d1d5db'},
  starActive: {color: '#f59e0b'},
  moreIcon: {fontSize: 20, color: '#9ca3af'},

  /* ── Bottom-sheet ──────────────────────────────────────── */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    elevation: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  sheetMeta: {fontSize: 12, color: '#9ca3af', marginBottom: 12},
  divider: {height: 1, backgroundColor: '#f3f4f6', marginBottom: 8},
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  actionIcon: {fontSize: 20, width: 28, textAlign: 'center'},
  actionLabel: {fontSize: 15, color: '#111827', fontWeight: '500'},
  actionDestructive: {color: '#ef4444'},
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelText: {fontSize: 15, fontWeight: '600', color: '#6b7280'},
});
