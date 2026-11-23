import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { showToast } from '@/components/Toast';
import { clientApi } from './clientApi';
import { planContacts } from '@/utils/clientContacts';

// iPhone only lets an app write contact notes with Apple's special permission (set ios.accessesContactNotes in
// app.json once Apple grants it); without it a contact with a note fails to save. Android always can.
const canWriteNotes = () => Platform.OS === 'android' || Constants.expoConfig?.ios?.accessesContactNotes === true;

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

// Saves the given clients into this phone's Contacts: name (title case), client ID under it, phone, email and the
// note "Added from Rudhram HQ". A number already on the phone isn't added twice; that contact only gets the missing
// email and client ID filled in. Returns { saved, updated } when it ran, or false when it couldn't start or failed.
export async function saveClientsToContacts(clients) {
  const Contacts = loadContacts();
  if (!Contacts) {
    showToast({ title: 'Update the app to use this', message: 'Saving to Contacts needs the latest version of the app.', tone: 'info' });
    return false;
  }

  // Everything below, the permission prompt included, sits in one try: any failure ends in a readable message.
  try {
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

    // No "Saving…" toast: the Save button spins, and a second toast replacing it right away read as a flicker.
    const F = Contacts.ContactField;
    const existing = await Contacts.Contact.getAllDetails([F.PHONES, F.EMAILS, F.COMPANY]);
    const { add, update, skipped, noNumber } = planContacts(clients, existing, { withNote: canWriteNotes() });

    let saved = 0;
    let updated = 0;
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
    for (const { id, patch } of update) {
      try {
        await new Contacts.Contact(id).patch(patch);
        updated += 1;
      } catch {
        failed += 1;
      }
    }

    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    if (!saved && !updated && !failed) {
      // Nothing new: say plainly that they're already on the phone, and keep the picker open.
      showToast({
        title: skipped ? 'Already in your contacts' : 'Nothing to save',
        message: skipped
          ? `${skipped === clients.length ? (skipped === 1 ? 'This client is' : `All ${skipped} selected clients are`) : plural(skipped, 'client is', 'clients are')} already saved on this phone.`
          : 'The selected clients have no phone number.',
        tone: 'info',
        duration: 6000,
      });
      return { saved, updated };
    }
    const parts = [
      saved && updated && `${plural(updated, 'existing contact', 'existing contacts')} updated`,
      skipped && `${skipped} already in your phone`,
      noNumber && `${noNumber} without a number`,
      failed && `${failed} couldn't be saved`,
    ].filter(Boolean);
    const title = saved ? `Saved ${plural(saved, 'contact', 'contacts')}`
      : updated ? `Updated ${plural(updated, 'contact', 'contacts')} with email and client ID`
        : "Couldn't save the contacts";
    showToast({ title, message: parts.join(' · ') || undefined, tone: saved || updated ? 'success' : 'error', duration: 6000 });
    return { saved, updated };
  } catch (e) {
    showToast({ title: "Couldn't save the contacts", message: e?.data?.message || e?.message || 'Please try again.', tone: 'error' });
    return false;
  }
}
