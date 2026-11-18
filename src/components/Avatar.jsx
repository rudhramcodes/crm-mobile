import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { getInitials } from '@/utils/formatters';
import { cn } from '@/utils/cn';

export function Avatar({ name, uri, size = 40, className }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image source={{ uri }} style={box} accessibilityLabel={name} contentFit="cover" transition={150} />;
  return (
    <View style={box} accessibilityLabel={name} className={cn('items-center justify-center bg-sand', className)}>
      <Text style={{ fontSize: size * 0.38 }} className="font-body-semibold text-brown">{getInitials(name)}</Text>
    </View>
  );
}
