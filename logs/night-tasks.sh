#!/bin/bash
# Chosy.ai Gece Mesaisi
# Çalıştır: chmod +x night-tasks.sh && ./night-tasks.sh

echo "🌙 Chosy.ai Gece Mesaisi Başlıyor..."
echo "Zaman: $(date)"
echo "=================================="

# ─── GÖREV 1: Performans İyileştirme ───
echo ""
echo "📦 Görev 1/6: Performans iyileştirme..."
claude --task "
Performans iyileştirmesi yap. Backend mantığına DOKUNMA.

1. expo-image yükle: npx expo install expo-image

2. Tüm dosyalarda react-native Image import'unu expo-image ile değiştir:
   ESKİ: import { Image } from 'react-native'
   YENİ: import { Image } from 'expo-image'
   
   Image kullanımını güncelle:
   ESKİ: resizeMode='cover'
   YENİ: contentFit='cover'
   
   Ek prop ekle: cachePolicy='memory-disk' transition={200}
   
   Bu dosyalarda değiştir:
   - components/SwipeCard/ (tüm dosyalar)
   - app/(tabs)/watchlist.tsx
   - app/film/[id].tsx (varsa)

3. Feed FlatList'e performans prop'ları ekle (app/(tabs)/index.tsx):
   removeClippedSubviews={true}
   maxToRenderPerBatch={3}
   windowSize={5}
   initialNumToRender={2}
   
4. SwipeableCard component'ini React.memo ile sar.

5. renderItem ve keyExtractor'ı useCallback ile sar.

6. Watchlist FlatList'e de ekle:
   removeClippedSubviews={true}
   maxToRenderPerBatch={6}
   initialNumToRender={6}
" --allowedTools bash,write,edit 2>&1 | tee logs/task1-performance.log

echo "✅ Görev 1 tamamlandı"
sleep 5

# ─── GÖREV 2: Splash Ekranı ───
echo ""
echo "📦 Görev 2/6: Splash ekranı..."
claude --task "
app/splash.tsx oluştur — sinematik açılış ekranı.
Bu dosya zaten varsa üstüne yaz.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  withDelay, withSequence, withSpring, FadeInDown,
  Easing, runOnJS,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Lumi } from '../components/Lumi';

const { width: SW, height: SH } = Dimensions.get('window');

export default function SplashScreen() {
  const lumiScale = useSharedValue(0.3);
  const lumiOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Lumi fade in + scale
    lumiOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
    lumiScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    
    // Glow
    glowScale.value = withDelay(300, withTiming(2, { duration: 1500 }));
    glowOpacity.value = withDelay(300, 
      withSequence(
        withTiming(0.5, { duration: 800 }),
        withTiming(0.1, { duration: 700 })
      )
    );

    // 3 saniye sonra navigate
    const timer = setTimeout(() => {
      router.replace('/(tabs)/mood');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const lumiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lumiScale.value }],
    opacity: lumiOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glow, glowStyle]} />
      
      <Animated.View style={lumiStyle}>
        <Lumi size={160} state='idle' />
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(1000).duration(600)}
        style={styles.logo}>
        Chosy.ai
      </Animated.Text>

      <Animated.Text entering={FadeInDown.delay(1200).duration(600)}
        style={styles.tagline}>
        Movies that understand your mood
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(212,168,67,0.08)',
  },
  logo: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 42,
    color: '#D4A843',
    marginTop: 24,
  },
  tagline: {
    fontSize: 14,
    color: '#8A8290',
    marginTop: 8,
  },
});

Sonra app/_layout.tsx veya app/index.tsx'i kontrol et.
Uygulama açıldığında splash.tsx'in gösterilmesini sağla.
Expo Router'da initialRouteName veya app/index.tsx'i 
splash'a yönlendir.
" --allowedTools bash,write,edit 2>&1 | tee logs/task2-splash.log

echo "✅ Görev 2 tamamlandı"
sleep 5

# ─── GÖREV 3: Mood Input Lumi-Odaklı ───
echo ""
echo "📦 Görev 3/6: Mood Input Lumi-first redesign..."
claude --task "
app/(tabs)/mood.tsx dosyasının UI layout'unu yeniden düzenle.
Mevcut state mantığını (filtreler, moodText, handleFindMovies, 
MoodContext) KESINLIKLE KORU. Sadece JSX layout ve stilleri değiştir.

Yeni layout üstten aşağı:

1. SafeAreaView bg #0A0E27

