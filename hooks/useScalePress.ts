import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Butona basıldığında scale animasyonu.
 * TouchableOpacity'nin onPressIn/onPressOut ile kullanılır.
 */
export function useScalePress(scaleTo: number = 0.96) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(scaleTo, { damping: 15, stiffness: 200 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 150 });
  };

  return { animatedStyle, onPressIn, onPressOut };
}
