#!/bin/bash
# Sabah kontrol scripti - gece çalışmasının özetini gösterir
# Kullanım: cd moodflix && bash morning-check.sh

LOGDIR=$(ls -dt logs/overnight-* 2>/dev/null | head -1)

if [ -z "$LOGDIR" ]; then
  echo "❌ Gece çalışması bulunamadı. overnight.sh çalıştırıldı mı?"
  exit 1
fi

echo ""
echo "☀️  Günaydın! Gece çalışması sonuçları:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cat "$LOGDIR/00-summary.txt"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Detaylı loglar:"
for f in "$LOGDIR"/*.log; do
  FNAME=$(basename "$f" .log)
  SIZE=$(wc -l < "$f")
  if grep -qi "error\|failed\|hata" "$f"; then
    echo "  ❌ $FNAME ($SIZE satır) — HATA İÇERİYOR"
  else
    echo "  ✅ $FNAME ($SIZE satır)"
  fi
done

echo ""
echo "📂 Log okumak için: cat $LOGDIR/<dosya>.log"
echo ""
echo "🔜 Sıradaki adımlar (manuel):"
echo "   1. Hatalı oturumların loglarını oku"
echo "   2. SQL gerektiren oturumlar için Supabase'e git"
echo "   3. Görsel gerektiren oturumlar için Claude Code'da çalıştır"
echo "      → 2.2 (mood overlayler)  → görseller: 08, 09"
echo "      → 2.3 (feed kartları)    → görsel: 07"
echo "      → 2.4 (watchlist+detay)  → görseller: 04, 06"
echo "      → 2.5 (profile+splash)   → görseller: 05, 01"
