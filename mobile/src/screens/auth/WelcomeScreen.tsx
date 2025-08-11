import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  StatusBar,
} from 'react-native';
import {Text, Button} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';

import {AuthStackParamList} from '@/types';
import {colors, spacing, fonts, borderRadius} from '@/theme';

type WelcomeScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Welcome'>;

const {width, height} = Dimensions.get('window');

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();

  const logoScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const featuresOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  React.useEffect(() => {
    logoScale.value = withSpring(1, {damping: 10});
    titleOpacity.value = withDelay(300, withSpring(1));
    featuresOpacity.value = withDelay(600, withSpring(1));
    buttonsOpacity.value = withDelay(900, withSpring(1));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: logoScale.value}],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const featuresAnimatedStyle = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  const features = [
    {
      icon: '🔍',
      title: 'Busca Inteligente',
      description: 'Encontre a hospedagem perfeita com nossa IA em português',
    },
    {
      icon: '⚡',
      title: 'Reserva em 3 Cliques',
      description: 'O processo de reserva mais rápido do Brasil',
    },
    {
      icon: '💳',
      title: 'PIX Instantâneo',
      description: 'Pagamento e recebimento em tempo real',
    },
    {
      icon: '📱',
      title: 'WhatsApp Nativo',
      description: 'Comunicação direta pelo WhatsApp',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle=\"light-content\" backgroundColor={colors.primary} />
      
      <LinearGradient
        colors={[colors.primary, colors.brandSecondary]}
        style={styles.header}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>🏠</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.titleContainer, titleAnimatedStyle]}>
          <Text style={styles.title}>HospedeFácil</Text>
          <Text style={styles.subtitle}>
            A hospedagem mais fácil do Brasil
          </Text>
        </Animated.View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.featuresContainer, featuresAnimatedStyle]}>
          <Text style={styles.sectionTitle}>Por que escolher o HospedeFácil?</Text>
          
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>10%</Text>
              <Text style={styles.statLabel}>Comissão</Text>
              <Text style={styles.statNote}>vs 15-20% outros</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>2 dias</Text>
              <Text style={styles.statLabel}>Recebimento</Text>
              <Text style={styles.statNote}>vs 3-7 dias outros</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View style={[styles.buttonContainer, buttonsAnimatedStyle]}>
        <Button
          mode=\"contained\"
          onPress={() => navigation.navigate('Register')}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}>
          Criar Conta Grátis
        </Button>
        
        <Button
          mode=\"outlined\"
          onPress={() => navigation.navigate('Login')}
          style={styles.secondaryButton}
          contentStyle={styles.buttonContent}
          labelStyle={[styles.buttonLabel, {color: colors.primary}]}>
          Já tenho uma conta
        </Button>

        <Text style={styles.termsText}>
          Ao continuar, você concorda com nossos{' '}
          <Text style={styles.linkText}>Termos de Uso</Text> e{' '}
          <Text style={styles.linkText}>Política de Privacidade</Text>
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.textLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 40,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textLight,
    opacity: 0.9,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  featuresContainer: {
    paddingVertical: spacing.xl,
  },
  sectionTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  featureIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  statNumber: {
    fontSize: fonts.sizes.xl,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statNote: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    paddingBottom: 40,
  },
  primaryButton: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
  },
  secondaryButton: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    borderColor: colors.primary,
  },
  buttonContent: {
    height: 50,
  },
  buttonLabel: {
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
  termsText: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '500',
  },
});

export default WelcomeScreen;