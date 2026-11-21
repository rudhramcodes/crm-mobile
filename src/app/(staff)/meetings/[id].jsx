import {
  Avatar,
  Badge,
  BrandMark,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  DashboardState,
  Input,
  MeetingStatusBadge,
  PageHeader,
  Pressable,
  Screen,
  Text,
  backTo,
  brandLabel,
  joinMeeting,
  meetingAccess,
  meetingDay,
  meetingTime,
  usePullRefresh,
} from "@/components";
import { MEETING_STATUS, ROLE_LABELS } from "@/constants";
import { useTheme } from "@/constants/theme";
import {
  useAddActionItemMutation,
  useDeleteMeetingMutation,
  useGetMeetingByIdQuery,
  useRemoveActionItemMutation,
  useUpdateActionItemMutation,
  useUpdateMeetingMutation,
  useUpdateMeetingNotesMutation,
} from "@/services/meetingApi";
import { useGetUsersQuery } from "@/services/userApi";
import { runAction } from "@/utils/attendance";
import { cn } from "@/utils/cn";
import { meetingBrand } from "@/utils/meetings";
import { router, useLocalSearchParams } from "expo-router";
import {
  Building2,
  Check,
  CheckSquare,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
  User,
  Users,
  Video,
} from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useSelector } from "react-redux";

const Label = ({ children }) => (
  <Text className="text-caption text-muted">{children}</Text>
);
const shortDay = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const area = {
  minHeight: 110,
  height: undefined,
  paddingTop: 14,
  paddingBottom: 14,
  textAlignVertical: "top",
};

