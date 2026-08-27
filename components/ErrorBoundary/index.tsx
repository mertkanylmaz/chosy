/**
 * SentryErrorBoundary — uygulamanin root seviyesinde kullanilir.
 *
 * Yakalanmamis JS hatalarini:
 *   1. Sentry'e otomatik raporlar
 *   2. Kullaniciya fallback UI gosterir (crash yerine)
 *   3. "Tekrar Dene" butonu ile recovery saglar
 *
 * Expo Router kendi ErrorBoundary'sini export eder ama
 * bu component Sentry entegrasyonu + ozel fallback UI icin gerekli.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';

import { Colors } from '@/constants/Colors';
// Class component — useLanguage() hook'u kullanilamaz, i18n dogrudan okunur
// (ShareCards/useShareCapture.ts ile ayni desen).
import { i18n } from '@/constants/i18n';
import { Theme } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Class component — React error boundary API sadece class component destekler.
 * Sentry.captureException ile her unhandled error otomatik raporlanir.
 */
export default class SentryErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Sentry'e raporla — component stack ile birlikte
    Sentry.withScope((scope) => {
      scope.setTag('boundary', 'root');
      scope.setExtra('componentStack', errorInfo.componentStack);
      Sentry.captureException(error);
    });
  }

  /** Uygulamayi sifirla — state temizle, children yeniden render */
  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Ionicons name="warning-outline" size={48} color={Colors.gold} />
            <Text style={styles.title}>{i18n.t('errorState.boundaryTitle')}</Text>
            <Text style={styles.message}>{i18n.t('errorState.boundaryMessage')}</Text>
            {__DEV__ && this.state.error && (
              <Text style={styles.errorDetail} numberOfLines={4}>
                {this.state.error.message}
              </Text>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
              activeOpacity={0.8}>
              <Ionicons name="refresh" size={18} color={Colors.background} />
              <Text style={styles.buttonText}>{i18n.t('errorState.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.lg,
  },
  card: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
    width: '100%',
    ...Theme.shadow.card,
  },
  title: {
    color: Colors.textWhite,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  message: {
    color: Colors.textGrey,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorDetail: {
    color: Colors.error,
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'monospace',
    backgroundColor: Colors.white05,
    borderRadius: 8,
    padding: 8,
    width: '100%',
    overflow: 'hidden',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
