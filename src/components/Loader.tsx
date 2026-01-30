import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';

const HeartbeatSpinner = () => {
  // 1. Value for the constant 360 rotation
  const spinValue = useRef(new Animated.Value(0)).current;
  // 2. Value for the scale (heartbeat)
  const pulseValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Constant Rotation: 0 to 1 over 3 seconds
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Heartbeat Pulse: Scales up and down
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Map spinValue to 360 degrees
  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Map pulseValue to scale (1 to 1.1)
  const scale = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('./lita.png')}
        style={[
          styles.image,
          {
            transform: [{ rotate }, { scale }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF0000',
  },
  image: {
    width: 200,
    height: 200,
  },
});

export default HeartbeatSpinner;