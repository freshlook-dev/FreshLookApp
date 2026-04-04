'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { AuthChangeEvent } from '@supabase/supabase-js';

import { supabase } from '../context/supabase';

/* ✅ THEME */
import { useTheme } from '../context/ThemeContext';
import { LightColors, DarkColors } from '../constants/colors';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const { theme } = useTheme();
  const Colors = theme === 'dark' ? DarkColors : LightColors;

  const strengthAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent) => {
        if (event === 'PASSWORD_RECOVERY') setReady(true);
      }
    );

    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: unknown | null } }) => {
        if (data.session) setReady(true);
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  const passwordChecks = useMemo(() => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    const score = [
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
    ].filter(Boolean).length;

    let label = 'E dobët';
    if (score >= 4) label = 'Shumë e fortë';
    else if (score >= 3) label = 'E mirë';

    return {
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      score,
      label,
    };
  }, [password]);

  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: Math.min(passwordChecks.score, 3),
      duration: 300,
      useNativeDriver: false,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: password ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [passwordChecks, password, strengthAnim, fadeAnim]);

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const passwordsDoNotMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  const strengthColor =
    passwordChecks.label === 'Shumë e fortë'
      ? '#22C55E'
      : passwordChecks.label === 'E mirë'
      ? '#F59E0B'
      : '#EF4444';

  const canSubmit =
    ready &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    passwordChecks.score >= 3;

  const handleUpdate = async () => {
    if (!canSubmit) return;

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      if (
        error.message?.toLowerCase().includes('same') ||
        error.message?.toLowerCase().includes('old')
      ) {
        Alert.alert(
          'Gabim',
          'Fjalëkalimi i ri nuk mund të jetë i njëjtë me fjalëkalimin e vjetër.'
        );
        return;
      }

      Alert.alert(
        'Gabim',
        error.message || 'Ndryshimi i fjalëkalimit dështoi.'
      );
      return;
    }

    setSuccessVisible(true);
  };

  const goToLogin = async () => {
    setSuccessVisible(false);
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  const renderCheckRow = (label: string, passed: boolean) => (
    <View style={styles.checkRow} key={label}>
      <Ionicons
        name={passed ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={passed ? '#22C55E' : Colors.muted}
      />
      <Text
        style={[
          styles.checkText,
          { color: passed ? Colors.text : Colors.muted },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const bar1Color =
    passwordChecks.score >= 1 ? '#EF4444' : Colors.background;
  const bar2Color =
    passwordChecks.score >= 3 ? '#F59E0B' : Colors.background;
  const bar3Color =
    passwordChecks.score >= 4 ? '#22C55E' : Colors.background;

  const animatedWidth = strengthAnim.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['0%', '33%', '66%', '100%'],
  });

  return (
    <>
      <View
        style={[
          styles.container,
          { backgroundColor: Colors.background },
        ]}
      >
        <Text style={[styles.title, { color: Colors.text }]}>
          Vendos fjalëkalim të ri
        </Text>

        <Text style={[styles.subtitle, { color: Colors.muted }]}>
          Krijo një fjalëkalim të sigurt për llogarinë tënde
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: Colors.card,
              borderColor: Colors.primary,
            },
          ]}
        >
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  color: Colors.text,
                  borderColor: Colors.primary,
                },
              ]}
              placeholder="Fjalëkalimi i ri"
              placeholderTextColor={Colors.muted}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={styles.eye}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={22}
                color={Colors.muted}
              />
            </Pressable>
          </View>

          {!!password && (
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      scale: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.98, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.strengthHeader}>
                <Text style={[styles.sectionTitle, { color: Colors.text }]}>
                  Forca e fjalëkalimit
                </Text>
                <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                  {passwordChecks.label}
                </Text>
              </View>

              <View
                style={[
                  styles.strengthTrack,
                  { backgroundColor: Colors.background, borderColor: Colors.primary },
                ]}
              >
                <Animated.View
                  style={[
                    styles.strengthFill,
                    {
                      width: animatedWidth,
                      backgroundColor: strengthColor,
                    },
                  ]}
                />
              </View>

              <View style={styles.strengthBarRow}>
                <View
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor: bar1Color,
                      borderColor:
                        passwordChecks.score >= 1 ? bar1Color : Colors.primary,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor: bar2Color,
                      borderColor:
                        passwordChecks.score >= 3 ? bar2Color : Colors.primary,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor: bar3Color,
                      borderColor:
                        passwordChecks.score >= 4 ? bar3Color : Colors.primary,
                    },
                  ]}
                />
              </View>

              <View style={styles.checkList}>
                {renderCheckRow('Të paktën 8 karaktere', passwordChecks.hasMinLength)}
                {renderCheckRow('Një shkronjë të madhe', passwordChecks.hasUppercase)}
                {renderCheckRow('Një shkronjë të vogël', passwordChecks.hasLowercase)}
                {renderCheckRow('Një numër', passwordChecks.hasNumber)}
                {renderCheckRow('Një simbol special', passwordChecks.hasSpecialChar)}
              </View>
            </Animated.View>
          )}

          <View style={[styles.passwordWrapper, { marginTop: 8 }]}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: Colors.background,
                  color: Colors.text,
                  borderColor: passwordsMatch
                    ? '#22C55E'
                    : passwordsDoNotMatch
                    ? '#EF4444'
                    : Colors.primary,
                },
              ]}
              placeholder="Konfirmo fjalëkalimin"
              placeholderTextColor={Colors.muted}
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={styles.eye}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={22}
                color={Colors.muted}
              />
            </Pressable>
          </View>

          {(passwordsMatch || passwordsDoNotMatch) && (
            <Animated.View
              style={[
                styles.matchRow,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [6, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={passwordsMatch ? '#22C55E' : '#EF4444'}
              />
              <Text
                style={[
                  styles.matchText,
                  { color: passwordsMatch ? '#22C55E' : '#EF4444' },
                ]}
              >
                {passwordsMatch
                  ? 'Fjalëkalimet përputhen'
                  : 'Fjalëkalimet nuk përputhen'}
              </Text>
            </Animated.View>
          )}

          <Pressable
            style={[
              styles.button,
              (loading || !canSubmit) && { opacity: 0.6 },
            ]}
            onPress={handleUpdate}
            disabled={loading || !canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Përditëso fjalëkalimin
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <Modal
        visible={successVisible}
        transparent
        animationType="fade"
        onRequestClose={goToLogin}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: Colors.card },
            ]}
          >
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            </View>

            <Text style={[styles.modalTitle, { color: Colors.text }]}>
              Me sukses
            </Text>

            <Text style={[styles.modalText, { color: Colors.muted }]}>
              Fjalëkalimi yt u ndryshua me sukses. Tani mund të kyçesh me
              fjalëkalimin e ri.
            </Text>

            <Pressable style={styles.modalButton} onPress={goToLogin}>
              <Text style={styles.modalButtonText}>Shko te hyrja</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  passwordWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingRight: 44,
    borderRadius: 12,
    fontSize: 15,
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: [{ translateY: -11 }],
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  strengthTrack: {
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 12,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 999,
  },
  strengthBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  strengthBar: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  checkList: {
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkText: {
    marginLeft: 8,
    fontSize: 13,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  matchText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#C9A24D',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  successIconWrap: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#C9A24D',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});