import {
  Alert,
  AttendeePicker,
  Button,
  Chip,
  DashboardState,
  DateField,
  Input,
  Pressable,
  Screen,
  SearchPick,
  SheetHeader,
  Text,
  VentureChips,
  backTo,
  joinMeeting,
  showToast,
} from "@/components";
import { MEETING_STATUS } from "@/constants";
import { useGetClientsQuery } from "@/services/clientApi";
import { useGetLeadsQuery } from "@/services/leadApi";
import {
  useCreateMeetingMutation,
  useGenerateMeetingLinkMutation,
  useGetMeetingByIdQuery,
  useUpdateMeetingMutation,
} from "@/services/meetingApi";
import { useGetUsersQuery } from "@/services/userApi";
import { apiError } from "@/utils/apiError";
import { runAction, ymd } from "@/utils/attendance";
import { getFieldError } from "@/utils/getFieldError";
import {
  DURATIONS,
  RECURRENCE,
  START_SLOTS,
  clientOptions,
  durationOf,
  endFrom,
  leadOptions,
  meetingBody,
} from "@/utils/meetings";
import { parseTime, toDisplay } from "@/utils/time";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";

const textArea = { height: 110, paddingTop: 14, textAlignVertical: "top" };
const LINK = /^https?:\/\/\S+$/i;

function Field({ label, children }) {
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      {children}
    </View>
  );
}

const Row = ({ children }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
    {children}
  </ScrollView>
);

const Section = ({ children }) => <Text className="pt-2 text-caption text-muted">{children}</Text>;

const idOf = (x) => (x && typeof x === "object" ? x._id : x) || "";
// `ask`: a "meeting request" notification's link (/meetings/new?title=&attendee=&date=&startTime=) fills a new form.
const initial = (m, client, ask = {}) => ({
  title: m?.title || ask.title || "",
  brand: m?.brand || "",
  status: m?.status || "scheduled",
  client: idOf(m?.client) || client || "",
  lead: idOf(m?.lead),
  date: m?.date ? String(m.date).slice(0, 10) : /^\d{4}-\d{2}-\d{2}$/.test(ask.date || "") ? ask.date : "",
  startTime: m?.startTime || (/^\d{2}:\d{2}$/.test(ask.startTime || "") ? ask.startTime : ""),
  endTime: m?.endTime || "",
  recurrence: "none",
  occurrences: "3",
  meetingLink: m?.meetingLink || "",
  location: m?.location || "",
  attendees: m ? (m.attendees || []).map(idOf) : ask.attendee ? [ask.attendee] : [],
  notes: m?.notes || "",
});

