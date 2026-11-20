import { router } from 'expo-router';
import { Hammer } from 'lucide-react-native';
import { Screen } from './Screen';
import { Heading } from './Text';
import { EmptyState } from './EmptyState';

// shortcut: stands in for modules not built yet (tabs, More rows, notification links); each goes as its module lands.
export function ComingSoon({ title = 'Coming soon', tabs }) {
  return (
    <Screen tab={tabs} className="pt-6">
      <Heading>{title}</Heading>
      <EmptyState
        icon={Hammer}
        title="Arriving in a later update"
        message="This part of Rudhram CRM isn't in the app yet. You can still use it on the web."
        actionTitle={tabs ? undefined : 'Go back'}
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </Screen>
  );
}
