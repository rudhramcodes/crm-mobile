import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Alert, Button, Chip, DateField, Input, Screen, SelectField, SheetHeader, Text, backTo } from "@/components";
import { ROLE_LABELS } from "@/constants";
import { useRequestMeetingMutation } from "@/services/meetingApi";
import { useGetUsersQuery } from "@/services/userApi";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { getFieldError } from "@/utils/getFieldError";
import { START_SLOTS } from "@/utils/meetings";
import { toDisplay } from "@/utils/time";

// Only people who can schedule meetings can take a request.
const SCHEDULERS = ["super_admin", "admin", "manager"];
const textArea = { height: 96, paddingTop: 14, textAlignVertical: "top" };

// Employees can't schedule meetings, so they ask an admin or manager. The assignee gets a notification that opens
// the schedule form already filled in; the employee hears back through the usual "Meeting scheduled" notification.
export default function RequestMeeting() {
  const { date } = useLocalSearchParams();
  const [f, setF] = useState(() => ({ title: "", assignee: "", date: typeof date === "string" ? date : "", startTime: "", note: "" }));
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const [send, s] = useRequestMeetingMutation();
  const { message, fieldErrors } = apiError(s.error);
  const err = (k) => getFieldError(fieldErrors, k);

  const usersQ = useGetUsersQuery({ isActive: true, limit: 100 });
  const options = (usersQ.data?.data?.users || [])
    .filter((u) => SCHEDULERS.includes(u.role))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map((u) => ({ value: u._id, label: u.name, hint: [ROLE_LABELS[u.role], u.email].filter(Boolean).join(" · ") }));
  const assignee = options.find((o) => o.value === f.assignee);

  const title = f.title.trim();
  const ready = title.length >= 2 && !!f.assignee;
  const submit = async () => {
    const body = { title, assignee: f.assignee, date: f.date || undefined, startTime: f.startTime || undefined, note: f.note.trim() || undefined };
    if (await runAction(send(body), `Request sent to ${assignee?.label || "them"}`, "Couldn't send the request")) backTo("/meetings");
  };

  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      <SheetHeader title="Request a meeting" sub="An admin or manager will set it up" closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? "" : message} />
      <Input label="Meeting title *" value={f.title} onChangeText={(v) => set({ title: v })} placeholder="e.g. Discuss the Patel wedding edit" maxLength={200} error={err("title")} />
      <SelectField
        label="Who should schedule it *"
        value={f.assignee}
        options={options}
        onChange={(v) => set({ assignee: v })}
        placeholder="Search admins and managers"
        searchable
        loading={usersQ.isLoading}
        emptyText="No admins or managers found"
        error={err("assignee")}
      />
      <DateField label="Preferred date" value={f.date} onChange={(v) => set({ date: v })} placeholder="Any day" error={err("date")} />
      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">Preferred time</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
          <Chip label="Any time" active={!f.startTime} onPress={() => set({ startTime: "" })} />
          {START_SLOTS.map((t) => <Chip key={t} label={toDisplay(t)} active={f.startTime === t} onPress={() => set({ startTime: t })} />)}
        </ScrollView>
      </View>
      <Input label="Note" value={f.note} onChangeText={(v) => set({ note: v })} placeholder="What it's about, who else should join" multiline maxLength={500} style={textArea} error={err("note")} />
      <Button title="Send request" loading={s.isLoading} disabled={!ready} onPress={submit} />
    </Screen>
  );
}
