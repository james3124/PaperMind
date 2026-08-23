import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {ChatMessage} from '@/services/chatService';

interface Props {
  visible: boolean;
  messages: ChatMessage[];
  streamingText: string;
  busy: boolean;
  onSend: (text: string) => void;
  onApply: (message: ChatMessage) => void;
  onDismiss: () => void;
}

export default function ChatPanel({
  visible,
  messages,
  streamingText,
  busy,
  onSend,
  onApply,
  onDismiss,
}: Props) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = () => {
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput('');
    onSend(text);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>AI Assistant</Text>
              <TouchableOpacity onPress={onDismiss}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={scrollRef}
              style={styles.list}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({animated: true})
              }>
              {messages.map((message, i) => {
                const isUser = message.role === 'user';
                return (
                  <View
                    key={message.createdAt ?? i}
                    style={[
                      styles.bubble,
                      isUser ? styles.bubbleUser : styles.bubbleAssistant,
                    ]}>
                    <Text
                      style={
                        isUser ? styles.bubbleUserText : styles.bubbleText
                      }>
                      {message.content}
                    </Text>
                    {!isUser && (
                      <TouchableOpacity
                        style={[
                          styles.applyBtn,
                          message.applied && styles.applyBtnDone,
                        ]}
                        onPress={() => onApply(message)}
                        disabled={message.applied}>
                        <Text style={styles.applyText}>
                          {message.applied ? '✓ Applied' : 'Insert at cursor'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {busy && !!streamingText && (
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <Text style={styles.bubbleText}>{streamingText}</Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask about the paper…"
                placeholderTextColor="#9ca3af"
                multiline
                onSubmitEditing={handleSend}
                editable={!busy}
              />
              <TouchableOpacity
                style={[styles.sendBtn, busy && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={busy}>
                <Text style={styles.sendText}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    padding: 16,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {fontSize: 18, fontWeight: '700'},
  close: {fontSize: 18, color: '#6b7280'},
  list: {flexGrow: 0, marginBottom: 12},
  bubble: {
    maxWidth: '85%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366f1',
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
  },
  bubbleUserText: {fontSize: 14, color: '#fff'},
  bubbleText: {fontSize: 14, color: '#111827'},
  applyBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#6366f1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  applyBtnDone: {backgroundColor: '#10b981'},
  applyText: {fontSize: 12, color: '#fff', fontWeight: '600'},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtnDisabled: {backgroundColor: '#a5b4fc'},
  sendText: {fontSize: 16, color: '#fff'},
});
