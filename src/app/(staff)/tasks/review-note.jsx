import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { AttachButtons, Button, Input, PendingFiles, Screen, SheetHeader, Text, backTo, showToast, useAttachments } from '@/components';
import { useAddTaskCommentMutation, useUpdateTaskMutation } from '@/services/taskApi';
import { runAction } from '@/utils/attendance';

const MODES = {
  submit: { title: 'Send for review', label: 'Note for the reviewer', placeholder: 'What to check, links, anything unfinished', hint: 'Optional. The reviewer is asked to check within 1 office hour.', button: 'Send for review', done: 'Sent for review', body: (note) => ({ status: 'review', note }) },
  changes: { title: 'Ask for changes', label: 'What needs to change', placeholder: 'Music is too loud at 0:40', hint: 'Goes to the person doing the task and into the task chat.', button: 'Send back', done: 'Sent back with your note', body: (note) => ({ requestChanges: true, note }) },
};

// One sheet for both review notes: the owner's submit note (optional) and the reviewer's change request (required).
export default function ReviewNote() {
  const { id, title, mode = 'submit' } = useLocalSearchParams();
  const m = MODES[mode] || MODES.submit;
  const [update, u] = useUpdateTaskMutation();
  const [addComment, c] = useAddTaskCommentMutation();
  const att = useAttachments();
  const [note, setNote] = useState('');
  const needNote = mode === 'changes';

  // The note goes with the status change; photos follow it in the task chat, where the review card picks them up.
  const save = async () => {
    const ok = await runAction(update({ id, ...m.body(note.trim()) }), m.done, "Couldn't send it");
    if (!ok) return;
    if (att.files.length && !(await runAction(addComment({ id, files: att.files }), null, "Couldn't send the files"))) {
      showToast({ title: 'Add the files in the task chat' });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    backTo(`/tasks/${id}`);
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title={m.title} sub={title} closeLabel="Cancel" />
      <Input label={m.label} value={note} onChangeText={setNote} placeholder={m.placeholder} multiline maxLength={2000} autoFocus style={{ height: 120, paddingTop: 14, textAlignVertical: 'top' }} hint={m.hint} />
      <View className="gap-2">
        <Text className="text-sm text-muted">Photos or PDFs of the work (optional)</Text>
        <PendingFiles files={att.files} remove={att.remove} />
        <View className="flex-row gap-1"><AttachButtons {...att} /></View>
      </View>
      <Button title={m.button} loading={u.isLoading || c.isLoading} disabled={needNote && !note.trim()} onPress={save} />
    </Screen>
  );
}
