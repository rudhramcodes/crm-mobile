import { useEffect, useRef } from 'react';
import { AppState, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste } from 'lucide-react-native';
import { Pressable } from './Pressable';
import { Button } from './Button';
import { Text } from './Text';
import { cn } from '@/utils/cn';

// After switching apps (e.g. to copy the code from Gmail) the keyboard is gone but the input still counts
// as focused, so a plain focus() does nothing. Blur first, then focus on the next frame.
const refocus = (input) => {
  input?.blur();
  requestAnimationFrame(() => input?.focus());
};

// One real input (so iOS/Android can autofill the code) hidden behind six display boxes.
export function OtpInput({ value, onChangeText, error, length = 6 }) {
  const ref = useRef(null);
  const set = (v) => onChangeText(v.replace(/\D/g, '').slice(0, length));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refocus(ref.current));
    return () => sub.remove();
  }, []);

  const paste = async () => {
    const code = (await Clipboard.getStringAsync()).match(new RegExp(`\\d{${length}}`))?.[0];
    if (code) set(code);
    else refocus(ref.current);
  };

  return (
    <View className="gap-2">
      <Pressable onPress={() => refocus(ref.current)} haptic={false} accessible={false} className="active:scale-100 active:opacity-100">
        <View className="flex-row justify-between" importantForAccessibility="no-hide-descendants">
          {Array.from({ length }, (_, i) => (
            <View
              key={i}
              className={cn(
                'h-14 w-12 items-center justify-center rounded-xl border-[1.5px] bg-surface-2',
                error ? 'border-danger' : i === value.length ? 'border-accent' : 'border-transparent',
              )}
            >
              <Text className="font-body-semibold text-2xl">{value[i]}</Text>
            </View>
          ))}
        </View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={set}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          autoFocus
          caretHidden
          pointerEvents="none"
          accessibilityLabel="Verification code"
          className="absolute inset-0 opacity-0"
        />
      </Pressable>
      <Button title="Paste code" icon={ClipboardPaste} variant="ghost" size="sm" className="self-center" onPress={paste} />
    </View>
  );
}
