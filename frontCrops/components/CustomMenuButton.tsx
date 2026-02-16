// components/CustomMenuButton.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function CustomMenuButton({ navigation }:any) {
  const scale = new Animated.Value(1);

  const handlePress = () => {
    Haptics.selectionAsync(); // Optional haptic feedback

    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    navigation.toggleDrawer(); // Toggle the drawer
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale }] }]}>
        {[0, 1, 2, 3].map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === 3 ? styles.activeDot : null]}
          />
        ))}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    padding: 4,
    marginLeft: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
    margin: 2,
  },
  activeDot: {
    backgroundColor: 'green', // Blue active dot
  },
});
