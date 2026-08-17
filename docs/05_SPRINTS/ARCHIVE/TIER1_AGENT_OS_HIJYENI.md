# TIER1 — Agent OS Hijyeni

**Başlangıç:** 17 Ağustos 2026
**Bağlı bible maddesi:** Durum devri (`docs/os/8_CHOSY_DURUM_DEVRI.md`) §4 — HAT 2 Tier 1 kapsamı

## Amaç
Doküman hijyeni: bible tek konum, CLAUDE.md küçültme, skill dosyalarındaki
bayat durum bilgisinin dinamik referansa çevrilmesi, ölü mini-games
brief'lerinin arşivlenmesi, `.claude/agent-memory/` klasörünün dondurulması,
commit formatı kuralının sabitlenmesi.

## Kapsam
- Bible'ın tek konumda yaşaması kararı (`docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md`)
- CLAUDE.md küçültme — sabit durum/sayı bilgisinin kaldırılıp
  `health-check/SKILL.md`'ye taşınması
- Skill dosyalarındaki hardcoded numaraların (migration "068", Sprint 1
  "032, 033, 034") dinamik/canlı kontrole çevrilmesi
- Mini-games brief'lerinin (`CDO_MINI_GAMES_SPECS.md`,
  `CMO_MINI_GAMES_COPY.md`, `CTO_MINI_GAMES_IMPL.md`, `game-system-brief.md`)
  `.claude/_archive/briefs/` altına arşivlenmesi
- `.claude/agent-memory/` (CDO/CEO/CMO/COO/CTO) read-only envanteri ve
  dondurulması
- `agents/*.md` audit (durum devrinde iş kalemi olarak anılıyor, bu sohbette
  ayrı bir commit ile iz bırakmamış)
- Commit formatı kuralının CLAUDE.md'ye eklenmesi (bu görevin İş 6'sı)

## Kapsam DIŞI
- Yeni agent, subagent, MCP bağlantısı
- Otonom döngü, `.agent/` klasörü, AGENTS.md, `agent:prepare` scripti
- Üçüncü bir karar günlüğü (mevcut ikisi: `6_CHOSY_IA_REVIZE_KARAR_GUNLUGU.md`
  ve bible §10)

## DUR NOKTALARI
| # | Soru | Cevap | Tarih |
|---|---|---|---|
| 1 | Bible kanonik dosya hangisi olacak? | `docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md` tek konum | 17 Ağu 2026 |
| 2 | `.claude/agent-memory/` Tier 2/3 mü, Tier 1 kapsamında mı ele alınacak? | Tier 2/3 sınıfına giriyor — B seçeneği (read-only envanter + dondurma, otomatik migrate yok) | 17 Ağu 2026 |
| 3 | Freeze-marker notları commit edilecek mi? | Hayır — Seçenek A: klasör zaten `.gitignore`'da, freeze-marker yerel kalır | 17 Ağu 2026 |
| 4 | agent-memory commit stratejisi | Seçenek A: yerel dondurma, repoya sadece `.gitignore` durumu ve health-check notu yansır (commit 62dd124) | 17 Ağu 2026 |

## Doğrulama
| Komut | Beklenen | Sonuç |
|---|---|---|
| `git log --oneline -5` | Tier 1 commit'leri sırayla görünmeli | 0fa4282, 91399c0, c7e07de, 354134f, 62dd124 doğrulandı |
| `git status` | `.claude/agent-memory/` repo diff'inde görünmemeli (`.gitignore`'da) | Doğrulandı |

## Commit Referansları
- 0fa4282 — CLAUDE.md durum sayılarını health-check'e taşı
- 91399c0 — chosy-conventions'deki sabit migration numarasını kaldır
- c7e07de — migration-guard'daki Sprint 1 sabit numaralarını kaldır
- 354134f — mini-games brief'lerini arşivle
- 62dd124 — agent-memory gitignore durum belgesi health-check'e ekle

## Durum
Tamamlandı — 17 Ağu 2026.
