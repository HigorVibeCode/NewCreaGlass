import { Training } from '../types';

/**
 * Locale do app (pt, en, es, de, fr, it).
 */
export type AppLocale = string;

/**
 * Retorna o título do treinamento no locale atual.
 * Se existir tradução em titleI18n[locale], usa; senão usa title (fallback).
 */
export function getLocalizedTrainingTitle(training: Training, locale: AppLocale): string {
  const translated = training.titleI18n?.[locale];
  if (translated != null && translated.trim() !== '') return translated;
  return training.title;
}

/**
 * Retorna a descrição do treinamento no locale atual.
 * Se existir tradução em descriptionI18n[locale], usa; senão usa description (fallback).
 */
export function getLocalizedTrainingDescription(training: Training, locale: AppLocale): string | undefined {
  const translated = training.descriptionI18n?.[locale];
  if (translated != null && translated.trim() !== '') return translated;
  return training.description;
}
