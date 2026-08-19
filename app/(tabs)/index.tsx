/**
 * Home sekmesi — günlük gauntlet ritüeli. C.9b (19.08.2026).
 *
 * K-03: "Home = tek route, explicit state enum." Durum makinesinin tamamı
 * `GauntletShell` içinde yaşar; bu dosya yalnızca MOUNT NOKTASIDIR. Burada
 * durum, koşul ya da yönlendirme mantığı OLMAZ — eklenirse K-03'ün "tek
 * route" kilidi iki yere bölünür.
 *
 * ⚠️ `onDismiss` BİLİNÇLİ OLARAK VERİLMEZ (CTO kararı 19.08.2026).
 * Prop opsiyoneldir ve GauntletShell/ChampionReveal içindeki üç çağrı yeri de
 * `onDismiss &&` ile korumalıdır; verilmediğinde "Kapat" / "Boşver, yarın"
 * sessiz eylemleri hiç render edilmez (kırık buton oluşmaz). Gerekçe: Home
 * bir tab, "geri" kavramı yok; bible §7.1 champion'ı "Home içinde · kalıcı"
 * olarak tanımlar. Eski `dev-gauntlet.tsx` `router.back()` veriyordu çünkü
 * O ekran stack'e push edilen bir test route'uydu — o bağlam artık yok.
 *
 * Mood search buradan ÇIKARILDI, silinmedi →
 * `components/Home/MoodSearchScreen/`. C.9c onu Profile altına bağlayacak.
 */
import React from 'react';

import { GauntletShell } from '@/components/gauntlet/GauntletShell';

export default function HomeScreen(): React.JSX.Element {
  return <GauntletShell />;
}
