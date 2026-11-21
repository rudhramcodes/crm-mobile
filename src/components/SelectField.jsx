import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable as RNPressable, TextInput, View, useWindowDimensions } from 'react-native';
import { AlertCircle, Check, ChevronDown, Search, X } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useTheme } from '@/constants/theme';
import { cn } from '@/utils/cn';

// Dropdown: a field showing the chosen option that opens a small centred list (with search when `searchable`).
// options: [{ value, label, hint? }]. `onClear` adds a "None" row for optional fields.
export function SelectField({ label, value, options, onChange, onClear, placeholder = 'Select', searchable, disabled, loading, error, emptyText = 'Nothing to choose' }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const chosen = options.find((o) => String(o.value) === String(value));
  const term = q.trim().toLowerCase();
  const shown = term ? options.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(term)) : options;
  const close = () => {
    setOpen(false);
    setQ('');
  };
  const pick = (v) => {
    onChange(v);
    close();
  };

  return (
    <View className="gap-1.5">
      {!!label && <Text className="font-body-medium text-sm">{label}</Text>}
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityLabel={`${label || 'Select'}: ${chosen?.label || placeholder}`}
        accessibilityRole="button"
        className={cn('min-h-[52px] flex-row items-center gap-3 rounded-2xl border-[1.5px] bg-surface-2 px-4 py-2', error ? 'border-danger' : 'border-transparent', disabled && 'opacity-50')}
      >
        <View className="flex-1">
          <Text numberOfLines={1} className={cn('text-[15px]', !chosen && 'text-muted')}>{loading ? 'Loading…' : chosen?.label || placeholder}</Text>
          {!!chosen?.hint && <Text numberOfLines={1} className="text-xs text-muted">{chosen.hint}</Text>}
        </View>
        <ChevronDown size={18} color={theme.muted} />
      </Pressable>
      {!!error && (
        <View className="flex-row items-center gap-1.5">
          <AlertCircle size={14} color={theme.danger} />
          <Text className="flex-1 text-sm text-danger">{error}</Text>
        </View>
      )}

      {/* Compact centred card: title, search, then a short scrolling list (about 6 rows). Lifts above the keyboard. */}
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 items-center justify-center px-5">
          <RNPressable onPress={close} accessibilityLabel="Close" className="absolute inset-0 bg-black/50" />
          <View accessibilityViewIsModal className="w-full max-w-md overflow-hidden rounded-3xl bg-surface" style={{ maxHeight: Math.min(460, height * 0.62) }}>
            <View className="flex-row items-center border-b border-line pl-4 pr-1">
              <Text accessibilityRole="header" numberOfLines={1} className="flex-1 font-body-semibold">{label?.replace(/\s*\*$/, '') || 'Select'}</Text>
              <Pressable onPress={close} accessibilityLabel="Close" className="h-11 w-11 items-center justify-center">
                <X size={18} color={theme.ink} />
              </Pressable>
            </View>
            {searchable && (
              <View className="mx-3 mt-3 h-11 flex-row items-center gap-2 rounded-2xl bg-surface-2 px-3">
                <Search size={16} color={theme.muted} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search"
                  placeholderTextColor={theme.muted}
                  selectionColor={theme.accent}
                  accessibilityLabel={`Search ${label || ''}`}
                  autoCorrect={false}
                  returnKeyType="search"
                  className="h-11 flex-1 font-body text-[15px] text-ink"
                />
                {!!q && (
                  <Pressable onPress={() => setQ('')} accessibilityLabel="Clear search" hitSlop={8}>
                    <X size={16} color={theme.muted} />
                  </Pressable>
                )}
              </View>
            )}
            <FlatList
              data={shown}
              keyExtractor={(o) => String(o.value)}
              keyboardShouldPersistTaps="handled"
              className="shrink grow-0"
              contentContainerClassName="px-2 py-2"
              ListHeaderComponent={onClear && !term ? (
                <Pressable onPress={() => { onClear(); close(); }} accessibilityLabel="None" className="min-h-[44px] flex-row items-center rounded-xl px-3">
                  <Text className="flex-1 text-sm text-muted">None</Text>
                  {!chosen && <Check size={16} color={theme.ink} />}
                </Pressable>
              ) : null}
              ListEmptyComponent={<Text className="py-6 text-center text-sm text-muted">{term ? 'No matches' : emptyText}</Text>}
              renderItem={({ item }) => {
                const active = String(item.value) === String(value);
                return (
                  <Pressable
                    onPress={() => pick(item.value)}
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: active }}
                    className={cn('min-h-[44px] flex-row items-center gap-3 rounded-xl px-3 py-1.5', active && 'bg-surface-2')}
                  >
                    <View className="flex-1">
                      <Text numberOfLines={1} className={cn('text-sm', active && 'font-body-semibold')}>{item.label}</Text>
                      {!!item.hint && <Text numberOfLines={1} className="text-xs text-muted">{item.hint}</Text>}
                    </View>
                    {active && <Check size={16} color={theme.ink} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
