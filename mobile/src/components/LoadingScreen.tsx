import React from 'react';
import {View, StyleSheet} from 'react-native';
import {ActivityIndicator, Text} from 'react-native-paper';
import {colors, spacing, fonts} from '@/theme';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Carregando...'
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator 
        size=\"large\" 
        color={colors.primary} 
        style={styles.spinner}
      />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  spinner: {
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default LoadingScreen;