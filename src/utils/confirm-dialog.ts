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
          text: cancelText || 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: confirmText || 'Confirm',
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
          alert(errorMessage || 'Could not delete. Please try again.');
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
          text: cancelText || 'Cancel',
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: deleteText || 'Delete',
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
                Alert.alert('Error', errorMessage || 'Could not delete. Please try again.');
              });
          },
        },
      ],
      { cancelable: true }
    );
  }
};
