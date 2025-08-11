import React, {useEffect} from 'react';
import {View, StyleSheet, Image, Dimensions} from 'react-native';
import {Text, ActivityIndicator} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';

import {colors, spacing, fonts} from '@/theme';

const {width, height} = Dimensions.get('window');

const SplashScreen: React.FC = () => {
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const loadingOpacity = useSharedValue(0);

  useEffect(() => {
    // Animate logo
    logoScale.value = withSpring(1, {damping: 8});
    logoOpacity.value = withSpring(1);

    // Animate text after logo
    textOpacity.value = withDelay(500, withSpring(1));

    // Show loading indicator
    loadingOpacity.value = withDelay(1000, withSpring(1));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{scale: logoScale.value}],
      opacity: logoOpacity.value,
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
    };
  });

  const loadingAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: loadingOpacity.value,
    };
  });

  return (
    <LinearGradient
      colors={[colors.primary, colors.brandSecondary]}
      style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>🏠</Text>
          </View>
        </Animated.View>

        {/* App Name */}
        <Animated.View style={[styles.titleContainer, textAnimatedStyle]}>
          <Text style={styles.title}>HospedeFácil</Text>
          <Text style={styles.subtitle}>A hospedagem mais fácil do Brasil</Text>
        </Animated.View>

        {/* Loading */}
        <Animated.View style={[styles.loadingContainer, loadingAnimatedStyle]}>
          <ActivityIndicator size=\"small\" color={colors.textLight} />
          <Text style={styles.loadingText}>Preparando tudo para você...</Text>
        </Animated.View>
      </View>

      {/* Version */}
      <View style={styles.footer}>
        <Text style={styles.version}>v1.0.0</Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 60,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: 'bold',
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textLight,
    textAlign: 'center',
    opacity: 0.9,
  },
  loadingContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 100,
  },
  loadingText: {
    fontSize: fonts.sizes.sm,
    color: colors.textLight,
    marginTop: spacing.sm,
    opacity: 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.lg,
    alignItems: 'center',
  },
  version: {
    fontSize: fonts.sizes.xs,
    color: colors.textLight,
    opacity: 0.7,
  },
});

export default SplashScreen;