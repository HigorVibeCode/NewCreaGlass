import { Platform, Vibration, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { getNotificationPlayer } from './audio-player-singleton';

/**
 * Reproduz um som de notificação
 */
const playNotificationSound = async () => {
  console.log('🔊 playNotificationSound - Called');
  
  try {
    // Tentar usar o player se estiver disponível
    const player = getNotificationPlayer();
    console.log('🔊 playNotificationSound - Player available:', !!player);
    
    if (player) {
      try {
        // Verificar se o player tem os métodos necessários
        const playerMethods = {
          hasSeekTo: typeof player.seekTo === 'function',
          hasPlay: typeof player.play === 'function',
          hasReplay: typeof player.replay === 'function',
          hasCurrentTime: 'currentTime' in player,
          playerKeys: Object.keys(player || {}),
        };
        console.log('🔊 playNotificationSound - Player methods:', playerMethods);
        
        // Tentar diferentes métodos da API do expo-audio
        // IMPORTANTE: Sempre resetar para o início antes de tocar
        let played = false;
        
        if (typeof player.replay === 'function') {
          // API mais recente do expo-audio - replay() reinicia e toca
          console.log('🔊 playNotificationSound - Attempting replay()');
          player.replay();
          played = true;
          console.log('✅ playNotificationSound - replay() called successfully');
        } else if (typeof player.seekTo === 'function' && typeof player.play === 'function') {
          // API com seekTo - sempre resetar para o início
          console.log('🔊 playNotificationSound - Attempting seekTo(0) + play()');
          await player.seekTo(0);
          await player.play();
          played = true;
          console.log('✅ playNotificationSound - seekTo(0) + play() called successfully');
        } else if ('currentTime' in player && typeof player.play === 'function') {
          // Se tem currentTime como propriedade, definir para 0 e tocar
          console.log('🔊 playNotificationSound - Attempting currentTime = 0 + play()');
          (player as any).currentTime = 0;
          await player.play();
          played = true;
          console.log('✅ playNotificationSound - currentTime = 0 + play() called successfully');
        } else if (typeof player.play === 'function') {
          // Apenas play - tentar resetar primeiro se possível
          console.log('🔊 playNotificationSound - Attempting play()');
          // Tentar resetar se possível
          if ('currentTime' in player) {
            (player as any).currentTime = 0;
          }
          await player.play();
          played = true;
          console.log('✅ playNotificationSound - play() called successfully');
        }
        
        if (!played) {
          console.error('❌ playNotificationSound - Player does not have expected methods');
          console.error('❌ playNotificationSound - Available methods:', Object.keys(player));
          throw new Error('Player methods not available');
        }
        
        // Adicionar vibração junto com o som customizado
        if (Platform.OS === 'ios') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (Platform.OS === 'android') {
          Vibration.vibrate(400);
        }
        console.log('✅ playNotificationSound - Sound and vibration triggered');
        return;
      } catch (playerError) {
        console.error('❌ playNotificationSound - Failed to play with audio player:', playerError);
        console.error('❌ playNotificationSound - Error details:', JSON.stringify(playerError, null, 2));
      }
    } else {
      console.warn('⚠️ playNotificationSound - Player not available, using vibration only');
    }

    // Fallback: Usar feedback tátil através de Haptics (iOS) ou vibração (Android)
    // O sistema operacional já reproduz um som padrão junto com a vibração
    if (Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (Platform.OS === 'android') {
      // No Android, a vibração geralmente vem com som do sistema
      Vibration.vibrate(400);
    }
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
    // Fallback para vibração básica
    try {
      if (Platform.OS === 'android') {
        Vibration.vibrate(400);
      }
    } catch (vibError) {
      // Ignorar erros de vibração
    }
  }
};

/**
 * Limpa os recursos de áudio quando não forem mais necessários
 */
export const cleanupNotificationSound = async () => {
  const player = getNotificationPlayer();
  if (player) {
    try {
      player.remove();
    } catch (error) {
      console.warn('Failed to cleanup notification sound:', error);
    }
  }
};

/**
 * Triggers vibration and sound alert when a notification is created
 * Reproduz som customizado ou usa som do sistema como fallback
 * Optionally shows an alert dialog with the notification message
 */
export const triggerNotificationAlert = async (
  notificationType?: string,
  message?: string
) => {
  try {
    // Reproduzir som e vibração
    await playNotificationSound();
    
    // Show alert message if provided (for important notifications)
    if (message) {
      // Use setTimeout to avoid blocking the current operation
      setTimeout(() => {
        Alert.alert(
          'Nova Notificação',
          message,
          [{ text: 'OK' }],
          { cancelable: true }
        );
      }, 500);
    }
  } catch (error) {
    // Silently fail if vibration/haptics are not available
    console.warn('Failed to trigger notification alert:', error);
  }
};
