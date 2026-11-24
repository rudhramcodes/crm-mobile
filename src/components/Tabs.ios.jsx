import { startTransition } from 'react';
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { controlSize, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

// iOS: the system segmented control at its large size (UISegmentedControl via SwiftUI), so it slides exactly like iOS.
// The screen's switch renders as a transition so it never holds up the control.
export function Tabs({ tabs, value, onChange }) {
  return (
    <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
      <Picker selection={value} onSelectionChange={(v) => startTransition(() => onChange(v))} modifiers={[pickerStyle('segmented'), controlSize('large')]}>
        {tabs.map((t) => <Text key={t.value} modifiers={[tag(t.value)]}>{t.count ? `${t.label} ${t.count > 99 ? '99+' : t.count}` : t.label}</Text>)}
      </Picker>
    </Host>
  );
}
