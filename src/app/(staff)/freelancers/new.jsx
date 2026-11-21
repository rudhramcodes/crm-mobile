import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  DashboardState,
  DateField,
  Input,
  Pressable,
  Screen,
  SheetHeader,
  Text,
  VentureChips,
  backTo,
  showToast,
} from "@/components";
import { useTheme } from "@/constants/theme";
import {
  useCreateFreelancerMutation,
  useGetFreelancerByIdQuery,
  useUpdateFreelancerMutation,
  useUploadFreelancerPhotoMutation,
} from "@/services/freelancerApi";
import * as ImagePicker from "expo-image-picker";
import { apiError } from "@/utils/apiError";
import { runAction } from "@/utils/attendance";
import { EMAIL } from "@/utils/clients";
import {
  CONTACT_CHANNELS,
  CURRENCIES,
  FREELANCER_TYPES,
  RATE_BASES,
  SERVICE_OPTIONS,
  SKILL_LEVELS,
  freelancerBody,
  freelancerForm,
  newProfile,
  newRate,
} from "@/utils/freelancers";
import { getFieldError } from "@/utils/getFieldError";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, ChevronDown, ChevronUp, ImagePlus, Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";

const textArea = { height: 96, paddingTop: 14, textAlignVertical: "top" };

function Field({ label, children }) {
  return (
    <View className="gap-1.5">
      <Text className="font-body-medium text-sm">{label}</Text>
      {children}
    </View>
  );
}

// One row of chips that scrolls sideways when it doesn't fit.
function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
      {options.map((o) => <Chip key={o.value} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />)}
    </ScrollView>
  );
}

const MAX_PHOTO = 5 * 1024 * 1024; // the server's upload limit

