// Google Sign-In disabled — requires google-services.json setup

import axios from 'axios';

import { useRouter } from 'expo-router';

import { Eye, EyeOff } from 'lucide-react-native';

import React, { useEffect, useMemo, useState } from 'react';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import {

  ActivityIndicator,

  Image,

  StyleSheet,

  Text,

  TextInput,

  TouchableOpacity,

  View,

} from 'react-native';

import { AuthChrome } from '../components/AuthChrome';

import { useAuth } from '../context/AuthContext';

import { COLORS } from '../constants/theme';

import { getApiErrorMessage } from '../utils/apiError';



const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());



const Index = () => {

  const router = useRouter();

  const { login, continueAsGuest, token, isGuest } = useAuth();



  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');

  const [isLogin, setIsLogin] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [banner, setBanner] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{

    email?: string;

    password?: string;

    name?: string;

  }>({});



  useEffect(() => {

    if (token || isGuest) {

      router.replace('/startScaningProcess');

    }

  }, [token, isGuest]);






  const clearBanner = () => setBanner(null);



  const validateForm = (): boolean => {

    clearBanner();

    const next: typeof fieldErrors = {};

    if (!isLogin && (!fullName.trim() || fullName.trim().length < 2)) {

      next.name = 'Enter your full name (at least 2 characters).';

    }

    if (!email.trim()) next.email = 'Email is required.';

    else if (!emailOk(email)) next.email = 'Enter a valid email address.';

    if (!password) next.password = 'Password is required.';

    else if (!isLogin && password.length < 6) {

      next.password = 'Use at least 6 characters for your password.';

    }

    setFieldErrors(next);

    return Object.keys(next).length === 0;

  };



  const handleContinue = async () => {

    if (!validateForm()) return;

    setLoading(true);

    clearBanner();

    const api = process.env.EXPO_PUBLIC_API_URL ?? '';



    try {

      if (isLogin) {

        const res = await axios.post(`${api}/api/auth/login`, { email: email.trim(), password });

        await login(res.data.access_token, {

          id: email.trim(),

          email: email.trim(),

        });

        router.replace('/startScaningProcess');

      } else {

        await axios.post(`${api}/api/auth/signup`, {

          name: fullName.trim(),

          email: email.trim(),

          password,

        });

        try {

          const loginRes = await axios.post(`${api}/api/auth/login`, {

            email: email.trim(),

            password,

          });

          await login(loginRes.data.access_token, {

            id: email.trim(),

            email: email.trim(),

            name: fullName.trim(),

          });

          router.replace('/startScaningProcess');

        } catch {

          setBanner({

            type: 'success',

            text: 'Account created. Sign in with your email and password.',

          });

          setIsLogin(true);

          setPassword('');

        }

      }

    } catch (err: unknown) {

      const msg = getApiErrorMessage(err, 'Request failed.');

      setBanner({ type: 'error', text: msg });

    } finally {

      setLoading(false);

    }

  };



  const handleGoogleAuth = async () => {

    setBanner({ type: 'error', text: 'Google Sign-In is not available in this build. Please use email/password.' });

  };



  const handleGuestMode = () => {

    continueAsGuest();

    router.replace('/startScaningProcess');

  };



  const subtitle = useMemo(

    () =>

      isLogin

        ? 'Sign in to analyze crops with your trained model.'

        : 'Create your account — verification is instant on this server.',

    [isLogin],

  );



  return (

    <AuthChrome>

      <View className="px-6 pt-2" style={styles.page}>

        {banner ? (

          <View

            style={[

              styles.banner,

              banner.type === 'error' ? styles.bannerErr : styles.bannerOk,

            ]}

          >

            <Text

              style={[styles.bannerText, banner.type === 'error' ? styles.bannerTextErr : styles.bannerTextOk]}

            >

              {banner.text}

            </Text>

          </View>

        ) : null}



        <View style={styles.logoBlock}>

          <Image

            source={require('../assets/images/app-logo.png')}

            style={styles.logoImage}

            resizeMode="contain"

          />

          <Text style={styles.headline}>Crop Disease Detector</Text>

          <Text style={styles.subHead}>{subtitle}</Text>

        </View>



        <View style={styles.segmentOuter}>

          <TouchableOpacity

            onPress={() => {

              setIsLogin(true);

              clearBanner();

              setFieldErrors({});

            }}

            activeOpacity={0.85}

            style={[styles.segmentBtn, isLogin && styles.segmentBtnActive]}

          >

            <Text style={[styles.segmentLabel, isLogin ? styles.segmentLabelOn : styles.segmentLabelOff]} numberOfLines={1}>

              Log in

            </Text>

          </TouchableOpacity>

          <TouchableOpacity

            onPress={() => {

              setIsLogin(false);

              clearBanner();

              setFieldErrors({});

            }}

            activeOpacity={0.85}

            style={[styles.segmentBtn, !isLogin && styles.segmentBtnActive]}

          >

            <Text style={[styles.segmentLabel, !isLogin ? styles.segmentLabelOn : styles.segmentLabelOff]} numberOfLines={1}>

              Sign up

            </Text>

          </TouchableOpacity>

        </View>



        <View style={styles.card}>

          {!isLogin && (

            <View style={styles.fieldBlock}>

              <Text style={styles.label}>Full name</Text>

              <TextInput

                value={fullName}

                onChangeText={(t) => {

                  setFullName(t);

                  setFieldErrors((p) => ({ ...p, name: undefined }));

                }}

                placeholder="Jane Farmer"

                placeholderTextColor={COLORS.textMuted}

                style={styles.input}

              />

              {fieldErrors.name ? <Text style={styles.fieldErr}>{fieldErrors.name}</Text> : null}

            </View>

          )}



          <View style={styles.fieldBlock}>

            <Text style={styles.label}>Email</Text>

            <TextInput

              value={email}

              onChangeText={(t) => {

                setEmail(t);

                setFieldErrors((p) => ({ ...p, email: undefined }));

              }}

              keyboardType="email-address"

              autoCapitalize="none"

              autoCorrect={false}

              placeholder="you@farm.com"

              placeholderTextColor={COLORS.textMuted}

              style={styles.input}

            />

            {fieldErrors.email ? <Text style={styles.fieldErr}>{fieldErrors.email}</Text> : null}

          </View>



          <View style={[styles.fieldBlock, { marginBottom: 4 }]}>

            <Text style={styles.label}>{isLogin ? 'Password' : 'Password'}</Text>

            <View style={styles.inputRow}>

              <TextInput

                value={password}

                onChangeText={(t) => {

                  setPassword(t);

                  setFieldErrors((p) => ({ ...p, password: undefined }));

                }}

                secureTextEntry={!showPassword}

                placeholder="••••••••"

                placeholderTextColor={COLORS.textMuted}

                style={[styles.passwordInput, { flex: 1 }]}

              />

              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={12} style={{ padding: 8 }}>

                {showPassword ? (

                  <EyeOff color={COLORS.textSecondary} size={22} />

                ) : (

                  <Eye color={COLORS.textSecondary} size={22} />

                )}

              </TouchableOpacity>

            </View>

            {fieldErrors.password ? (

              <Text style={styles.fieldErr}>{fieldErrors.password}</Text>

            ) : (

              <Text style={styles.hint}>

                {isLogin ? 'Tap the eye to show or hide your password.' : 'Minimum 6 characters.'}

              </Text>

            )}

          </View>



          {isLogin && (

            <View style={styles.linkRow}>

              <TouchableOpacity onPress={handleGuestMode} hitSlop={8} style={styles.linkHit}>

                <Text style={styles.linkPrimary}>Continue as guest</Text>

              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/forget-password')} hitSlop={8} style={styles.linkHit}>

                <Text style={styles.linkMuted}>Forgot password?</Text>

              </TouchableOpacity>

            </View>

          )}



          {!isLogin && <View style={{ height: 16 }} />}



          <TouchableOpacity

            onPress={handleContinue}

            disabled={loading}

            activeOpacity={0.9}

            style={[styles.primaryBtn, loading && { opacity: 0.85 }]}

          >

            {loading ? (

              <ActivityIndicator color={COLORS.white} />

            ) : (

              <Text style={styles.primaryBtnText}>{isLogin ? 'Sign in' : 'Create account'}</Text>

            )}

          </TouchableOpacity>



          <View style={styles.orRow}>

            <View style={styles.orLine} />

            <Text style={styles.orText}>or</Text>

            <View style={styles.orLine} />

          </View>



          <TouchableOpacity onPress={handleGoogleAuth} activeOpacity={0.88} style={styles.googleBtn}>

            <MaterialCommunityIcons name="google" size={22} color={COLORS.jet} style={{ marginRight: 12 }} />

            <Text style={styles.googleBtnText}>{isLogin ? 'Continue with Google' : 'Sign up with Google'}</Text>

          </TouchableOpacity>

        </View>



        <View style={styles.footerSwitch}>

          <Text style={styles.footerQ}>{isLogin ? "Don't have an account?" : 'Already registered?'}</Text>

          <TouchableOpacity

            onPress={() => {

              setIsLogin(!isLogin);

              clearBanner();

              setFieldErrors({});

            }}

            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}

          >

            <Text style={styles.footerAction}>{isLogin ? 'Sign up' : 'Log in'}</Text>

          </TouchableOpacity>

        </View>

      </View>

    </AuthChrome>

  );

};