function Tile({ icon: Icon, label, value, onPress, muted }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${label}: ${value}`}
      className="flex-row items-center gap-3 rounded-2xl bg-surface-2 p-3"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface">
        <Icon size={16} color={theme.muted} />
      </View>
      <View className="flex-1">
        <Text className="text-caption text-muted">{label.toUpperCase()}</Text>
        <Text
          numberOfLines={1}
          className={cn(
            "text-sm",
            muted ? "text-muted" : "font-body-medium",
            onPress && "text-accent-ink",
          )}
        >
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

function MeetingBody({ meeting: m }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = meetingAccess(me);
  const [update] = useUpdateMeetingMutation();
  const [saveNotes, n] = useUpdateMeetingNotesMutation();
  const [addItem, a] = useAddActionItemMutation();
  const [updateItem] = useUpdateActionItemMutation();
  const [removeItem] = useRemoveActionItemMutation();
  const [del, d] = useDeleteMeetingMutation();
  const users = useGetUsersQuery({ limit: 100 }).data?.data?.users || [];
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(m.notes || "");
  const [item, setItem] = useState("");
  const [confirming, setConfirming] = useState(false);
  const brand = meetingBrand(m);
  const items = m.actionItems || [];
  const done = items.filter((x) => x.status === "done").length;
  const nameOf = (a) =>
    a && typeof a === "object" ? a.name : users.find((u) => u._id === a)?.name;

  const setStatus = (status) =>
    status !== m.status &&
    runAction(
      update({ id: m._id, status }),
      `Meeting status updated to ${status}`,
      "Failed to update status",
    );
  const submitNotes = async () => {
    if (
      await runAction(
        saveNotes({ id: m._id, notes: notes.trim() }),
        "Notes updated successfully",
        "Failed to update notes",
      )
    )
      setEditingNotes(false);
  };
  const submitItem = async () => {
    const text = item.trim();
    if (!text || a.isLoading) return;
    if (
      await runAction(
        addItem({ id: m._id, text }),
        "Action item added",
        "Couldn't add the action item",
      )
    )
      setItem("");
  };
  const convert = (x) =>
    router.push({
      pathname: "/meetings/convert",
      params: {
        id: m._id,
        itemId: x._id,
        text: x.text,
        assignee: x.assignee?._id || x.assignee || "",
        dueDate: x.dueDate ? String(x.dueDate).slice(0, 10) : "",
      },
    });

  return (
    <>
      <PageHeader
        caption={brand ? brandLabel(brand).toUpperCase() : "MEETING"}
        title={m.title}
        fallback="/meetings"
        right={
          can.manage ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/meetings/new",
                  params: { id: m._id },
                })
              }
              accessibilityLabel="Edit meeting"
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4"
            >
              <Pencil size={16} color={theme.ink} />
              <Text className="font-body-semibold text-sm">Edit</Text>
            </Pressable>
          ) : null
        }
      />

      <View className="flex-row flex-wrap items-center gap-2">
        <MeetingStatusBadge status={m.status} />
        {!!m.seriesId && <Badge label="Recurring series" variant="info" />}
        {!!brand && (
          <View className="flex-row items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1 pr-3">
            <BrandMark brand={brand} size={20} />
            <Text className="font-body-medium text-xs">
              {brandLabel(brand)}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-muted">
        {meetingDay(m, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}{" "}
        · {meetingTime(m)}
      </Text>

      {!!m.meetingLink && (
        <Button
          title="Join video meeting"
          icon={Video}
          onPress={() => joinMeeting(m.meetingLink)}
        />
      )}

      {can.manage && (
        <View className="gap-2">
          <Label>STATUS</Label>
          <View className="flex-row gap-2">
            {MEETING_STATUS.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={m.status === s.value}
                onPress={() => setStatus(s.value)}
              />
            ))}
          </View>
        </View>
      )}

      <View className="gap-2">
        {m.client ? (
          <Tile
            icon={Building2}
            label="Client profile"
            value={m.client.companyName}
            onPress={() => router.push(`/clients/${m.client._id}`)}
          />
        ) : m.lead ? (
          <Tile
            icon={User}
            label="Lead opportunity"
            value={m.lead.name}
            onPress={() => router.push(`/leads/${m.lead._id}`)}
          />
        ) : (
          <Tile
            icon={Building2}
            label="Related entity"
            value="Internal meeting"
            muted
          />
        )}
        {m.meetingLink ? (
          <Tile
            icon={Video}
            label="Video conference"
            value={m.meetingLink}
            onPress={() => joinMeeting(m.meetingLink)}
          />
        ) : (
          <Tile
            icon={Video}
            label="Video link"
            value="In-person session"
            muted
          />
        )}
        {!!m.location && (
          <Tile icon={MapPin} label="Location" value={m.location} />
        )}
        <Tile
          icon={Users}
          label="Participants"
          value={`${m.attendees?.length || 0} ${m.attendees?.length === 1 ? "member" : "members"} invited`}
        />
      </View>

      {!!m.attendees?.length && (
        <Card className="gap-3 p-4">
          <Label>INVITED PARTICIPANTS ({m.attendees.length})</Label>
          {m.attendees.map((p) => {
            const full = users.find((u) => u._id === (p._id || p)) || p;
            return (
              <View key={p._id || p} className="flex-row items-center gap-3">
                <Avatar
                  name={full.name || full.email || "User"}
                  uri={full.avatar}
                  size={32}
                />
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-body-medium">
                    {full.name || "User"}
                  </Text>
                  {!!full.email && (
                    <Text numberOfLines={1} className="text-xs text-muted">
                      {full.email}
                    </Text>
                  )}
                </View>
                <Badge
                  label={ROLE_LABELS[full.role] || "Staff"}
                  variant={full.role === "client" ? "success" : "default"}
                />
              </View>
            );
          })}
        </Card>
      )}

      <View className="gap-2">
        <View className="flex-row items-center">
          <View className="flex-1">
            <Label>DISCUSSION NOTES</Label>
          </View>
          {!editingNotes && (
            <Pressable
              onPress={() => setEditingNotes(true)}
              accessibilityLabel="Edit notes"
              className="h-9 justify-center"
            >
              <Text className="font-body-semibold text-sm text-accent-ink">
                Edit notes
              </Text>
            </Pressable>
          )}
        </View>
        {editingNotes ? (
          <>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="What was discussed in this session? Key conclusions, agreements..."
              accessibilityLabel="Discussion notes"
              multiline
              maxLength={5000}
              style={area}
              autoFocus
            />
            <View className="flex-row gap-2">
              <Button
                title="Cancel"
                size="sm"
                variant="secondary"
                className="flex-1"
                onPress={() => {
                  setNotes(m.notes || "");
                  setEditingNotes(false);
                }}
              />
              <Button
                title="Save notes"
                size="sm"
                className="flex-1"
                loading={n.isLoading}
                onPress={submitNotes}
              />
            </View>
          </>
        ) : m.notes ? (
          <Text selectable>{m.notes}</Text>
        ) : (
          <Text className="text-sm text-muted">
            No discussion notes recorded yet.
          </Text>
        )}
      </View>

      <View className="gap-3">
        <Label>
          ACTION ITEMS ({done}/{items.length} DONE)
        </Label>
        {items.map((x) => {
          const isDone = x.status === "done";
          const who = nameOf(x.assignee);
          const meta = [
            who && `Assignee: ${who}`,
            x.dueDate && `Due: ${shortDay(x.dueDate)}`,
            x.convertedToTask && "Converted to task",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <View
              key={x._id}
              className="flex-row items-start gap-3 rounded-2xl bg-surface-2 p-3"
            >
              <Pressable
                onPress={() =>
                  runAction(
                    updateItem({
                      id: m._id,
                      itemId: x._id,
                      status: isDone ? "pending" : "done",
                    }),
                    null,
                    "Couldn't update the action item",
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={isDone ? "Mark pending" : "Mark done"}
                hitSlop={8}
                className={cn(
                  "mt-0.5 h-6 w-6 items-center justify-center rounded-full border-[1.5px]",
                  isDone ? "border-success bg-success" : "border-line",
                )}
              >
                {isDone && <Check size={14} color={theme.bg} />}
              </Pressable>
              <View className="flex-1 gap-1">
                <Text className={cn(isDone && "text-muted line-through")}>
                  {x.text}
                </Text>
                {!!meta && <Text className="text-xs text-muted">{meta}</Text>}
                {can.manage && (
                  <View className="flex-row gap-4 pt-1">
                    {!x.convertedToTask && (
                      <Pressable
                        onPress={() => convert(x)}
                        accessibilityLabel={`Convert "${x.text}" to a task`}
                        className="flex-row items-center gap-1 py-1"
                      >
                        <CheckSquare size={14} color={theme["accent-ink"]} />
                        <Text className="font-body-semibold text-sm text-accent-ink">
                          Convert
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() =>
                        runAction(
                          removeItem({ id: m._id, itemId: x._id }),
                          "Action item removed",
                          "Couldn't remove the action item",
                        )
                      }
                      accessibilityLabel={`Remove "${x.text}"`}
                      className="py-1"
                    >
                      <Text className="font-body-semibold text-sm text-danger">
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {!items.length && (
          <Text className="text-sm text-muted">
            No follow-up action items created.
          </Text>
        )}
        {can.manage && (
          <View className="flex-row items-start gap-2">
            <Input
              className="flex-1"
              value={item}
              onChangeText={setItem}
              placeholder="Add a new action item…"
              accessibilityLabel="New action item"
              maxLength={500}
              returnKeyType="done"
              onSubmitEditing={submitItem}
            />
            <Button
              title="Add"
              size="sm"
              className="mt-1"
              loading={a.isLoading}
              disabled={!item.trim()}
              onPress={submitItem}
            />
          </View>
        )}
      </View>

      {can.remove && (
        <>
          <Button
            title="Delete meeting"
            icon={Trash2}
            variant="ghost"
            className="bg-danger/10"
            textClassName="text-danger"
            iconColor={theme.danger}
            onPress={() => setConfirming(true)}
          />
          <ConfirmDialog
            visible={confirming}
            title="Delete meeting session?"
            message="Are you sure you want to permanently delete this meeting? This action cannot be undone."
            confirmLabel="Delete"
            loading={d.isLoading}
            onCancel={() => setConfirming(false)}
            onConfirm={async () => {
              const ok = await runAction(
                del({ id: m._id }),
                "Meeting deleted successfully",
                "Failed to delete meeting",
              );
              setConfirming(false);
              if (ok) backTo("/meetings");
            }}
          />
        </>
      )}
      {!!m.seriesId && can.remove && (
        <View className="flex-row items-center gap-1.5">
          <Repeat size={13} color={theme.muted} />
          <Text className="text-xs text-muted">
            This deletes this occurrence only. Delete the whole series from the
            meetings list.
          </Text>
        </View>
      )}
    </>
  );
}

export default function MeetingDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetMeetingByIdQuery(id);
  const refreshControl = usePullRefresh(refetch);
  const meeting = data?.data?.meeting;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {meeting ? (
        <MeetingBody key={meeting._id} meeting={meeting} />
      ) : (
        <>
          <PageHeader caption="MEETING" title="" fallback="/meetings" />
          <DashboardState
            isLoading={isLoading}
            isError={isError || (!isLoading && !meeting)}
            refetch={refetch}
          />
        </>
      )}
    </Screen>
  );
}
