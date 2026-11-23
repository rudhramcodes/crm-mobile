import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useDispatch } from "react-redux";
import { Check, Download, Search } from "lucide-react-native";
import { Avatar, Button, DashboardState, Input, Pressable, Screen, SheetHeader, Text, VentureChips, backTo, showToast } from "@/components";
import { useTheme } from "@/constants/theme";
import { fetchAllClients, saveClientsToContacts } from "@/services/clientContacts";
import { toE164 } from "@/utils/clientContacts";
import { cn } from "@/utils/cn";

function ClientPickRow({ client: c, selected, onToggle }) {
  const theme = useTheme();
  const hasPhone = !!toE164(c.phone);
  return (
    <Pressable
      onPress={hasPhone ? onToggle : undefined}
      disabled={!hasPhone}
      haptic={false}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: !hasPhone }}
      accessibilityLabel={`${c.contactPerson || c.companyName}${hasPhone ? `, ${c.phone}` : ", no phone number"}`}
      className={cn("mb-2 flex-row items-center gap-3 rounded-2xl border bg-surface p-3", selected ? "border-accent" : "border-line", !hasPhone && "opacity-50")}
    >
      <View className={cn("h-6 w-6 items-center justify-center rounded-full border-[1.5px]", selected ? "border-ink bg-ink" : "border-line")}>
        {selected && <Check size={14} color={theme.bg} />}
      </View>
      <Avatar name={c.contactPerson || c.companyName} size={36} />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-body-semibold">{c.contactPerson || c.companyName}</Text>
        <Text numberOfLines={1} className="text-sm text-muted">
          {[c.clientId, c.contactPerson && c.companyName, hasPhone ? c.phone : "No phone number"].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

// Admins: pick which clients to save into this phone's Contacts (search, select all, or a few).
export default function SaveClientContacts() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [clients, setClients] = useState(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  // Every client (all pages), loaded once when the screen opens.
  const fetchAll = () => fetchAllClients(dispatch).then(setClients, () => setError(true));
  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once on open
  const load = () => { setError(false); fetchAll(); };

  const term = q.trim().toLowerCase();
  const shown = useMemo(() => (clients || [])
    .filter((c) => !brand || c.brand === brand)
    .filter((c) => !term || `${c.companyName} ${c.contactPerson || ""} ${c.phone || ""}`.toLowerCase().includes(term))
    .sort((a, b) => String(a.contactPerson || a.companyName).localeCompare(String(b.contactPerson || b.companyName))), [clients, term, brand]);
  const selectable = shown.filter((c) => toE164(c.phone));
  // Clients per venture (all clients, so the counts don't jump while searching).
  const counts = useMemo(() => (clients || []).reduce((acc, c) => ({ ...acc, "": (acc[""] || 0) + 1, [c.brand]: (acc[c.brand] || 0) + 1 }), {}), [clients]);
  const allShownPicked = selectable.length > 0 && selectable.every((c) => picked.has(c._id));

  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Select all acts on what's shown (venture + search), so "Aghori → Select all" picks just those.
  const toggleAll = () => setPicked((s) => {
    const n = new Set(s);
    selectable.forEach((c) => (allShownPicked ? n.delete(c._id) : n.add(c._id)));
    return n;
  });

  // Writing to the phone's Contacts is a real change on the device, so ask once before doing it.
  const confirmSave = () => {
    const n = picked.size;
    Alert.alert(
      `Save ${n} contact${n === 1 ? "" : "s"} to this phone?`,
      "Each gets the name, client ID, phone and email. Contacts already on the phone only get missing details filled in.",
      [{ text: "Cancel", style: "cancel" }, { text: "Save", onPress: save }],
    );
  };

  const save = async () => {
    setSaving(true);
    let res = false;
    try {
      res = await saveClientsToContacts((clients || []).filter((c) => picked.has(c._id)));
    } catch (e) {
      // saveClientsToContacts shows its own messages; this only catches the unexpected.
      showToast({ title: "Couldn't save the contacts", message: e?.message || "Please try again.", tone: "error" });
    } finally {
      setSaving(false); // the spinner always stops: saved, denied or failed
    }
    // Close only when something was added; otherwise stay so the message can be read and the picks changed.
    if (res?.saved || res?.updated) backTo("/clients");
  };

  const count = picked.size;
  return (
    <Screen edges={Platform.OS === "android" ? ["top", "bottom"] : ["bottom"]} className="gap-4 pt-6">
      <SheetHeader title="Save to contacts" sub="Name, phone, email and client ID go into this phone's Contacts" closeLabel="Cancel" />
      {!clients ? <DashboardState isLoading={!error} isError={error} refetch={load} /> : (
        <>
          {/* Plain wrapper: a horizontal ScrollView grows to fill spare height in this non-scrolling screen. */}
          <View>
            <VentureChips value={brand} onChange={setBrand} counts={counts} />
          </View>
          <Input value={q} onChangeText={setQ} placeholder="Search name, company or phone" autoCorrect={false} accessibilityLabel="Search clients" right={<View className="h-11 w-11 items-center justify-center"><Search size={18} color={theme.muted} /></View>} />
          <View className="flex-row items-center">
            <Text className="flex-1 text-caption uppercase text-muted">{count} selected · {selectable.length} with a number</Text>
            <Pressable onPress={toggleAll} disabled={!selectable.length} accessibilityLabel={allShownPicked ? "Clear selection" : "Select all"} className="min-h-[36px] justify-center px-1">
              <Text className="font-body-semibold text-sm text-accent-ink">{allShownPicked ? "Clear" : "Select all"}</Text>
            </Pressable>
          </View>
          <View className="flex-1">
            <FlashList
              data={shown}
              keyExtractor={(c) => c._id}
              extraData={picked}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => <ClientPickRow client={item} selected={picked.has(item._id)} onToggle={() => toggle(item._id)} />}
              ListEmptyComponent={<Text className="py-8 text-center text-sm text-muted">{term ? "No clients match." : "No clients yet."}</Text>}
            />
          </View>
          <Button
            title={count ? `Save ${count} contact${count === 1 ? "" : "s"}` : "Select clients to save"}
            icon={Download}
            loading={saving}
            disabled={!count}
            onPress={confirmSave}
            className="mb-2"
          />
        </>
      )}
    </Screen>
  );
}