// Square photo from the gallery or camera, uploaded straight away; the form then saves its URL (same as the web).
function PhotoPicker({ name, value, onChange, upload, uploading }) {
  const send = async (r) => {
    if (r.canceled) return;
    const a = r.assets[0];
    if (a.fileSize && a.fileSize > MAX_PHOTO) return showToast({ title: "Photo is over 5 MB", message: "Pick a smaller one." });
    const res = await runAction(
      upload({ uri: a.uri, file: a.file, name: a.fileName || `photo-${Date.now()}.jpg`, mime: a.mimeType || "image/jpeg" }),
      "Photo uploaded",
      "Couldn't upload the photo",
    );
    if (res?.data?.url) onChange(res.data.url);
  };
  const opts = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    // iPhone photos are HEIC; ask iOS for JPEG so every device can show it.
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  };
  const gallery = async () => send(await ImagePicker.launchImageLibraryAsync(opts));
  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return showToast({ title: "Camera access is off", message: "Allow it in Settings to take photos." });
    send(await ImagePicker.launchCameraAsync(opts));
  };
  return (
    <View className="flex-row items-center gap-4">
      <Pressable onPress={gallery} disabled={uploading} accessibilityLabel={value ? "Change photo" : "Add photo"} className={uploading ? "opacity-50" : ""}>
        <Avatar name={name || "?"} uri={value || undefined} size={72} />
      </Pressable>
      <View className="flex-1 gap-2">
        <View className="flex-row gap-2">
          <Button title={value ? "Change" : "Gallery"} icon={ImagePlus} size="sm" variant="secondary" loading={uploading} onPress={gallery} />
          {!uploading && <Button title="Camera" icon={Camera} size="sm" variant="secondary" onPress={camera} />}
        </View>
        {!!value && !uploading && (
          <Pressable onPress={() => onChange("")} accessibilityLabel="Remove photo" className="self-start py-1">
            <Text className="text-sm text-danger">Remove photo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function RateEditor({ rate: r, onChange, onRemove }) {
  const theme = useTheme();
  const set = (k) => (v) => onChange({ ...r, [k]: v });
  return (
    <View className="gap-3 rounded-2xl border border-line p-3">
      <ChipRow options={RATE_BASES} value={r.rateBasis} onChange={set("rateBasis")} />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input value={r.amount} onChangeText={(v) => set("amount")(v.replace(/[^0-9.]/g, ""))} placeholder="Amount, e.g. 5000" keyboardType="decimal-pad" accessibilityLabel="Rate amount" />
        </View>
        {CURRENCIES.map((c) => <Chip key={c} label={c} active={r.currency === c} onPress={() => set("currency")(c)} />)}
      </View>
      <DateField label="From" value={r.effectiveFrom} onChange={set("effectiveFrom")} />
      <DateField label="Until (optional)" value={r.effectiveUntil} onChange={set("effectiveUntil")} onClear={() => set("effectiveUntil")("")} minDate={r.effectiveFrom} placeholder="No end date" />
      <Input value={r.notes} onChangeText={set("notes")} placeholder="Rate notes, e.g. Travel and stay extra" maxLength={500} accessibilityLabel="Rate notes" />
      <Pressable onPress={onRemove} accessibilityLabel="Remove rate" className="flex-row items-center gap-1.5 self-start py-1">
        <Trash2 size={14} color={theme.danger} />
        <Text className="text-sm text-danger">Remove rate</Text>
      </Pressable>
    </View>
  );
}

function VentureEditor({ profile: p, index, count, taken, onChange, onRemove }) {
  const theme = useTheme();
  const set = (k) => (v) => onChange({ ...p, [k]: v });
  const catalog = SERVICE_OPTIONS[p.venture] || [];
  const toggle = (s) => set("serviceCategories")(p.serviceCategories.includes(s) ? p.serviceCategories.filter((x) => x !== s) : [...p.serviceCategories, s]);
  const setRate = (i) => (r) => set("rateCards")(p.rateCards.map((x, j) => (j === i ? r : x)));
  // Same as the web: switching venture clears its services and rates.
  const pickVenture = (v) => {
    if (v === p.venture) return;
    if (taken.includes(v)) return showToast({ title: "That venture is already added" });
    onChange({ ...p, venture: v, serviceCategories: [], otherServices: "", rateCards: [] });
  };
  return (
    <Card className="gap-4 p-4">
      <View className="flex-row items-center">
        <Text className="flex-1 text-caption text-muted">VENTURE {index + 1}</Text>
        {count > 1 && (
          <Pressable onPress={onRemove} accessibilityLabel={`Remove venture ${index + 1}`} hitSlop={8}>
            <Trash2 size={18} color={theme.danger} />
          </Pressable>
        )}
      </View>
      <VentureChips value={p.venture} onChange={pickVenture} noneLabel={null} />
      <Input label="Title" value={p.internalTitle} onChangeText={set("internalTitle")} placeholder="e.g. Lead Photographer" maxLength={120} />
      <Field label="Skill level">
        <ChipRow options={SKILL_LEVELS} value={p.skillLevel} onChange={set("skillLevel")} />
      </Field>
      {!!catalog.length && (
        <Field label="Services">
          <View className="flex-row flex-wrap gap-2">
            {catalog.map((s) => <Chip key={s} label={s} active={p.serviceCategories.includes(s)} onPress={() => toggle(s)} />)}
          </View>
        </Field>
      )}
      <Input label={catalog.length ? "Other services" : "Services"} value={p.otherServices} onChangeText={set("otherServices")} placeholder="e.g. Mehendi Artist, Choreographer" hint="Separate with commas" />
      <Field label="Rates">
        <Text className="text-sm text-muted">Add a new rate instead of changing an old one, so past agreements stay on record.</Text>
        {p.rateCards.map((r, i) => (
          <RateEditor key={r._id || `new-${i}`} rate={r} onChange={setRate(i)} onRemove={() => set("rateCards")(p.rateCards.filter((_, j) => j !== i))} />
        ))}
        <Button title="Add rate" icon={Plus} size="sm" variant="secondary" className="self-start" onPress={() => set("rateCards")([...p.rateCards, newRate()])} />
      </Field>
      <Input label="Experience summary" value={p.experienceSummary} onChangeText={set("experienceSummary")} placeholder="e.g. Shot 40+ weddings across Rajasthan, strong in candid and low light" multiline maxLength={1000} style={textArea} />
      <Input label="Venture notes" value={p.notes} onChangeText={set("notes")} placeholder="Anything the team should know for this venture" multiline maxLength={1000} style={textArea} />
    </Card>
  );
}

function FreelancerForm({ freelancer }) {
  const theme = useTheme();
  const editing = !!freelancer;
  const [create, c] = useCreateFreelancerMutation();
  const [update, u] = useUpdateFreelancerMutation();
  const [upload, up] = useUploadFreelancerPhotoMutation();
  const [f, setF] = useState(() => freelancerForm(freelancer));
  const [more, setMore] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const setIn = (group, k) => (v) => setF((x) => ({ ...x, [group]: { ...x[group], [k]: v } }));
  const setProfile = (i) => (p) => setF((x) => ({ ...x, ventureProfiles: x.ventureProfiles.map((y, j) => (j === i ? p : y)) }));
  const { message, fieldErrors } = apiError(c.error || u.error);
  const err = (k) => getFieldError(fieldErrors, k);

  const email = f.email.trim();
  const badEmail = !!email && !EMAIL.test(email);
  const ready = f.fullName.trim().length >= 2 && f.phone.trim().length >= 5 && f.ventureProfiles.length > 0 && !badEmail;
  const used = f.ventureProfiles.map((p) => p.venture);

  const addVenture = () => {
    const next = ["panigrahna", "aghori", "house_of_joggi", "damrru", "tandavs", "kapaalik", "kalyannam"].find((v) => !used.includes(v));
    if (next) setF((x) => ({ ...x, ventureProfiles: [...x.ventureProfiles, newProfile(next)] }));
  };

  const save = async () => {
    const body = freelancerBody(f);
    if (editing) {
      if (await runAction(update({ id: freelancer._id, ...body }), "Freelancer updated", "Couldn't save the freelancer")) backTo(`/freelancers/${freelancer._id}`);
      return;
    }
    const res = await runAction(create(body), "Freelancer added", "Couldn't add the freelancer");
    const id = res?.data?.freelancer?._id;
    if (id) router.replace(`/freelancers/${id}`);
    else if (res) backTo("/freelancers");
  };

  return (
    <>
      <SheetHeader title={editing ? "Edit freelancer" : "Add freelancer"} sub={editing ? freelancer.fullName : "Only name, phone and one venture are needed. Add the rest later."} closeLabel="Cancel" />
      <Alert message={fieldErrors.length ? "" : message} />

      <Text className="text-caption text-muted">BASICS</Text>
      <PhotoPicker name={f.fullName} value={f.profilePhoto} onChange={set("profilePhoto")} upload={upload} uploading={up.isLoading} />
      <Input label="Full name *" value={f.fullName} onChangeText={set("fullName")} placeholder="e.g. Rahul Sharma" autoCapitalize="words" autoComplete="name" maxLength={120} error={err("fullName")} />
      <Input label="Phone *" value={f.phone} onChangeText={set("phone")} placeholder="98765 43210" keyboardType="phone-pad" autoComplete="tel" maxLength={30} error={err("phone")} />
      <Input label="WhatsApp number" value={f.whatsappNumber} onChangeText={set("whatsappNumber")} placeholder="Leave empty if same as phone" keyboardType="phone-pad" maxLength={30} error={err("whatsappNumber")} />
      <Input label="Email" value={f.email} onChangeText={set("email")} placeholder="e.g. rahul@gmail.com" keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} error={badEmail ? "Enter a valid email" : err("email")} />
      <Input label="City" value={f.city} onChangeText={set("city")} placeholder="e.g. Jaipur" autoCapitalize="words" maxLength={120} error={err("city")} />
      <Field label="Type">
        <ChipRow options={FREELANCER_TYPES} value={f.freelancerType} onChange={set("freelancerType")} />
      </Field>
      <Field label="Preferred contact">
        <ChipRow options={CONTACT_CHANNELS} value={f.preferredContactChannel} onChange={set("preferredContactChannel")} />
      </Field>

      <Text className="text-caption text-muted">VENTURES & RATES</Text>
      {!!err("ventureProfiles") && <Text className="text-sm text-danger">{err("ventureProfiles")}</Text>}
      {f.ventureProfiles.map((p, i) => (
        <VentureEditor
          key={p._id || `venture-${i}`}
          profile={p}
          index={i}
          count={f.ventureProfiles.length}
          taken={used.filter((_, j) => j !== i)}
          onChange={setProfile(i)}
          onRemove={() => setF((x) => ({ ...x, ventureProfiles: x.ventureProfiles.filter((_, j) => j !== i) }))}
        />
      ))}
      {used.length < 7 && <Button title="Add another venture" icon={Plus} size="sm" variant="ghost" className="self-start" onPress={addVenture} />}

      <Pressable onPress={() => setMore((m) => !m)} accessibilityState={{ expanded: more }} accessibilityLabel="More details" className="flex-row items-center justify-between border-t border-line pt-4">
        <View>
          <Text className="font-body-semibold">More details</Text>
          <Text className="text-sm text-muted">Bio, portfolio, address, emergency contact</Text>
        </View>
        {more ? <ChevronUp size={20} color={theme.muted} /> : <ChevronDown size={20} color={theme.muted} />}
      </Pressable>
      {more && (
        <>
          <Input label="Display name" value={f.displayName} onChangeText={set("displayName")} placeholder="Name shown to the team, e.g. Rahul Clicks" maxLength={120} />
          <Input label="Years of experience" value={f.experienceYears} onChangeText={(v) => set("experienceYears")(v.replace(/\D/g, ""))} placeholder="e.g. 5" keyboardType="number-pad" maxLength={2} error={err("experienceYears")} />
          <Input label="Bio" value={f.bio} onChangeText={set("bio")} placeholder="Short intro: style, specialities, notable work" multiline maxLength={2000} style={textArea} />
          <Input label="Portfolio links" value={f.portfolioLinks} onChangeText={set("portfolioLinks")} placeholder={"One link per line, e.g.\nhttps://instagram.com/rahulclicks"} multiline autoCapitalize="none" autoCorrect={false} keyboardType="url" style={textArea} />
          <Input label="Languages" value={f.languages} onChangeText={set("languages")} placeholder="e.g. Hindi, English, Marwari" />
          <Input label="Service areas" value={f.serviceAreas} onChangeText={set("serviceAreas")} placeholder="e.g. Jaipur, Udaipur, Delhi NCR" />
          <Input label="Internal tags" value={f.internalTags} onChangeText={set("internalTags")} placeholder="e.g. reliable, weekends only, own gear" />

          <Text className="text-caption text-muted">ADDRESS</Text>
          <Input label="Street / address" value={f.address.street} onChangeText={setIn("address", "street")} placeholder="House no., street, area" />
          <Input label="City" value={f.address.city} onChangeText={setIn("address", "city")} placeholder="e.g. Jaipur" autoCapitalize="words" />
          <Input label="State" value={f.address.state} onChangeText={setIn("address", "state")} placeholder="e.g. Rajasthan" autoCapitalize="words" />
          <Input label="Pincode" value={f.address.pincode} onChangeText={setIn("address", "pincode")} placeholder="e.g. 302001" keyboardType="number-pad" maxLength={10} />

          <Text className="text-caption text-muted">EMERGENCY CONTACT</Text>
          <Input label="Name" value={f.emergencyContact.name} onChangeText={setIn("emergencyContact", "name")} placeholder="e.g. Sunita Sharma" autoCapitalize="words" />
          <Input label="Relationship" value={f.emergencyContact.relationship} onChangeText={setIn("emergencyContact", "relationship")} placeholder="e.g. Mother, Spouse" />
          <Input label="Phone" value={f.emergencyContact.phone} onChangeText={setIn("emergencyContact", "phone")} placeholder="98765 43210" keyboardType="phone-pad" />
        </>
      )}

      <Button title={editing ? "Save changes" : "Add freelancer"} loading={c.isLoading || u.isLoading} disabled={!ready || up.isLoading} onPress={save} />
    </>
  );
}

// Create, or edit with ?id=. Android shows modals full screen under the status bar, so it needs the top inset; iOS sheets don't.
export default function NewFreelancer() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, refetch } = useGetFreelancerByIdQuery(id, { skip: !id });
  const freelancer = data?.data?.freelancer;
  return (
    <Screen scroll edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-5 pt-6">
      {!id || freelancer ? (
        <FreelancerForm key={freelancer?._id || "new"} freelancer={freelancer} />
      ) : (
        <DashboardState isLoading={isLoading} isError={isError || !isLoading} refetch={refetch} />
      )}
    </Screen>
  );
}
