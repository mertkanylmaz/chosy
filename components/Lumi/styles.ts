import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  /** Ana container — boyut dışarıdan gelir */
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Mood animasyonlarını taşıyan wrapper */
  moodWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Altın glow katmanı — position absolute, orb'un arkasında */
  glow: {
    position: 'absolute',
  },
  /** Nefes alan dış çerçeve */
  outerRing: {
    position: 'absolute',
  },
  /** Merkezdeki altın orb */
  core: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Orb içindeki açık altın parlak nokta */
  innerLight: {
    // borderRadius ve boyut dışarıdan gelir
  },
  /** Yörüngede dönen tek parçacık */
  particle: {
    position: 'absolute',
  },
});
