import { Link } from 'expo-router';

// iOS 18+: the tapped element zooms open into the screen at `href` (and shrinks back on the way back);
// Android just pushes. The child gets the Link's onPress, so it must not set its own. No href = plain child.
export function ZoomLink({ href, children }) {
  if (!href) return children;
  return (
    <Link href={href} asChild>
      <Link.AppleZoom>{children}</Link.AppleZoom>
    </Link>
  );
}
