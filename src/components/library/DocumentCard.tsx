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
import Ionicons from 'react-native-vector-icons/Ionicons';
import Document, {STATUS_LABELS} from '@/db/models/Document';
import {useTheme} from '@/theme/theme';

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
  const {palette, elevation} = useTheme();

  const statusLabel = STATUS_LABELS[document.status] ?? 'Draft';
  const statusColor: Record<string, string> = {
    draft: palette.textMuted,
    aiReady: palette.success,
    analyzing: palette.accent,
    finalDraft: palette.star,
  };
  const statusBg: Record<string, string> = {
    draft: palette.surfaceAlt,
    aiReady: palette.successSubtle,
    analyzing: palette.accentSubtle,
    finalDraft: palette.warningSubtle,
  };

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
      icon: 'share-outline',
      label: 'Export as DOCX',
      onPress: () => {
        closeMenu();
        onExport();
      },
    },
    {
      icon: 'checkmark-done-outline',
      label: 'Mark as Final',
      onPress: () => {
        closeMenu();
        onMarkFinal();
      },
    },
    {
      icon: 'copy-outline',
      label: 'Duplicate',
      onPress: () => {
        closeMenu();
        onDuplicate();
      },
    },
    {
      icon: 'trash-outline',
      label: 'Delete',
      destructive: true,
      onPress: confirmDelete,
    },
  ];

  return (
    <>
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
          elevation.card(palette.shadow),
        ]}
        onPress={onTap}
        activeOpacity={0.82}>
        {/* Doc icon */}
        <View
          style={[styles.iconWrap, {backgroundColor: palette.accentSubtle}]}>
          <Ionicons name="document-text" size={20} color={palette.accent} />
        </View>

        {/* Text content */}
        <View style={styles.content}>
          <Text style={[styles.title, {color: palette.text}]} numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={[styles.meta, {color: palette.textMuted}]}>
            {timeAgo(document.updatedAt)}
            {document.wordCount > 0 ? ` · ${document.wordCount} words` : ''}
          </Text>
        </View>

        {/* Status badge */}
        <View
          style={[
            styles.badge,
            {
              backgroundColor: statusBg[document.status] ?? palette.surfaceAlt,
            },
          ]}>
          <Text
            style={[
              styles.badgeText,
              {color: statusColor[document.status] ?? palette.textMuted},
            ]}>
            {statusLabel}
          </Text>
        </View>

        {/* Star */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onStar}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Ionicons
            name={document.starred ? 'star' : 'star-outline'}
            size={19}
            color={document.starred ? palette.star : palette.textMuted}
          />
        </TouchableOpacity>

        {/* More */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setMenuVisible(true)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={palette.textMuted}
          />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Context bottom-sheet — tap backdrop to dismiss */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMenu}>
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={[styles.backdrop, {backgroundColor: palette.scrim}]} />
        </TouchableWithoutFeedback>

        <View style={[styles.sheet, {backgroundColor: palette.surface}]}>
          {/* Handle */}
          <View
            style={[styles.sheetHandle, {backgroundColor: palette.border}]}
          />

          {/* Doc title */}
          <Text
            style={[styles.sheetTitle, {color: palette.text}]}
            numberOfLines={1}>
            {document.title}
          </Text>
          <Text style={[styles.sheetMeta, {color: palette.textMuted}]}>
            {timeAgo(document.updatedAt)}
            {document.wordCount > 0 ? ` · ${document.wordCount} words` : ''}
          </Text>

          <View style={[styles.divider, {backgroundColor: palette.border}]} />

          {/* Actions */}
          {menuActions.map(action => (
            <TouchableOpacity
              key={action.label}
              style={styles.action}
              onPress={action.onPress}
              activeOpacity={0.7}>
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? palette.danger : palette.textSoft}
                style={styles.actionIcon}
              />
              <Text
                style={[
                  styles.actionLabel,
                  {color: action.destructive ? palette.danger : palette.text},
                ]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelBtn, {backgroundColor: palette.surfaceAlt}]}
            onPress={closeMenu}
            activeOpacity={0.7}>
            <Text style={[styles.cancelText, {color: palette.textSoft}]}>
              Cancel
            </Text>
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
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  iconWrap: {
    width: 42,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {flex: 1},
  title: {fontSize: 15, fontWeight: '600', marginBottom: 3},
  meta: {fontSize: 12, fontVariant: ['tabular-nums']},
  badge: {paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999},
  badgeText: {fontSize: 11, fontWeight: '700'},
  iconBtn: {padding: 4},

  /* ── Bottom-sheet ──────────────────────────────────────── */
  backdrop: {...StyleSheet.absoluteFillObject},
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {fontSize: 16, fontWeight: '700', marginBottom: 2},
  sheetMeta: {fontSize: 12, marginBottom: 12},
  divider: {height: StyleSheet.hairlineWidth, marginBottom: 8},
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 14,
  },
  actionIcon: {width: 28, textAlign: 'center'},
  actionLabel: {fontSize: 15, fontWeight: '500'},
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {fontSize: 15, fontWeight: '600'},
});