// Same fields, labels and rules as the web MeetingForm.
function MeetingForm({ meeting, defaultClient, ask }) {
  const editing = !!meeting;
  const [create, c] = useCreateMeetingMutation();
  const [update, u] = useUpdateMeetingMutation();
  const [generate, g] = useGenerateMeetingLinkMutation();
  const [f, setF] = useState(() => initial(meeting, defaultClient, ask));
  const [startRaw, setStartRaw] = useState(toDisplay(f.startTime));
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const { message, fieldErrors } = apiError(c.error || u.error);
  const err = (k) => getFieldError(fieldErrors, k);

  const usersQ = useGetUsersQuery({ limit: 100 });
  const users = [...(usersQ.data?.data?.users || [])].sort(
    (a, b) => (a.role === "client") - (b.role === "client") || String(a.name).localeCompare(String(b.name)),
  );
  const clients = useGetClientsQuery({ limit: 100 }).data?.data || [];
  const leads = useGetLeadsQuery({ limit: 100 }).data?.data || [];
  const client = clients.find((x) => x._id === f.client);

  // Picking a client fills an empty venture and invites the client's portal user (web behaviour).
  const pickClient = (id) => {
    const x = clients.find((k) => k._id === id);
    const portal = x && users.find((p) => p._id === x.user || (x.email && p.email?.toLowerCase() === x.email.toLowerCase()));
    setF((s) => ({
      ...s,
      client: id,
      brand: s.brand || x?.brand || "",
      attendees: portal && !s.attendees.includes(portal._id) ? [...s.attendees, portal._id] : s.attendees,
    }));
  };
  const setStart = (t) => {
    setStartRaw(toDisplay(t));
    set({ startTime: t, endTime: "" }); // a new start clears the end, like the web
  };

  const minutes = durationOf(f.startTime, f.endTime);
  const link = f.meetingLink.trim();
  const badLink = !!link && !LINK.test(link);
  const occ = Number(f.occurrences);
  const badOcc = !editing && f.recurrence !== "none" && !(occ >= 2 && occ <= 60);
  const ready = f.title.trim().length >= 2 && f.date && f.startTime && f.endTime && minutes > 0 && !badLink && !badOcc;

  const makeLink = async (provider) => {
    if (!f.title.trim() || !f.date || !f.startTime || !f.endTime) {
      return showToast({ title: "Please fill in title, date and start/end time first" });
    }
    const res = await runAction(
      generate({ title: f.title.trim(), date: f.date, startTime: f.startTime, endTime: f.endTime, provider }),
      provider === "zoho" ? "Zoho Meeting link generated & synced!" : "Google Meet link generated!",
      provider === "zoho" ? "Could not auto-generate Zoho link" : "Could not generate a Google Meet link",
    );
    if (typeof res === "string") set({ meetingLink: res });
  };
  const paste = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) set({ meetingLink: text });
  };

  const save = async () => {
    const body = meetingBody(f, editing);
    if (editing) {
      if (await runAction(update({ id: meeting?._id, ...body }), "Meeting updated successfully", "Something went wrong while saving the meeting")) {
        backTo(`/meetings/${meeting?._id}`);
      }
      return;
    }
    const res = await runAction(create(body), "Meeting scheduled successfully", "Something went wrong while saving the meeting");
    const id = res?.data?.meeting?._id || res?.data?.meetings?.[0]?._id;
    if (id) router.replace(`/meetings/${id}`);
    else if (res) backTo("/meetings");
  };

  const [[today, tomorrow]] = useState(() => {
    const t = new Date();
    return [ymd(t), ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1))];
  });

  return (
    <>
      <SheetHeader
        title={editing ? "Edit Meeting" : "Schedule Meeting"}
        sub={editing ? meeting?.title : "New session scheduling"}
        closeLabel="Cancel"
      />
      <Alert message={fieldErrors.length ? "" : message} />

      <Input
        label="Meeting Subject / Title *"
        value={f.title}
        onChangeText={(title) => set({ title })}
        placeholder="e.g. Creative Direction Review & Milestone Alignment"
        maxLength={200}
        error={err("title")}
      />
      <Field label="Venture / Brand">
        <VentureChips value={f.brand} onChange={(brand) => set({ brand })} noneLabel="No specific venture" />
      </Field>
      <Field label="Meeting Status">
        <View className="flex-row gap-2">
          {MEETING_STATUS.map((s) => (
            <Chip key={s.value} label={s.label} active={f.status === s.value} onPress={() => set({ status: s.value })} />
          ))}
        </View>
      </Field>

      <Section>CLIENT / LEAD ASSOCIATION · OPTIONAL</Section>
      <SearchPick
        label="Registered Client"
        placeholder="Select registered client (Optional)..."
        searchPlaceholder="Search clients by company, contact..."
        noneLabel="None (Do not link client)"
        items={clientOptions(clients)}
        value={f.client}
        onChange={pickClient}
      />
      {!!client && (
        <View className="rounded-2xl bg-success/10 p-3">
          <Text className="text-sm">
            {client.companyName}{client.contactPerson ? ` (${client.contactPerson})` : ""} {client.email ? `<${client.email}>` : ""}
          </Text>
          <Text className="text-xs text-muted">Session automatically syncs to Client Portal timeline & calendar invites.</Text>
        </View>
      )}
      <SearchPick
        label="Lead Prospect"
        placeholder="Select lead prospect (Optional)..."
        searchPlaceholder="Search leads by name, company..."
        noneLabel="None (Do not link lead)"
        items={leadOptions(leads)}
        value={f.lead}
        onChange={(lead) => set({ lead })}
      />

      <Section>TIMING & SCHEDULE</Section>
      <DateField label="Date *" value={f.date} onChange={(date) => set({ date })} placeholder="Select date" error={err("date")} />
      <View className="-mt-2 flex-row gap-2">
        <Chip label="Today" active={f.date === today} onPress={() => set({ date: today })} />
        <Chip label="Tomorrow" active={f.date === tomorrow} onPress={() => set({ date: tomorrow })} />
      </View>
      <Input
        label="Start Time *"
        value={startRaw}
        onChangeText={setStartRaw}
        onEndEditing={() => {
          const t = parseTime(startRaw);
          if (t !== f.startTime) setStart(t);
          else setStartRaw(toDisplay(t));
        }}
        placeholder="9:00 AM"
        autoCapitalize="none"
        autoCorrect={false}
        error={startRaw.trim() && !parseTime(startRaw) ? "Enter a time like 9:30 AM" : err("startTime")}
      />
      <Row>
        {START_SLOTS.map((t) => (
          <Chip key={t} label={toDisplay(t)} active={f.startTime === t} onPress={() => setStart(t)} />
        ))}
      </Row>
      <Field label="End Time *">
        {f.startTime ? (
          <Row>
            {DURATIONS.map(([min, label]) => {
              const end = endFrom(f.startTime, min);
              return end ? (
                <Chip key={min} label={`${label} · ${toDisplay(end)}`} active={minutes === min} onPress={() => set({ endTime: end })} />
              ) : null;
            })}
          </Row>
        ) : <Text className="text-sm text-muted">Select start time first</Text>}
        <Text className={err("endTime") ? "text-sm text-danger" : "text-sm text-muted"}>
          {err("endTime") || (f.endTime ? `Ends at ${toDisplay(f.endTime)}` : "Select duration")}
        </Text>
      </Field>

      {!editing && (
        <>
          <Field label="Recurrence Series">
            <Row>
              {RECURRENCE.map(([v, l]) => (
                <Chip key={v} label={l} active={f.recurrence === v} onPress={() => set({ recurrence: v })} />
              ))}
            </Row>
          </Field>
          {f.recurrence !== "none" && (
            <Input
              label="Total Repeat Occurrences"
              value={f.occurrences}
              onChangeText={(occurrences) => set({ occurrences: occurrences.replace(/\D/g, "") })}
              placeholder="3"
              keyboardType="number-pad"
              maxLength={2}
              error={badOcc ? "Between 2 and 60" : ""}
            />
          )}
        </>
      )}

      <Section>CONFERENCE LINK & ROOM LOCATION</Section>
      <View className="flex-row gap-2">
        <Button
          title={link.includes("meet.google.com") ? "Meet link active" : "Generate Google Meet"}
          size="sm"
          variant="secondary"
          className="flex-1"
          disabled={g.isLoading}
          onPress={() => makeLink("google")}
        />
        <Button
          title={g.isLoading ? "Provisioning..." : link.includes("zoho") ? "Zoho link active" : "Generate Zoho link"}
          size="sm"
          variant="secondary"
          className="flex-1"
          disabled={g.isLoading}
          onPress={() => makeLink("zoho")}
        />
      </View>
      <Input
        label="Virtual Meeting URL"
        value={f.meetingLink}
        onChangeText={(meetingLink) => set({ meetingLink })}
        placeholder="https://meet.zoho.in/join/... or Google Meet"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        error={badLink ? "Invalid URL format" : err("meetingLink")}
        right={
          <Pressable onPress={paste} accessibilityLabel="Paste link" className="h-11 justify-center px-3">
            <Text className="font-body-semibold text-sm text-accent-ink">Paste</Text>
          </Pressable>
        }
      />
      {!!link && !badLink && (
        <View className="-mt-2 flex-row gap-4">
          <Pressable onPress={() => joinMeeting(link)} className="py-1"><Text className="font-body-semibold text-sm text-accent-ink">Test join link</Text></Pressable>
          <Pressable onPress={() => set({ meetingLink: "" })} className="py-1"><Text className="font-body-semibold text-sm text-danger">Remove link</Text></Pressable>
        </View>
      )}
      <Input
        label="Physical Location / Conference Room"
        value={f.location}
        onChangeText={(location) => set({ location })}
        placeholder="e.g. 4th Floor Design Studio / Remote"
        maxLength={200}
        error={err("location")}
      />

      <AttendeePicker users={users} value={f.attendees} onChange={(attendees) => set({ attendees })} loading={usersQ.isLoading} />

      <Input
        label="Discussion Agenda & Notes"
        value={f.notes}
        onChangeText={(notes) => set({ notes })}
        placeholder="Outline briefing objectives, required deliverables, key topics to resolve, or recording summary..."
        multiline
        maxLength={5000}
        style={textArea}
        error={err("notes")}
      />
      <Button
        title={editing ? "Save Changes" : "Schedule Meeting"}
        loading={c.isLoading || u.isLoading}
        disabled={!ready}
        onPress={save}
      />
    </>
  );
}

// Create, edit with ?id=, or preselect a client with ?client= (from the client page).
// Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function NewMeeting() {
  const { id, client, title, attendee, date, startTime } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetMeetingByIdQuery(id, { skip: !id });
  const meeting = data?.data?.meeting;
  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      {!id || meeting ? (
        <MeetingForm key={meeting?._id || "new"} meeting={meeting} defaultClient={client} ask={{ title, attendee, date, startTime }} />
      ) : (
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />
      )}
    </Screen>
  );
}
