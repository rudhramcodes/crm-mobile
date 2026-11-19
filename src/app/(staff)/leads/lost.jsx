import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button, Input, Screen, SheetHeader, backTo } from '@/components';
import { useUpdateLeadMutation } from '@/services/leadApi';
import { runAction } from '@/utils/attendance';

// Marking a lead lost always records why (required here, as on the web detail page).
export default function LostReason() {
  const { id, name } = useLocalSearchParams();
  const [update, { isLoading }] = useUpdateLeadMutation();
  const [reason, setReason] = useState('');

  const save = async () => {
    if (await runAction(update({ id, status: 'lost', lostReason: reason.trim() }), 'Marked lost', "Couldn't mark it lost")) backTo(`/leads/${id}`);
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title="Mark as lost" sub={name} closeLabel="Cancel" />
      <Input label="Why was it lost? *" value={reason} onChangeText={setReason} placeholder="Went with another studio on price" multiline maxLength={500} autoFocus style={{ height: 120, paddingTop: 14, textAlignVertical: 'top' }} />
      <Button title="Mark lost" variant="danger" loading={isLoading} disabled={!reason.trim()} onPress={save} />
    </Screen>
  );
}
