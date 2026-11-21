import {
  Avatar,
  Badge,
  BrandMark,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  DashboardState,
  FreelancerStatusBadge,
  PageHeader,
  Pressable,
  Screen,
  Text,
  backTo,
  brandLabel,
  contactFreelancer,
  freelancerAccess,
  showToast,
  usePullRefresh,
} from "@/components";
import { useTheme } from "@/constants/theme";
import {
  useArchiveFreelancerMutation,
  useDeleteFreelancerMutation,
  useGetFreelancerByIdQuery,
  useUpdateFreelancerMutation,
} from "@/services/freelancerApi";
import { runAction } from "@/utils/attendance";
import { FREELANCER_TYPES, SKILL_LEVELS, currentRate, formatRate, labelOf } from "@/utils/freelancers";
import { router, useLocalSearchParams } from "expo-router";
import { Archive, ArchiveRestore, ExternalLink, Mail, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Linking, View } from "react-native";
import { useSelector } from "react-redux";

const Label = ({ children }) => <Text className="text-caption text-muted">{children}</Text>;
const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Field({ label, value }) {
  if (!value) return null;
  return (
    <View className="flex-row gap-3">
      <Text className="w-28 text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-sm" selectable>{value}</Text>
    </View>
  );
}

// Icon then label on one line; tight padding and a shrink-to-fit label so "WhatsApp" never wraps on narrow phones.
function ContactTile({ icon: Icon, label, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-2">
      <Icon size={16} color={theme.ink} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} className="shrink font-body-semibold text-sm">{label}</Text>
    </Pressable>
  );
}

