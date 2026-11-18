import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Button, ConfirmDelete, Input, Screen, SheetHeader, Text, Toggle, backTo } from '@/components';
import { useCreateShiftMutation, useDeleteShiftMutation, useUpdateShiftMutation } from '@/services/attendanceApi';
import { runAction } from '@/utils/attendance';
import { apiError } from '@/utils/apiError';
import { getFieldError } from '@/utils/getFieldError';
import { parseTime, toDisplay } from '@/utils/time';

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="font-body-medium">{label}</Text>
        <Text className="text-sm text-muted">{sub}</Text>
      </View>
      <Toggle value={value} onValueChange={onChange} label={label} />
    </View>
  );
}

// Admin: add or edit a shift (prefilled through params), or delete it.
export default function ShiftForm() {
  const p = useLocalSearchParams();
  const [create, c] = useCreateShiftMutation();
  const [update, u] = useUpdateShiftMutation();
  const [remove, d] = useDeleteShiftMutation();
  const [name, setName] = useState(p.name || '');
  const [start, setStart] = useState(toDisplay(p.startTime) || '');
  const [end, setEnd] = useState(toDisplay(p.endTime) || '');
  const [grace, setGrace] = useState(p.gracePeriod || '15');
  const [isDefault, setDefault] = useState(!!p.isDefault);
  const [isActive, setActive] = useState(p.id ? !!p.isActive : true);
  const { message, fieldErrors } = apiError(c.error || u.error);
  const err = (f) => getFieldError(fieldErrors, f);
  const bad = (t) => !!t.trim() && !parseTime(t);
  const startTime = parseTime(start);
  const endTime = parseTime(end);

  const save = async () => {
    const body = { name: name.trim(), startTime, endTime, gracePeriod: Number(grace) || 0, isDefault };
    const ok = await runAction(p.id ? update({ id: p.id, ...body, isActive }) : create(body), p.id ? 'Shift updated' : 'Shift added');
    if (ok) backTo();
  };
  const del = async () => {
    if (await runAction(remove(p.id), 'Shift deleted', "Couldn't delete")) backTo();
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title={p.id ? 'Edit shift' : 'Add shift'} sub="Clock-ins after start plus grace are marked late." closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? '' : message} />
      <Input label="Name" value={name} onChangeText={setName} placeholder="General shift" maxLength={50} error={err('name')} />
      <Input label="Starts" value={start} onChangeText={setStart} placeholder="9:00 AM" autoCapitalize="none" error={bad(start) ? 'Use a time like 9:00 AM' : err('startTime')} />
      <Input label="Ends" value={end} onChangeText={setEnd} placeholder="6:00 PM" autoCapitalize="none" error={bad(end) ? 'Use a time like 6:00 PM' : err('endTime')} />
      <Input label="Grace period (minutes)" value={grace} onChangeText={(t) => setGrace(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" hint="0 to 120." error={Number(grace) > 120 ? 'At most 120 minutes' : err('gracePeriod')} />
      <ToggleRow label="Default shift" sub="Used for anyone without a shift of their own." value={isDefault} onChange={setDefault} />
      {!!p.id && <ToggleRow label="Active" sub="Inactive shifts can't be picked." value={isActive} onChange={setActive} />}
      <Button
        title={p.id ? 'Save changes' : 'Add shift'}
        loading={c.isLoading || u.isLoading}
        disabled={!name.trim() || !startTime || !endTime || startTime === endTime || Number(grace) > 120}
        onPress={save}
      />
      {!!p.id && <ConfirmDelete label="Delete shift" loading={d.isLoading} onConfirm={del} />}
    </Screen>
  );
}
