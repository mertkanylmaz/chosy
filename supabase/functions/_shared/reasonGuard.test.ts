import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { findLeak, guardReasons, looksTurkish, stripTitles } from './reasonGuard.ts'

Deno.test('findLeak: eval\'de gözlenen bozuk biçimler yakalanır', () => {
  assertEquals(findLeak('Bu film şaşırtmazlık hissi verir.'), 'şaşırtmazlık')
  assertEquals(findLeak('Kıcık bir komedi.'), 'kıcık')
})

Deno.test('findLeak: Türkçe ek almış İngilizce sözcükler yakalanır', () => {
  assertEquals(findLeak('Sürpriz twistelleri ile dolu.'), 'twist')
  assertEquals(findLeak("Gerçek bir thriller'ı arıyorsan bu."), 'thriller')
  assertEquals(findLeak('Rahat bir vibe veriyor.'), 'vibe')
  assertEquals(findLeak('Feel-good bir akşam için.'), 'feel-good')
  assertEquals(findLeak('Feel good bir film.'), 'feel-good')
  assertEquals(findLeak('Plot çok sağlam.'), 'plot')
})

Deno.test('findLeak: temiz Türkçe geçer (few-shot örnekleri dahil)', () => {
  assertEquals(findLeak('Amélie, küçük iyiliklerle dolu sıcak bir dünyada yağmurlu günün hüznünü hafifletir.'), null)
  assertEquals(findLeak('Memento, olayları tersten anlatarak seni sonuna kadar düşündürür ve finalde şaşırtır.'), null)
  assertEquals(findLeak('Superbad, arkadaşlarla birlikte izleyince kahkahayı garantileyen, hızlı ve rahat bir komedi.'), null)
  assertEquals(findLeak('Son sürprizi izleyiciyi gerçekten şaşırtıyor.'), null)
})

Deno.test('findLeak: sözcük ortasındaki eşleşme sızıntı sayılmaz', () => {
  assertEquals(findLeak('Komplo ve bilim kurgu temalarıyla sürükler.'), null)
  assertEquals(findLeak('Ayrıntılı bir portre çiziyor.'), null)
})

Deno.test('looksTurkish: harf ve sözcük ipuçları', () => {
  assertEquals(looksTurkish('Yağmurlu bir pazar'), true)
  assertEquals(looksTurkish('bir soygun filmi istiyorum'), true)
  assertEquals(looksTurkish('need a laugh tonight'), false)
})

Deno.test('guardReasons: TR mood metninde sızıntılı gerekçe boşalır, anahtar kalır', () => {
  const r = guardReasons(
    { a: 'Sürpriz twistelleri ile dolu.', b: 'Rahat ve sıcak bir komedi.' },
    'Bugün güzel bir şey izlemek istiyorum',
  )
  assertEquals(r.reasons, { a: '', b: 'Rahat ve sıcak bir komedi.' })
  assertEquals(r.dropped, ['a'])
})

Deno.test('guardReasons: İngilizce mood + İngilizce gerekçeye dokunulmaz', () => {
  const r = guardReasons({ a: 'A twisty thriller with a great plot.' }, 'need something tense')
  assertEquals(r.reasons, { a: 'A twisty thriller with a great plot.' })
  assertEquals(r.dropped, [])
})

Deno.test('guardReasons: mood İngilizce ama gerekçe Türkçe görünüyorsa denetlenir', () => {
  const r = guardReasons({ a: 'Gerçek bir thriller deneyimi, çok gergin.' }, 'something tense')
  assertEquals(r.reasons, { a: '' })
  assertEquals(r.dropped, ['a'])
})

Deno.test('guardReasons: film başlığı sızıntı sayılmaz (Twister), gerçek sızıntı hâlâ düşer', () => {
  const titles = { a: ['Twister'], b: ['Twister'], c: ['Mood Indigo', "L'Écume des jours"] }
  const r = guardReasons(
    {
      a: 'Twister, kasırga avcılarının peşinden giden hızlı ve eğlenceli bir macera.',
      b: 'Twister, sonunda plot twist ile şaşırtıyor.',
      c: 'mood indigo, hüzünlü ve rüya gibi bir aşk hikâyesi.',
    },
    'Bugün hızlı bir macera istiyorum',
    titles,
  )
  assertEquals(r.reasons.a !== '', true)
  assertEquals(r.reasons.b, '')
  assertEquals(r.reasons.c !== '', true)
  assertEquals(r.dropped, ['b'])
})

Deno.test('guardReasons: başlık verilmezse eski davranış (Twister düşer)', () => {
  const r = guardReasons({ a: 'Twister hızlı bir macera.' }, 'Bugün hızlı bir macera istiyorum')
  assertEquals(r.reasons.a, '')
})

Deno.test('stripTitles: büyük/küçük harf duyarsız, kısa/boş başlık yok sayılır', () => {
  assertEquals(stripTitles('TWISTER güzel', ['twister']).trim(), 'güzel')
  assertEquals(stripTitles('a b', ['', 'x']), 'a b')
})
