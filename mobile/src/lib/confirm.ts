import { Alert, Platform } from 'react-native';

/** Cross-platform "are you sure?" (Alert.alert buttons don't work on web). `action` labels the confirm button. */
export function confirm(title: string, message: string, action = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
