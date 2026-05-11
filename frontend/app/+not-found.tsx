import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { C } from '../lib/design';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.void }}>
        <Text style={{ color: C.t1, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>This screen doesn't exist.</Text>
        <Link href="/">
          <Text style={{ color: C.primary, fontSize: 14, fontWeight: '600' }}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
