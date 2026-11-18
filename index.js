// NativeWind bug (react-native-css-interop 0.2.x): in web dev the CSS loads after the JS, and when it
// arrives NativeWind calls colorScheme.set('system'), which throws in 'media' dark mode. Declaring the
// flag up front skips that path. No effect on iOS/Android. shortcut: drop this once NativeWind fixes it.
if (typeof document !== 'undefined') document.documentElement.style.setProperty('--css-interop-darkMode', 'media');

require('expo-router/entry');
