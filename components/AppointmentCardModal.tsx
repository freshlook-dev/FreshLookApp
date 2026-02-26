'use client';

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { LightColors, DarkColors } from '../constants/colors';
import { Radius, Spacing } from '../constants/theme';

export type AppointmentReceiptData = {
  client_name: string;
  service: string;
  appointment_date: string;
  appointment_time: string;
  location: string;
  phone: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  data: AppointmentReceiptData | null;
};

export default function AppointmentCardModal({ visible, onClose, data }: Props) {
  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  if (!data) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: Colors.card, borderColor: Colors.primary }]}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: Colors.background }]}
            hitSlop={12}
          >
            <Text style={[styles.closeText, { color: Colors.text }]}>✕</Text>
          </Pressable>

          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/images/LOGO_HORIZONTAL.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: Colors.primary }]} />

          <View style={styles.section}>
            <Text style={[styles.label, { color: Colors.muted }]}>Klienti</Text>
            <Text style={[styles.value, { color: Colors.text }]} numberOfLines={2}>
              {data.client_name}
            </Text>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: Colors.muted }]}>Shërbimi</Text>
              <Text style={[styles.value, { color: Colors.text }]} numberOfLines={2}>
                {data.service}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: Colors.muted }]}>Data</Text>
              <Text style={[styles.value, { color: Colors.text }]}>{data.appointment_date}</Text>
            </View>

            <View style={styles.col}>
              <Text style={[styles.label, { color: Colors.muted }]}>Ora</Text>
              <Text style={[styles.value, { color: Colors.text }]}>{data.appointment_time}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: Colors.muted }]}>Lokacioni</Text>
              <Text style={[styles.value, { color: Colors.text }]}>{data.location}</Text>
            </View>

            <View style={styles.col}>
              <Text style={[styles.label, { color: Colors.muted }]}>Telefoni</Text>
              <Text style={[styles.value, { color: Colors.text }]}>{data.phone}</Text>
            </View>
          </View>

          <View style={[styles.footer, { borderTopColor: 'rgba(201,162,77,0.35)' }]}>
            <Text style={[styles.footerBrand, { color: Colors.primary }]}>Fresh Look Aesthetics</Text>
            <Text style={[styles.footerNote, { color: Colors.muted }]}>
              Ju mirëpresim në termin tuaj.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.doneButton, { backgroundColor: Colors.primary }]}
          >
            <Text style={styles.doneText}>Mbyll</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  closeText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 10,
  },
  logo: {
    width: 140,
    height: 56,
  },
  divider: {
    height: 2,
    width: '100%',
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    marginTop: 4,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  footerBrand: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  footerNote: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  doneButton: {
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});