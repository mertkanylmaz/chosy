/**
 * Anthropic model id'leri — tek kaynak (yalniz rerank-films okur; diger fonksiyonlar
 * TEKNIK_BORC.md'deki "model id'lerini topla" maddesiyle sonra tasinacak).
 *
 * HAIKU_5_5 varsayilan olarak DUSUNUR ve max_tokens'i dusunmeye harcayip bos metin doner;
 * bu yuzden her cagrida `thinking: { type: 'disabled' }` zorunludur (bkz. REASON_THINKING).
 */
export const HAIKU_4_5 = 'claude-haiku-4-5'
export const HAIKU_5_5 = 'claude-haiku-5-5'

/** rerank-films dortlu secimi (reason:false): degismedi. */
export const RERANK_PICK_MODEL = HAIKU_4_5
/** rerank-films gerekce yolu (reason:true, EN + TR): Haiku 5.5, thinking kapali. */
export const RERANK_REASON_MODEL = HAIKU_5_5
/** Gerekce yolunda her cagriya gider. */
export const REASON_THINKING = { type: 'disabled' } as const
