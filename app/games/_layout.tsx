/**
 * Games stack navigator.
 * Hub + individual game screens.
 */
import { Stack } from 'expo-router';

import { Colors } from '@/constants/Colors';

export default function GamesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
