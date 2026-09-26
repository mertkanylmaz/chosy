/**
 * TabBarInsetTelemetry stilleri — görsel çıktı yok. İç provider'ın native
 * view'ı ekranın TAMAMINI kaplamalı ki UIKit ona tab bar payını katsın.
 */
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