2. Lumi Hero Bölümü (üst %35):
   - Arka plan glow: View 200x200, borderRadius 100, 
     bg rgba(212,168,67,0.06), position absolute
   - Lumi: size={80}, state dinamik:
     moodText.length === 0 ? 'idle' : 'thinking'
   - Konuşma balonu (Lumi altında):
     bg rgba(26,31,53,0.8), borderRadius 16, padding 20x12,
     border 1px rgba(212,168,67,0.15)
     İçinde PlayfairDisplay_700Bold text, 18px, beyaz, centered
     Text dinamik:
       moodText.length === 0: 'What kind of movie experience\nare you looking for?'
       moodText.length < 10: 'Tell me more...'
       moodText.length < 30: 'Interesting... I have some ideas'
       moodText.length >= 30: 'I know exactly what you need'

3. Filtre bölümü (kompakt):
   'Era' label: fontSize 11, color #8A8290, uppercase, letterSpacing 1
   Year chip'leri: horizontal ScrollView, mevcut chip mantığı
   12px gap
   'Quality' label: aynı stil
   IMDb chip'leri: horizontal ScrollView, mevcut chip mantığı

4. TextInput:
   bg rgba(26,31,53,0.6), borderRadius 16, height 100
   borderWidth 1, borderColor dinamik:
     moodText.length > 0 ? rgba(212,168,67,0.5) : rgba(212,168,67,0.15)
   placeholder 'A rainy evening mood, something contemplative...'

5. Find Movies butonu:
   bg dinamik: moodText.length >= 3 ? #D4A843 : rgba(212,168,67,0.3)
   disabled: moodText.length < 3
   Text: 'Find Movies', bold

Mevcut handleFindMovies, filter state, chip onPress mantığını KORU.
Sadece görsel düzeni değiştir.
import { Lumi } from '../../components/Lumi' ekle.
" --allowedTools bash,write,edit 2>&1 | tee logs/task3-mood.log

echo "✅ Görev 3 tamamlandı"
sleep 5

# ─── GÖREV 4: AI Processing İhtişamlı ───
echo ""
echo "📦 Görev 4/6: AI Processing Lumi ihtişamlı..."
claude --task "
components/AIProcessing/index.tsx dosyasını yeniden yaz.
Mevcut visible prop ve onComplete callback mantığını KORU.

3 aşamalı processing:

Phase state: 'appearing' | 'analyzing' | 'found'
Status text değişiyor:
  0.5sn: 'Reading your emotions...'
  1.0sn: 'Understanding your taste...'
  1.5sn: 'Finding perfect matches...'
  2.0sn: phase='found', text='Got it! Let me show you...' (altın renk)
  2.5sn: onComplete() çağır

