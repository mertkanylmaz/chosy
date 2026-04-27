import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

/** Animasyon alanı boyutu — px */
export const SIZE = 280;

export const styles = StyleSheet.create({
  /** Dış container — sabit boyut, ortalanmış */
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Arka plan radyal glow katmanı — statik */
  glowLayer: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },

  /** Her dönen halka için mutlak konum çerçevesi */
  ringLayer: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },

  /** Merkez projektör noktası — altın glow */
  centerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    backgroundColor: Colors.gold,
    opacity: 0.9,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
});