export default Index;



const styles = StyleSheet.create({

  page: {

    width: '100%',

    maxWidth: 440,

    alignSelf: 'center',

  },

  banner: {

    marginBottom: 16,

    borderRadius: 16,

    paddingHorizontal: 16,

    paddingVertical: 12,

    borderWidth: 1,

  },

  bannerErr: {

    backgroundColor: COLORS.errorBg,

    borderColor: COLORS.errorBorder,

  },

  bannerOk: {

    backgroundColor: COLORS.successBg,

    borderColor: COLORS.successBorder,

  },

  bannerText: {

    fontSize: 14,

    fontWeight: '600',

    lineHeight: 20,

  },

  bannerTextErr: { color: COLORS.errorText },

  bannerTextOk: { color: COLORS.successText },

  logoBlock: {

    alignItems: 'center',

    marginBottom: 24,

    width: '100%',

  },

  logoImage: {

    width: '100%',

    maxWidth: 360,

    height: 112,

    marginBottom: 16,

  },

  headline: {

    color: COLORS.jet,

    fontSize: 24,

    fontWeight: '800',

    letterSpacing: -0.5,

    textAlign: 'center',

  },

  subHead: {

    color: COLORS.textSecondary,

    fontSize: 14,

    marginTop: 8,

    textAlign: 'center',

    maxWidth: 320,

    lineHeight: 20,

  },

  segmentOuter: {

    flexDirection: 'row',

    alignItems: 'stretch',

    width: '100%',

    borderRadius: 16,

    padding: 4,

    marginBottom: 24,

    backgroundColor: COLORS.bgSubtle,

    borderWidth: 1,

    borderColor: COLORS.border,

  },

  segmentBtn: {

    flex: 1,

    minWidth: 0,

    paddingVertical: 14,

    paddingHorizontal: 8,

    borderRadius: 12,

    alignItems: 'center',

    justifyContent: 'center',

  },

  segmentBtnActive: {

    backgroundColor: COLORS.white,

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 1 },

    shadowOpacity: 0.06,

    shadowRadius: 4,

    elevation: 2,

  },

  segmentLabel: {

    fontWeight: '700',

    fontSize: 15,

    textAlign: 'center',

  },

  segmentLabelOn: {

    color: COLORS.jet,

  },

  segmentLabelOff: {

    color: COLORS.textMuted,

  },

  card: {

    borderRadius: 28,

    borderWidth: 1,

    borderColor: COLORS.border,

    backgroundColor: COLORS.white,

    padding: 20,

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.04,

    shadowRadius: 8,

    elevation: 2,

  },

  fieldBlock: {

    marginBottom: 16,

  },

  label: {

    color: COLORS.jetMuted,

    fontSize: 11,

    fontWeight: '700',

    letterSpacing: 1,

    textTransform: 'uppercase',

    marginBottom: 8,

  },

  input: {

    borderRadius: 16,

    borderWidth: 1,

    borderColor: COLORS.border,

    backgroundColor: COLORS.bgMuted,

    paddingHorizontal: 16,

    paddingVertical: 14,

    fontSize: 16,

    color: COLORS.jet,

  },

  inputRow: {

    flexDirection: 'row',

    alignItems: 'center',

    width: '100%',

    borderRadius: 16,

    borderWidth: 1,

    borderColor: COLORS.border,

    backgroundColor: COLORS.bgMuted,

    paddingRight: 8,

  },

  passwordInput: {

    minWidth: 0,

    paddingHorizontal: 16,

    paddingVertical: 14,

    fontSize: 16,

    color: COLORS.jet,

  },

  fieldErr: {

    color: '#B91C1C',

    fontSize: 12,

    marginTop: 6,

  },

  hint: {

    color: COLORS.textMuted,

    fontSize: 11,

    marginTop: 6,

  },

  linkRow: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent: 'space-between',

    alignItems: 'center',

    gap: 12,

    width: '100%',

    marginTop: 16,

    marginBottom: 20,

  },

  linkHit: {

    paddingVertical: 4,

  },

  linkPrimary: {

    color: COLORS.jet,

    fontSize: 14,

    fontWeight: '700',

  },

  linkMuted: {

    color: COLORS.textSecondary,

    fontSize: 14,

    fontWeight: '600',

  },

  primaryBtn: {

    backgroundColor: COLORS.jet,

    borderRadius: 16,

    paddingVertical: 16,

    alignItems: 'center',

    justifyContent: 'center',

    flexDirection: 'row',

  },

  primaryBtnText: {

    color: COLORS.white,

    fontWeight: '800',

    fontSize: 16,

    letterSpacing: 0.3,

  },

  orRow: {

    flexDirection: 'row',

    alignItems: 'center',

    width: '100%',

    marginVertical: 24,

  },

  orLine: {

    flex: 1,

    height: 1,

    backgroundColor: COLORS.border,

    minWidth: 8,

  },

  orText: {

    marginHorizontal: 16,

    color: COLORS.textMuted,

    fontSize: 11,

    fontWeight: '700',

    letterSpacing: 2,

    textTransform: 'uppercase',

  },

  googleBtn: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    width: '100%',

    borderRadius: 16,

    borderWidth: 1,

    borderColor: COLORS.borderStrong,

    backgroundColor: COLORS.white,

    paddingVertical: 16,

  },

  googleBtnText: {

    color: COLORS.jet,

    fontWeight: '700',

    fontSize: 15,

  },

  footerSwitch: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    flexWrap: 'wrap',

    width: '100%',

    marginTop: 28,

    marginBottom: 24,

  },

  footerQ: {

    color: COLORS.textSecondary,

    fontSize: 14,

  },

  footerAction: {

    color: COLORS.jet,

    fontWeight: '800',

    fontSize: 14,

    marginLeft: 4,

  },

});

