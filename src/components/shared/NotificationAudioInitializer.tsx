import React, { useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { setNotificationPlayer, clearNotificationPlayer } from '../../utils/audio-player-singleton';

// Carregar o source uma vez no módulo (fora do componente)
// Usar o alias @/ que é o padrão no projeto (como em app/(tabs)/index.tsx)
let audioSource: any;
try {
  audioSource = require('@/assets/sounds/notification.wav');
  console.log('✅ NotificationAudioInitializer - Audio source loaded:', audioSource);
} catch (error) {
  console.error('❌ NotificationAudioInitializer - Failed to load audio source with @/assets/sounds/notification.wav');
  console.error('❌ NotificationAudioInitializer - Error:', error);
  
  // Fallback: tentar caminho relativo
  try {
    audioSource = require('../../../assets/sounds/notification.wav');
    console.log('✅ NotificationAudioInitializer - Audio source loaded with relative path');
  } catch (error2) {
    console.error('❌ NotificationAudioInitializer - Relative path also failed:', error2);
    audioSource = null;
  }
}

/**
 * Componente interno que inicializa o player (só renderiza se tiver source válido)
 * IMPORTANTE: useAudioPlayer não aceita null/undefined no Android (causa crash)
 */
const AudioPlayerInitializer: React.FC<{ source: any }> = ({ source }) => {
  console.log('🎵 AudioPlayerInitializer - Component mounted with source:', !!source);
  
  // Hook sempre chamado com source válido (garantido pelo wrapper)
  const player = useAudioPlayer(source);

  console.log('🎵 AudioPlayerInitializer - Player created:', {
    hasPlayer: !!player,
    playerType: typeof player,
  });

  useEffect(() => {
    player.volume = 1;
    player.loop = false;

    // Configurar modo de áudio para permitir tocar em modo silencioso
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'duckOthers',
        });
        console.log('✅ AudioPlayerInitializer - Audio mode configured');
      } catch (error) {
        console.warn('⚠️ AudioPlayerInitializer - Failed to configure audio mode:', error);
      }
    };
    
    configureAudio();
  }, [player]);

  useEffect(() => {
    console.log('🎵 AudioPlayerInitializer - useEffect triggered, player:', !!player);
    
    // Armazenar o player no singleton quando o componente montar
    if (player) {
      try {
        console.log('✅ NotificationAudioInitializer - Setting player:', {
          hasPlayer: !!player,
          playerType: typeof player,
          playerKeys: Object.keys(player || {}),
        });
        setNotificationPlayer(player);
        console.log('✅ NotificationAudioInitializer - Player set successfully in singleton');
      } catch (error) {
        console.error('❌ Failed to set notification player:', error);
      }
    } else {
      console.warn('⚠️ NotificationAudioInitializer - Player is null/undefined');
    }

    // Limpar quando o componente desmontar
    return () => {
      console.log('🎵 AudioPlayerInitializer - Component unmounting, clearing player');
      clearNotificationPlayer();
    };
  }, [player]);

  return null;
};

/**
 * Componente wrapper que inicializa o player de áudio para notificações
 * Deve ser renderizado uma vez no root do app
 * Só renderiza o inicializador se tiver source válido (evita crash no Android)
 */
export const NotificationAudioInitializer: React.FC = () => {
  console.log('🎵 NotificationAudioInitializer - Wrapper component rendered, audioSource:', !!audioSource);
  
  // Só renderizar o inicializador se temos source válido
  // Isso evita chamar useAudioPlayer com null/undefined (que causa crash no Android)
  if (!audioSource) {
    console.warn('⚠️ NotificationAudioInitializer - No audio source, returning null');
    return null;
  }

  console.log('✅ NotificationAudioInitializer - Rendering AudioPlayerInitializer');
  return <AudioPlayerInitializer source={audioSource} />;
};