Layout:
- Modal transparent, bg rgba(10,14,39,0.97)
- Arka plan glow: 300x300 daire, bg rgba(212,168,67,0.08)
- Lumi size={140} state={phase==='found' ? 'happy' : 'thinking'}
- Status text: beyaz (found ise altın #D4A843)
- 3 nokta loading (found aşamasında gizle):
  3 View, 8x8, borderRadius 4, bg #D4A843
  Sıralı opacity pulse: 0.3 → 1.0 → 0.3

useEffect ile timer'ları kur (visible değişince temizle).
import { Lumi } from '../Lumi';
" --allowedTools bash,write,edit 2>&1 | tee logs/task4-aiprocessing.log

echo "✅ Görev 4 tamamlandı"
sleep 5

# ─── GÖREV 5: Feed Lumi AI Açıklama ───
echo ""
echo "📦 Görev 5/6: Feed kartlarında Lumi AI açıklama..."
claude --task "
Feed kartlarındaki AI açıklama bölümünü iyileştir.
Swipe mekanizmasına DOKUNMA. Sadece kart içindeki render'ı güncelle.

1. SwipeableCard veya kart render fonksiyonunda,
   film adının ÜSTÜNE Lumi AI açıklama balonu ekle:

<View style={{
  flexDirection: 'row',
  alignItems: 'flex-start',
  backgroundColor: 'rgba(26,31,53,0.6)',
  borderRadius: 12,
  padding: 10,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: 'rgba(212,168,67,0.1)',
}}>
  <Lumi size={24} state='explaining' />
  <View style={{ marginLeft: 8, flex: 1 }}>
    <Text style={{ fontSize: 11, color: '#D4A843', fontWeight: '600', marginBottom: 2 }}>
      Lumi's pick
    </Text>
    <Text style={{ fontSize: 13, color: '#B0A8B9', lineHeight: 18 }} numberOfLines={2}>
      {getAIExplanation(film)}
    </Text>
  </View>
</View>

2. getAIExplanation fonksiyonunu dosyaya ekle:

function getAIExplanation(film: any): string {
  const genres = (film.genres || []).slice(0, 2).join(' and ').toLowerCase();
  if (!genres) return 'A unique film picked just for your current mood';
  const templates = [
    'A ' + genres + ' film that perfectly matches your mood',
    'Rich ' + genres + ' storytelling for your current state',
    'This ' + genres + ' gem delivers exactly what you need',
    'Your mood pairs beautifully with this ' + genres + ' film',
  ];
  const charCode = film.id ? film.id.charCodeAt(0) : 0;
  return templates[charCode % templates.length];
}

3. Sağa swipe sonrası toast ekle (index.tsx veya SwipeCard parent):
   showSaveToast state (boolean), sağa swipe callback'inde true yap,
   800ms sonra false yap.
   
   Toast UI:
   position absolute, top 80, alignSelf center,
   flexDirection row, bg rgba(26,31,53,0.9), borderRadius 20,
   padding 16x8, border 1px rgba(212,168,67,0.3),
   içinde: <Lumi size={24} state='happy' /> + 'Saved to watchlist!' text

   Animated opacity: FadeIn 200ms → visible 400ms → FadeOut 200ms

import { Lumi } from '../../components/Lumi' veya doğru path.
" --allowedTools bash,write,edit 2>&1 | tee logs/task5-feed-lumi.log

echo "✅ Görev 5 tamamlandı"
sleep 5

# ─── GÖREV 6: Lumi Her Yerde ───
echo ""
echo "📦 Görev 6/6: Lumi entegrasyonu kalan ekranlar..."
claude --task "
Lumi'yi kalan ekranlara entegre et. Backend DOKUNMA.

1. app/(tabs)/watchlist.tsx:
   - Header'da başlığın soluna <Lumi size={24} state='explaining' /> ekle
   - Boş durum: <Lumi size={80} state='idle' /> + 
     'Your collection awaits' (PlayfairDisplay_700Bold, 20px) +
     'Swipe right on films you love and Lumi will keep them here' (14px, #8A8290) +
     'Start exploring' outline butonu (border #D4A843)

2. app/(tabs)/profile.tsx:
   - Avatar View'ın içine <Lumi size={56} state='idle' /> koy
     (mevcut Ionicons person ikonunu Lumi ile değiştir)
   - Alt text: 'Curated by Lumi' (12px, #8A8290)

3. components/MoodProfileResult/index.tsx:
   - Üstte <Lumi size={48} state='happy' /> ekle
   - Alt text: 'Here is what Lumi understood' rengi #D4A843 yap
   - Browse Movies buton text: 'Let Lumi find your movies'

4. app/(tabs)/index.tsx — Feed boş durumu:
   Eğer film yoksa (mood girilmemiş):
   <Lumi size={80} state='idle' /> +
   'Ready to explore?' (PlayfairDisplay_700Bold, 22px) +
   'Tell Lumi how you are feeling and discover your perfect film' (14px, #8A8290) +
   'Describe your mood' altın buton → router.push('/(tabs)/mood')

5. app/(tabs)/_layout.tsx — Mood tab ikonu:
   Mood tab'ın tabBarIcon'unu özelleştir:
   Eğer focused ise <Lumi size={22} state='idle' />
   Değilse normal Ionicons sparkles ikonu

import { Lumi } from doğru path.
" --allowedTools bash,write,edit 2>&1 | tee logs/task6-lumi-everywhere.log

echo "✅ Görev 6 tamamlandı"

echo ""
echo "=================================="
echo "🌅 Tüm görevler tamamlandı!"
echo "Zaman: $(date)"
echo "=================================="
echo ""
echo "SABAH YAPILACAKLAR:"
echo "1. npx expo start → uygulamayı aç"
echo "2. Splash ekranını kontrol et"
echo "3. Mood Input'ta Lumi'yi kontrol et"
echo "4. AI Processing'de Lumi animasyonunu kontrol et"
echo "5. Feed kartlarında Lumi AI açıklamasını kontrol et"
echo "6. Watchlist ve Profile'da Lumi'yi kontrol et"
echo "7. Hata varsa logları kontrol et: logs/ klasörü"