import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {PaperSize} from '@/stores/settingsStore';

type Tab = 'Home' | 'Insert' | 'Layout' | 'References' | 'Review' | 'View';
const TABS: Tab[] = [
  'Home',
  'Insert',
  'Layout',
  'References',
  'Review',
  'View',
];

const PAPER_SIZES: {key: PaperSize; label: string}[] = [
  {key: 'a4', label: 'A4'},
  {key: 'letter', label: 'Letter'},
  {key: 'a5', label: 'A5'},
  {key: 'a3', label: 'A3'},
];

interface Props {
  currentFormat: Record<string, unknown>;
  paperSize: PaperSize;
  onFormat: (key: string, value: unknown) => void;
  onInsert: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFindReplace: () => void;
  onOutline: () => void;
  onPaperSize: (size: PaperSize) => void;
  onOpenColor: (kind: 'color' | 'background') => void;
  onSpacing: (value: string | false) => void;
  onInsertTable: () => void;
  onInsertImage: () => void;
  onInsertPageBreak: () => void;
  onOpenLink: () => void;
  onAiAction: () => void;
  onCitations: () => void;
  onChat: () => void;
  wordCount: number;
}

export default function TabToolbar({
  currentFormat,
  paperSize,
  onFormat,
  onInsert,
  onUndo,
  onRedo,
  onFindReplace,
  onOutline,
  onPaperSize,
  onOpenColor,
  onSpacing,
  onInsertTable,
  onInsertImage,
  onInsertPageBreak,
  onOpenLink,
  onAiAction,
  onCitations,
  onChat,
  wordCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Home');

  const isBold = !!currentFormat.bold;
  const isItalic = !!currentFormat.italic;
  const isUnderline = !!currentFormat.underline;
  const isStrike = !!currentFormat.strike;

  function Btn({
    icon,
    label,
    active,
    onPress,
  }: {
    icon?: string;
    label?: string;
    active?: boolean;
    onPress: () => void;
  }) {
    return (
      <TouchableOpacity
        style={[styles.btn, active && styles.btnActive]}
        onPress={onPress}>
        {icon ? (
          <Ionicons name={icon} size={18} color={active ? '#fff' : '#374151'} />
        ) : (
          <Text style={[styles.btnText, active && styles.btnTextActive]}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  function renderHomeTab() {
    return (
      <>
        <Btn
          icon="text"
          active={isBold}
          onPress={() => onFormat('bold', !isBold)}
        />
        <Btn
          icon="italic"
          active={isItalic}
          onPress={() => onFormat('italic', !isItalic)}
        />
        <Btn
          icon="underline"
          active={isUnderline}
          onPress={() => onFormat('underline', !isUnderline)}
        />
        <Btn
          icon="strikethrough"
          active={isStrike}
          onPress={() => onFormat('strike', !isStrike)}
        />
        <Divider />
        <Btn
          icon="remove"
          onPress={() => {
            const size =
              typeof currentFormat.size === 'string'
                ? parseInt(currentFormat.size, 10)
                : 14;
            onFormat('size', `${Math.max(10, size - 1)}px`);
          }}
        />
        <Btn label="14" onPress={() => {}} />
        <Btn
          icon="add"
          onPress={() => {
            const size =
              typeof currentFormat.size === 'string'
                ? parseInt(currentFormat.size, 10)
                : 14;
            onFormat('size', `${Math.min(36, size + 1)}px`);
          }}
        />
        <Divider />
        <Btn
          icon="color-palette-outline"
          onPress={() => onOpenColor('color')}
        />
        <Btn icon="brush-outline" onPress={() => onOpenColor('background')} />
        <Divider />
        <Btn
          label="1.0"
          active={currentFormat.spacing === '1'}
          onPress={() => onSpacing(currentFormat.spacing === '1' ? false : '1')}
        />
        <Btn
          label="1.5"
          active={currentFormat.spacing === '1.5'}
          onPress={() =>
            onSpacing(currentFormat.spacing === '1.5' ? false : '1.5')
          }
        />
        <Btn
          label="2.0"
          active={currentFormat.spacing === '2'}
          onPress={() => onSpacing(currentFormat.spacing === '2' ? false : '2')}
        />
        <Divider />
        <Btn
          icon="refresh"
          onPress={() => {
            [
              'bold',
              'italic',
              'underline',
              'strike',
              'color',
              'background',
              'size',
              'spacing',
            ].forEach(f => onFormat(f, false));
          }}
        />
      </>
    );
  }

  function renderInsertTab() {
    return (
      <>
        <Btn label="H1" onPress={() => onFormat('header', 1)} />
        <Btn label="H2" onPress={() => onFormat('header', 2)} />
        <Btn label="H3" onPress={() => onFormat('header', 3)} />
        <Divider />
        <Btn icon="list" onPress={() => onFormat('list', 'bullet')} />
        <Btn icon="list-numbered" onPress={() => onFormat('list', 'ordered')} />
        <Btn icon="checkbox" onPress={() => onFormat('list', 'check')} />
        <Divider />
        <Btn icon="grid-outline" onPress={onInsertTable} />
        <Btn icon="image-outline" onPress={onInsertImage} />
        <Btn icon="remove" onPress={() => onInsert('\n---\n')} />
        <Btn icon="contract-outline" onPress={onInsertPageBreak} />
      </>
    );
  }

  function renderLayoutTab() {
    return (
      <>
        <Btn icon="align-left" onPress={() => onFormat('align', false)} />
        <Btn icon="align-center" onPress={() => onFormat('align', 'center')} />
        <Btn icon="align-right" onPress={() => onFormat('align', 'right')} />
        <Btn
          icon="align-justify"
          onPress={() => onFormat('align', 'justify')}
        />
        <Divider />
        <Btn icon="indent-increase" onPress={() => onFormat('indent', '+1')} />
        <Btn icon="indent-decrease" onPress={() => onFormat('indent', '-1')} />
        <Divider />
        {PAPER_SIZES.map(s => (
          <Btn
            key={s.key}
            label={s.label}
            active={paperSize === s.key}
            onPress={() => onPaperSize(s.key)}
          />
        ))}
      </>
    );
  }

  function renderReferencesTab() {
    return (
      <>
        <Btn icon="document-text-outline" onPress={onCitations} />
        <Divider />
        <Btn icon="link" onPress={onOpenLink} />
        <Btn icon="superscript" onPress={() => onFormat('script', 'super')} />
      </>
    );
  }

  function renderReviewTab() {
    return (
      <>
        <Btn icon="chatbubble-ellipses-outline" onPress={onChat} />
        <Divider />
        <Btn icon="arrow-undo" onPress={onUndo} />
        <Btn icon="arrow-redo" onPress={onRedo} />
        <Divider />
        <Btn icon="search" onPress={onFindReplace} />
        <Divider />
        <Btn icon="sparkles" onPress={onAiAction} />
        <Divider />
        <View style={styles.wordCountBadge}>
          <Text style={styles.wordCountText}>{wordCount} words</Text>
        </View>
      </>
    );
  }

  function renderViewTab() {
    return (
      <>
        <Btn icon="list-outline" onPress={onOutline} />
      </>
    );
  }

  function renderContent() {
    switch (activeTab) {
      case 'Home':
        return renderHomeTab();
      case 'Insert':
        return renderInsertTab();
      case 'Layout':
        return renderLayoutTab();
      case 'References':
        return renderReferencesTab();
      case 'Review':
        return renderReviewTab();
      case 'View':
        return renderViewTab();
    }
  }

  function Divider() {
    return <View style={styles.divider} />;
  }

  return (
    <View style={styles.container}>
      {/* Tab row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabRow}
        contentContainerStyle={styles.tabRowContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Controls row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.controlRow}
        contentContainerStyle={styles.controlRowContent}
        keyboardShouldPersistTaps="always">
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabRow: {
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabRowContent: {paddingHorizontal: 4, gap: 2},
  tab: {paddingHorizontal: 14, paddingVertical: 7},
  tabActive: {borderBottomWidth: 2, borderBottomColor: '#6366f1'},
  tabText: {fontSize: 12, color: '#6b7280', fontWeight: '500'},
  tabTextActive: {color: '#6366f1', fontWeight: '700'},
  controlRow: {maxHeight: 48},
  controlRowContent: {alignItems: 'center', paddingHorizontal: 8, gap: 4},
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  btnActive: {backgroundColor: '#6366f1'},
  btnText: {fontSize: 13, color: '#374151', fontWeight: '500'},
  btnTextActive: {color: '#fff'},
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  wordCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  wordCountText: {fontSize: 12, color: '#6b7280'},
});
