/**
 * Singleton para gerenciar o player de áudio de notificações
 * Permite que utilitários acessem o player criado por um componente React
 */

import type { useAudioPlayer } from 'expo-audio';

// Tipo do player retornado por useAudioPlayer
type AudioPlayer = ReturnType<typeof useAudioPlayer>;

let notificationPlayer: AudioPlayer | null = null;

/**
 * Define o player de notificação (chamado pelo componente de inicialização)
 */
export const setNotificationPlayer = (player: AudioPlayer | null) => {
  notificationPlayer = player;
};

/**
 * Obtém o player de notificação (usado pelos utilitários)
 */
export const getNotificationPlayer = (): AudioPlayer | null => {
  return notificationPlayer;
};

/**
 * Limpa o player
 */
export const clearNotificationPlayer = () => {
  notificationPlayer = null;
};
