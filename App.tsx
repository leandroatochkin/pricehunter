import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return <HomeScreen />;
  // return (
  //   <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
  //     <Text>HELLO WORLD</Text>
  //   </View>
  // );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
