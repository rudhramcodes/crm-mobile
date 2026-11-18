import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Chip, DateField, Input, Screen, SheetHeader, backTo } from '@/components';
import { useUpdateTaskMutation } from '@/services/taskApi';
import { runAction, ymd } from '@/utils/attendance';

const plus = (n) => ymd(Date.now() + n * 864e5);
const QUICK = [['Today', 0], ['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]];

// New due date for one task. Moving an existing deadline needs a reason; the server keeps it in the history.
export default function Reschedule() {
  const { id, due, title } = useLocalSearchParams();
  const [update, { isLoading }] = useUpdateTaskMutation();
  const [date, setDate] = useState(due || '');
  const [reason, setReason] = useState('');
  const needsReason = !!due && date !== due;

  const save = async () => {
    const ok = await runAction(update({ id, dueDate: date, ...(needsReason ? { reason: reason.trim() } : {}) }), 'Task rescheduled', "Couldn't reschedule");
    if (ok) backTo('/tasks');
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title="Reschedule" sub={title} closeLabel="Cancel" />
      <View className="flex-row flex-wrap gap-2">
        {QUICK.map(([l, n]) => <Chip key={l} label={l} active={date === plus(n)} onPress={() => setDate(plus(n))} />)}
      </View>
      <DateField label="Due date" value={date} onChange={setDate} />
      {needsReason && (
        <Input
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Client sent the files late"
          multiline
          maxLength={500}
          style={{ height: 96, paddingTop: 14, textAlignVertical: 'top' }}
          hint="Saved in the task history."
        />
      )}
      <Button title="Save new date" loading={isLoading} disabled={!date || date === due || (needsReason && !reason.trim())} onPress={save} />
    </Screen>
  );
}
