import { Linking } from 'react-native';
import { showToast } from '@/components/Toast';
import { clientApi } from './clientApi';
import { planContacts } from '@/utils/clientContacts';

// expo-contacts is native: a build made before it was added doesn't have it, so load it only when asked.
const loadContacts = () => {
  try {
    return require('expo-contacts');
  } catch {
    return null;
  }
};

// Every client (all statuses), 500 per request: the server's maximum page size.
export async function fetchAllClients(dispatch) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const req = dispatch(clientApi.endpoints.getClients.initiate({ page, limit: 500 }, { forceRefetch: true }));
    const res = await req.unwrap().finally(() => req.unsubscribe());
    all.push(...(res.data || []));
    if (page >= (res.pagination?.pages || 1)) return all;
  }
}

// Saves the given clients' names + phones into this phone's Contacts, skipping numbers already there.
// Returns { saved } when it ran (saved may be 0), or false when it couldn't start or failed.
export async function saveClientsToContacts(clients) {
  const Contacts = loadContacts();
  if (!Contacts) {
    showToast({ title: 'Update the app to use this', message: 'Saving to Contacts needs the latest version of the app.', tone: 'info' });
    return false;
  }

  const { granted } = await Contacts.requestPermissionsAsync();
  if (!granted) {
    showToast({
      title: 'Contacts access is off',
      message: 'Allow it in Settings to save client contacts.',
      tone: 'error',
      action: { label: 'Settings', onPress: () => Linking.openSettings() },
      duration: 6000,
    });
    return false;
  }

  try {
    // No "Saving…" toast: the Save button spins, and a second toast replacing it right away read as a flicker.
    const existing = await Contacts.Contact.getAllDetails([Contacts.ContactField.PHONES]);
    const numbers = existing.flatMap((c) => (c.phones || []).map((p) => p.number));
    const { add, skipped, noNumber } = planContacts(clients, numbers);

    let saved = 0;
    let failed = 0;
    // One at a time: Contacts has no batch add.
    for (const rec of add) {
      try {
        await Contacts.Contact.create(rec);
        saved += 1;
      } catch {
        failed += 1;
      }
    }

    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    if (!saved && !failed) {
      // Nothing new: say plainly that they're already on the phone, and keep the picker open.
      showToast({
        title: skipped ? 'Already in your contacts' : 'Nothing to save',
        message: skipped
          ? `${skipped === clients.length ? (skipped === 1 ? 'This client is' : `All ${skipped} selected clients are`) : plural(skipped, 'client is', 'clients are')} already saved on this phone.`
          : 'The selected clients have no phone number.',
        tone: 'info',
        duration: 6000,
      });
      return { saved };
    }
    const parts = [
      skipped && `${skipped} already in your phone`,
      noNumber && `${noNumber} without a number`,
      failed && `${failed} couldn't be saved`,
    ].filter(Boolean);
    showToast({
      title: saved ? `Saved ${plural(saved, 'contact', 'contacts')}` : "Couldn't save the contacts",
      message: parts.join(' · ') || undefined,
      tone: saved ? 'success' : 'error',
      duration: 6000,
    });
    return { saved };
  } catch (e) {
    showToast({ title: "Couldn't save the contacts", message: e?.data?.message || e?.message, tone: 'error' });
    return false;
  }
}
