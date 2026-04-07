/**
 * ShareCards — Paylasim kart template'leri ve capture hook'u.
 *
 * Kullanim:
 *   const { cardRef, share, isCapturing } = useShareCapture();
 *   <FilmShareCard ref={cardRef} film={...} moodText={...} />
 *   <Button onPress={share} loading={isCapturing} />
 */
export { default as FilmShareCard } from './FilmShareCard';
export type { FilmShareCardProps } from './FilmShareCard';

export { default as MoodShareCard } from './MoodShareCard';
export type { MoodShareCardProps } from './MoodShareCard';

export { useShareCapture } from './useShareCapture';
export type { UseShareCaptureReturn } from './useShareCapture';
