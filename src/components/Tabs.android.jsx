import { startTransition } from 'react';
import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';

// Android: Material 3 segmented buttons, the platform's own control.
// The screen's switch renders as a transition so it never holds up the control.
export function Tabs({ tabs, value, onChange }) {
  return (
    <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth(), height(48)]}>
        {tabs.map((t) => (
          <SegmentedButton key={t.value} selected={t.value === value} onClick={() => t.value !== value && startTransition(() => onChange(t.value))}>
            <SegmentedButton.Label>
              <Text>{t.count ? `${t.label} ${t.count > 99 ? '99+' : t.count}` : t.label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
