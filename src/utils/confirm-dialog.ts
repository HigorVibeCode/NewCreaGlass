import { Platform, Alert } from 'react-native';

/**
 * Shows a confirmation dialog that works on both web and mobile
 * On web, uses window.confirm
 * On mobile, uses Alert.alert
 */
export const confirmDialog = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText?: string,
  cancelText?: string
): void => {
  if (Platform.OS === 'web') {
    // Use browser's native confirm dialog on web
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    } else if (onCancel) {
      onCancel();
    }
  } else {
    // Use React Native Alert on mobile
    Alert.alert(
      title,
      message,
      [
        {
          text: cancelText || 'Cancelar',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: confirmText || 'Confirmar',
          style: 'destructive',
          onPress: onConfirm,
        },
      ],
      { cancelable: true }
    );
  }
};

/**
 * Shows a delete confirmation dialog
 */
export const confirmDelete = (
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  onCancel?: () => void,
  deleteText?: string,
  cancelText?: string,
  successMessage?: string,
  errorMessage?: string
): void => {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      Promise.resolve(onConfirm())
        .then(() => {
          if (successMessage) {
            setTimeout(() => {
              alert(successMessage);
            }, 100);
          }
        })
        .catch((error) => {
          console.error('Error in delete confirmation:', error);
          alert(errorMessage || 'Erro ao excluir. Por favor, tente novamente.');
        });
    } else if (onCancel) {
      onCancel();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        {
          text: cancelText || 'Cancelar',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: deleteText || 'Excluir',
          style: 'destructive',
          onPress: () => {
            Promise.resolve(onConfirm())
              .then(() => {
                if (successMessage) {
                  setTimeout(() => {
                    Alert.alert(title, successMessage, [
                      { text: 'OK' },
                    ]);
                  }, 100);
                }
              })
              .catch((error) => {
                console.error('Error in delete confirmation:', error);
                Alert.alert('Erro', errorMessage || 'Erro ao excluir. Por favor, tente novamente.');
              });
          },
        },
      ],
      { cancelable: true }
    );
  }
};
