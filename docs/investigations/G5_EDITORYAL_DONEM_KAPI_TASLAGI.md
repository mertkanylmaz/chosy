# G-5 kapısı editoryal dönemde nasıl tanımlanır — DUR NOKTASI taslağı

**Statü:** TASLAK — karara bağlanmadı. Bible'a **dokunulmadı**.
**Kaynak:** C.9b-UI Faz 0 ölçümü (19 Eylül 2026), bulgu **F-A**.
**Niteliği:** Bu bir **bible değişikliğidir** (`7_CHOSY_V1_KAPSAM_KILIDI`),
sürüm artışı ve karar günlüğü ister. Design OS v4.1'in yetkisi dışındadır.

---

## 1. Sorun

`7_CHOSY_V1_KAPSAM_KILIDI.md:639` — release gate tablosu:

| G-5 | Neither rate | **%15–30 bandında** |

Bu kapı, kullanıcının aday kalitesine tepkisini ölçmek için konmuştu. **İlk
100 gün bunu ölçmüyor.**

## 2. Ölçüm

E-19 editoryal takvimi canlıda (bible v1.11–v1.13):

- `app_config.launch_date = 2026-09-18` (migration 113 ile koda bağlandı)
- Ölçüm anında `day_number = 2`, tema `epic`
- `day_number` 1–100 arası `generate-gauntlet` **DAL A**'da çalışıyor
- `submit-choice` guard'ı editoryal günde **algoritmik yedek çekmeyi kapatıyor**

Sonuç: "İkisi de değil"e basıldığında `refreshAllowed = false` ve
`refreshBlockedReason: 'editorial_day'` dönüyor. İstemci tarafında
`editorialRefreshBlocked` set ediliyor ve buton **ilk retten sonra kapanıyor**
(`components/gauntlet/GauntletShell/index.tsx`, `applyRefreshResult`).

**Yani ≈27 Aralık 2026'ya kadar:** her kullanıcı gün başına en fazla **bir**
`choice_rejected` üretebiliyor ve ikinci ret fiziksel olarak mümkün değil.
Ölçülen oran ürün davranışının değil, editoryal kilidin fonksiyonu.

## 3. Yayılım

| Etkilenen | Nasıl |
|---|---|
| **G-5 release gate** | Bant doğrudan yorumlanamaz |
| **K-28 candidate quality teşhisi (R-02)** | Aynı `choice_rejected` event'ine dayanıyor, aynı gölgede |
| **Marketing kapısı** | G-5 altı release gate'ten biri (K-52). Yanlış "geçti/geçmedi" kararı üretebilir |
| **C.9b-UI G6 maddesi** | Bu turda kriter daraltıldı (aşağıda), kalıcı çözüm değil |

## 4. Bu turda alınan geçici önlem (kalıcı karar DEĞİL)

C.9b-UI Faz 1'de G6'nın kabul kriteri şuna daraltıldı:

> `choice_rejected` K-39 alanlarıyla ateşleniyor **+** buton görünürlüğü
> düşmemiş.

Oran bandı bu turda **yorumlanmıyor**. Bu yalnızca C.9b-UI'ı ilerletmek
içindir; G-5'in kendisini tanımlamaz.

## 5. Karara bağlanacak seçenekler

| # | Seçenek | Artı | Eksi |
|---|---|---|---|
| **A** | **Kapıyı gün>100 kohortuna bağla** — yalnız algoritmik fazdaki kullanıcıların neither oranı sayılır | G-5'in özgün anlamı korunur | Launch'tan ≈3,5 ay sonra ölçülebilir; marketing kapısı o kadar bekleyemeyebilir |
| **B** | **Kapıyı editoryal dönem için değiştir** — G-5 yerine Watched-it (G-4) ve `choice_rejected` **zenginliği** (hangi bağlamda, hangi tür, hangi tur) | Launch penceresinde ölçülebilir | Farklı bir şeyi ölçer; "aday kalitesi" sinyali zayıflar |
| **C** | **G-5'i editoryal dönemde askıya al**, kapı sayısını 6'dan 5'e indir (K-52) | Dürüst; ölçülemeyeni ölçüyormuş gibi yapmaz | Aday kalitesi launch'ta hiç denetlenmez |
| **D** | **Editoryal günlerde de yedek çekilsin** (E-19 guard'ı gevşetilsin) | G-5 olduğu gibi çalışır | E-19'un kürasyon vaadini bozar; CTO kararına aykırı |

**Not:** A ve B birleşebilir — editoryal dönemde B, gün 101'den sonra A.

## 6. Karar için gereken

1. `7_CHOSY_V1_KAPSAM_KILIDI.md:639` G-5 satırının yeni metni
2. K-52 kapı sayısı değişiyor mu
3. K-28 / R-02 teşhis matrisinin editoryal dönem notu
4. Sürüm artışı + karar günlüğü satırı (bible skill'i ile)

## 7. Kapsam dışı

Bu taslak **karar üretmez**, seçenekleri ve ölçümü sunar. C.9b-UI Faz 1
bu karara **bağlı değildir** ve beklemez.