function VentureCard({ profile: p }) {
  const now = currentRate(p.rateCards);
  const history = [...(p.rateCards || [])].sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <BrandMark brand={p.venture} size={36} />
        <View className="flex-1">
          <Text className="font-body-semibold">{brandLabel(p.venture)}</Text>
          <Text className="text-sm text-muted">{[p.internalTitle || "Crew member", `${labelOf(SKILL_LEVELS, p.skillLevel)} level`].join(" · ")}</Text>
        </View>
        {p.active === false && <Badge label="Inactive" />}
      </View>
      {!!p.serviceCategories?.length && (
        <View className="flex-row flex-wrap gap-1.5">
          {p.serviceCategories.map((s) => <Badge key={s} label={s} variant="info" />)}
        </View>
      )}
      {now ? (
        <View className="gap-0.5 rounded-2xl bg-surface-2 p-3">
          <Text className="text-xs text-muted">Current rate</Text>
          <Text className="font-body-semibold tabular-nums">{formatRate(now)}</Text>
          {!!now.notes && <Text className="text-sm text-muted">{now.notes}</Text>}
        </View>
      ) : (
        <Text className="text-sm text-muted">No rate added.</Text>
      )}
      {history.length > 1 && (
        <View className="gap-1.5">
          <Label>RATE HISTORY</Label>
          {history.map((r, i) => (
            <View key={r._id || i} className={r === now ? "flex-row gap-3" : "flex-row gap-3 opacity-50"}>
              <Text className="flex-1 text-sm tabular-nums">{formatRate(r)}</Text>
              <Text className="text-sm text-muted">
                {day(r.effectiveFrom)}{r.effectiveUntil ? ` – ${day(r.effectiveUntil)}` : " onwards"}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Field label="Experience" value={p.experienceSummary} />
      <Field label="Notes" value={p.notes} />
    </Card>
  );
}

function FreelancerBody({ freelancer: f }) {
  const theme = useTheme();
  const me = useSelector((s) => s.auth.user);
  const can = freelancerAccess(me);
  const [update, u] = useUpdateFreelancerMutation();
  const [archive, a] = useArchiveFreelancerMutation();
  const [del, d] = useDeleteFreelancerMutation();
  const [confirm, setConfirm] = useState(null); // 'archive' | 'delete'
  const archived = f.status === "archived";
  const address = [f.address?.street, f.address?.city, f.address?.state, f.address?.pincode].filter(Boolean).join(", ");
  const ec = f.emergencyContact || {};

  const setStatus = (status, done = `Marked ${status}`) => {
    if (status === f.status || u.isLoading) return;
    runAction(update({ id: f._id, status }), done, "Couldn't update the status");
  };
  const openLink = (url) =>
    Linking.openURL(/^https?:\/\//i.test(url) ? url : `https://${url}`).catch(() => showToast({ title: "Couldn't open the link" }));

  return (
    <>
      <PageHeader
        caption={f.freelancerCode || "FREELANCER"}
        title={f.fullName}
        fallback="/freelancers"
        right={
          can.manage && !archived ? (
            <Pressable
              onPress={() => router.push({ pathname: "/freelancers/new", params: { id: f._id } })}
              accessibilityLabel="Edit freelancer"
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-surface-2 px-4"
            >
              <Pencil size={16} color={theme.ink} />
              <Text className="font-body-semibold text-sm">Edit</Text>
            </Pressable>
          ) : null
        }
      />

      <Card className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <Avatar name={f.fullName} uri={f.profilePhoto || undefined} size={52} />
          <View className="flex-1 gap-1">
            <Text className="text-sm text-muted">
              {[labelOf(FREELANCER_TYPES, f.freelancerType), f.experienceYears ? `${f.experienceYears} yrs experience` : "", f.city].filter(Boolean).join(" · ")}
            </Text>
            <FreelancerStatusBadge status={f.status} />
          </View>
        </View>
        <View className="flex-row gap-2">
          <ContactTile icon={Phone} label="Call" onPress={() => contactFreelancer(f, "call")} />
          <ContactTile icon={MessageCircle} label="WhatsApp" onPress={() => contactFreelancer(f, "whatsapp")} />
          {!!f.email && <ContactTile icon={Mail} label="Email" onPress={() => contactFreelancer(f, "email")} />}
        </View>
      </Card>

      {can.manage && !archived && (
        <View className="gap-2">
          <Label>STATUS</Label>
          <View className="flex-row gap-2">
            <Chip label="Active" active={f.status === "active"} onPress={() => setStatus("active")} />
            <Chip label="Inactive" active={f.status === "inactive"} onPress={() => setStatus("inactive")} />
          </View>
        </View>
      )}

      <View className="gap-3">
        <Label>VENTURES · {f.ventureProfiles?.length || 0}</Label>
        {(f.ventureProfiles || []).map((p) => <VentureCard key={p._id || p.venture} profile={p} />)}
      </View>

      {(!!f.bio || !!f.portfolioLinks?.length) && (
        <Card className="gap-3 p-4">
          <Label>ABOUT</Label>
          {!!f.bio && <Text selectable>{f.bio}</Text>}
          {(f.portfolioLinks || []).map((url) => (
            <Pressable key={url} onPress={() => openLink(url)} accessibilityLabel={`Open ${url}`} className="flex-row items-center gap-2">
              <ExternalLink size={14} color={theme["accent-ink"]} />
              <Text numberOfLines={1} className="flex-1 text-sm text-accent-ink">{url}</Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Card className="gap-3 p-4">
        <Label>CONTACT DETAILS</Label>
        <Field label="Phone" value={f.phone} />
        <Field label="WhatsApp" value={f.whatsappNumber} />
        <Field label="Alt. phone" value={f.alternatePhone} />
        <Field label="Email" value={f.email} />
        <Field label="Prefers" value={f.preferredContactChannel ? `${f.preferredContactChannel[0].toUpperCase()}${f.preferredContactChannel.slice(1)}` : ""} />
        <Field label="Address" value={address} />
        <Field label="Service areas" value={f.serviceAreas?.join(", ")} />
        <Field label="Languages" value={f.languages?.join(", ")} />
        <Field label="Emergency" value={[ec.name, ec.relationship, ec.phone].filter(Boolean).join(" · ")} />
        <Field label="Tags" value={f.internalTags?.join(", ")} />
        <Field label="Added" value={f.createdAt ? `${day(f.createdAt)}${f.createdBy?.name ? ` by ${f.createdBy.name}` : " (applied online)"}` : ""} />
      </Card>

      {can.remove && (
        archived ? (
          <View className="gap-2">
            <Button title="Restore" icon={ArchiveRestore} variant="secondary" loading={u.isLoading} onPress={() => setStatus("active", "Freelancer restored")} />
            <Button
              title="Delete permanently"
              icon={Trash2}
              variant="ghost"
              className="bg-danger/10"
              textClassName="text-danger"
              iconColor={theme.danger}
              onPress={() => setConfirm("delete")}
            />
          </View>
        ) : (
          <Button title="Archive" icon={Archive} variant="ghost" className="bg-danger/10" textClassName="text-danger" iconColor={theme.danger} onPress={() => setConfirm("archive")} />
        )
      )}

      <ConfirmDialog
        visible={!!confirm}
        title={confirm === "delete" ? "Delete permanently?" : "Archive freelancer?"}
        message={confirm === "delete" ? `${f.fullName} will be deleted. This can't be undone.` : `${f.fullName} will be hidden from the list. Their history is kept and you can restore them later.`}
        confirmLabel={confirm === "delete" ? "Delete" : "Archive"}
        loading={a.isLoading || d.isLoading}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const ok = confirm === "delete"
            ? await runAction(del(f._id), "Freelancer permanently deleted", "Couldn't delete the freelancer")
            : await runAction(archive(f._id), "Freelancer archived", "Couldn't archive the freelancer");
          const wasDelete = confirm === "delete";
          setConfirm(null);
          if (ok && wasDelete) backTo("/freelancers");
        }}
      />
    </>
  );
}

export default function FreelancerDetail() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetFreelancerByIdQuery(id);
  const refreshControl = usePullRefresh(refetch);
  const freelancer = data?.data?.freelancer;
  return (
    <Screen scroll className="gap-5 pt-2" refreshControl={refreshControl}>
      {freelancer ? (
        <FreelancerBody key={freelancer._id} freelancer={freelancer} />
      ) : (
        <>
          <PageHeader caption="FREELANCER" title="" fallback="/freelancers" />
          <DashboardState isLoading={isLoading} isError={isError || (!isLoading && !freelancer)} refetch={refetch} />
        </>
      )}
    </Screen>
  );
}
