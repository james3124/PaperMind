import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

type Tab = 'Home' | 'Insert' | 'Layout' | 'References' | 'Review' | 'View';
const TABS: Tab[] = ['Home', 'Insert', 'Layout', 'References', 'Review', 'View'];

interface Props {
  currentFormat: Record<string, unknown>;
  onFormat:      (key: string, value: unknown) => void;
  onInsert:      (text: string) => void;
  onUndo:        () => void;
  onRedo:        () => void;
  onFindReplace: () => void;
  onOutline:     () => void;
  wordCount:     number;
}

export default function TabToolbar({
  currentFormat, onFormat, onInsert, onUndo, onRedo, onFindReplace, onOutline, wordCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Home');

  const isBold      = !!currentFormat.bold;
  const isItalic    = !!currentFormat.italic;
  const isUnderline = !!currentFormat.underline;
  const isStrike    = !!currentFormat.strike;

  function Btn({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
    return (
      <TouchableOpacity
        style={[styles.btn, active && styles.btnActive]}
        onPress={onPress}
      >
        <Text style={[styles.btnText, active && styles.btnTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function renderHomeTab() {
    return (
      <>
        <Btn label="B"  active={isBold}      onPress={() => onFormat('bold',      !isBold)} />
        <Btn label="I"  active={isItalic}     onPress={() => onFormat('italic',    !isItalic)} />
        <Btn label="U"  active={isUnderline}  onPress={() => onFormat('underline', !isUnderline)} />
        <Btn label="S̶"  active={isStrike}     onPress={() => onFormat('strike',    !isStrike)} />
        <Divider />
        <Btn label="A-" onPress={() => {
          const size = typeof currentFormat.size === 'string' ? parseInt(currentFormat.size, 10) : 14;
          onFormat('size', `${Math.max(10, size - 1)}px`);
        }} />
        <Btn label="14" onPress={() => {}} />
        <Btn label="A+" onPress={() => {
          const size = typeof currentFormat.size === 'string' ? parseInt(currentFormat.size, 10) : 14;
          onFormat('size', `${Math.min(36, size + 1)}px`);
        }} />
        <Divider />
        <Btn label="Clr" onPress={() => {
          ['bold','italic','underline','strike','color','background','size'].forEach((f) =>
            onFormat(f, false)
          );
        }} />
      </>
    );
  }

  function renderInsertTab() {
    return (
      <>
        <Btn label="H1"  onPress={() => onFormat('header', 1)} />
        <Btn label="H2"  onPress={() => onFormat('header', 2)} />
        <Btn label="H3"  onPress={() => onFormat('header', 3)} />
        <Divider />
        <Btn label="• List" onPress={() => onFormat('list', 'bullet')} />
        <Btn label="1. List" onPress={() => onFormat('list', 'ordered')} />
        <Btn label="☐ Todo"  onPress={() => onFormat('list', 'check')} />
        <Divider />
        <Btn label="—"    onPress={() => onInsert('\n---\n')} />
      </>
    );
  }

  function renderLayoutTab() {
    return (
      <>
        <Btn label="⬅"  onPress={() => onFormat('align', false)} />
        <Btn label="☰"  onPress={() => onFormat('align', 'center')} />
        <Btn label="➡"  onPress={() => onFormat('align', 'right')} />
        <Btn label="⬛"  onPress={() => onFormat('align', 'justify')} />
        <Divider />
        <Btn label="→|"  onPress={() => onFormat('indent', '+1')} />
        <Btn label="|←"  onPress={() => onFormat('indent', '-1')} />
      </>
    );
  }

  function renderReferencesTab() {
    return (
      <>
        <Btn label="(Cite)" onPress={() => onInsert('(Author, Year)')} />
        <Btn label="Fn¹"    onPress={() => onFormat('script', 'super')} />
      </>
    );
  }

  function renderReviewTab() {
    return (
      <>
        <Btn label="↩ Undo" onPress={onUndo} />
        <Btn label="↪ Redo" onPress={onRedo} />
        <Divider />
        <Btn label="🔍 Find" onPress={onFindReplace} />
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
        <Btn label="☰ Outline" onPress={onOutline} />
      </>
    );
  }

  function renderContent() {
    switch (activeTab) {
      case 'Home':       return renderHomeTab();
      case 'Insert':     return renderInsertTab();
      case 'Layout':     return renderLayoutTab();
      case 'References': return renderReferencesTab();
      case 'Review':     return renderReviewTab();
      case 'View':       return renderViewTab();
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
        contentContainerStyle={styles.tabRowContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
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
        keyboardShouldPersistTaps="always"
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  tabRow:          { backgroundColor: '#f3f4f6', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabRowContent:   { paddingHorizontal: 4, gap: 2 },
  tab:             { paddingHorizontal: 14, paddingVertical: 7 },
  tabActive:       { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText:         { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  tabTextActive:   { color: '#6366f1', fontWeight: '700' },
  controlRow:      { maxHeight: 44 },
  controlRowContent:{ alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  btn:             { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, minWidth: 36, alignItems: 'center' },
  btnActive:       { backgroundColor: '#6366f1' },
  btnText:         { fontSize: 14, color: '#374151', fontWeight: '500' },
  btnTextActive:   { color: '#fff' },
  divider:         { width: 1, height: 24, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  wordCountBadge:  { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 12 },
  wordCountText:   { fontSize: 12, color: '#6b7280' },
});