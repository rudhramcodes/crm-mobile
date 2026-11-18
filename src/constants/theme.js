import { useColorScheme } from 'react-native';
import { colors } from './colors';

export { colors, brand } from './colors';

// Same hex the className tokens use, for props that need a raw colour (icons, spinners, placeholders).
export const useTheme = () => colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
