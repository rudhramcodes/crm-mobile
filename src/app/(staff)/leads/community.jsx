import { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { Copy } from 'lucide-react-native';
import { Button, Card, Pressable, Screen, SheetHeader, Text, Toggle, backTo, leadStatus, showToast } from '@/components';
import { BRAND_COMMUNITY_NAMES, VENTURE_CODES } from '@/constants';
import { useUpdateLeadMutation } from '@/services/leadApi';
import { useTheme } from '@/constants/theme';
import { runAction } from '@/utils/attendance';
import { telLink, waLink } from '@/utils/leads';

// SOP before a new lead moves on (or is called): create its WhatsApp community group, named by venture + client ID.
// Params: id, name, brand, clientId, phone, and either status (stage to set) or then (call | whatsapp).
export default function CommunityGroup() {
  const theme = useTheme();
  const p = useLocalSearchParams();
  const [update, { isLoading }] = useUpdateLeadMutation();
  const [done, setDone] = useState(false);
  const brand = p.brand || 'panigrahna';
  const clientId = p.clientId || `RE-${VENTURE_CODES[brand] || 'PG'}-${new Date().getFullYear()}-001`;

  const copy = async () => {
    await Clipboard.setStringAsync(clientId);
    showToast({ title: 'Client ID copied' });
  };
  const confirm = async () => {
    if (p.then) {
      backTo(`/leads/${p.id}`);
      return Linking.openURL(p.then === 'call' ? telLink(p.phone) : waLink(p.phone)).catch(() => showToast({ title: "Couldn't open it" }));
    }
    const s = leadStatus(p.status);
    if (await runAction(update({ id: p.id, status: p.status }), p.status === 'won' ? 'Converted to client' : `Moved to ${s.label}`, "Couldn't change the stage")) backTo(`/leads/${p.id}`);
  };

  return (
    <Screen scroll edges={['bottom']} className="gap-4 pt-6">
      <SheetHeader title="Community group" sub={p.name} closeLabel="Cancel" />
      <Text className="text-sm text-muted">Before you {p.then ? 'contact this lead' : `move it to ${leadStatus(p.status).label}`}, create its WhatsApp group in this community and name it with the client ID.</Text>
      <Card className="gap-3 p-4">
        <View className="gap-0.5">
          <Text className="text-caption text-muted">COMMUNITY</Text>
          <Text className="font-body-semibold">{BRAND_COMMUNITY_NAMES[brand] || BRAND_COMMUNITY_NAMES.panigrahna}</Text>
        </View>
        <Pressable onPress={copy} accessibilityLabel={`Client ID ${clientId}. Copy`} className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text className="text-caption text-muted">CLIENT ID</Text>
            <Text className="font-body-semibold tabular-nums">{clientId}</Text>
          </View>
          <Copy size={18} color={theme['accent-ink']} />
        </Pressable>
      </Card>
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 font-body-medium">I have created the group</Text>
        <Toggle value={done} onValueChange={setDone} label="I have created the group" />
      </View>
      <Button title={p.then === 'call' ? 'Call now' : p.then === 'whatsapp' ? 'Open WhatsApp' : 'Confirm'} loading={isLoading} disabled={!done} onPress={confirm} />
    </Screen>
  );
}
