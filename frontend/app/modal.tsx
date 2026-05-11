import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text } from 'react-native';
import { C } from '../lib/design';

export default function ModalScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface }}>
      <Text style={{ color: C.t1, fontSize: 18, fontWeight: '700' }}>Modal</Text>
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}
