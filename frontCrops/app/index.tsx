import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { Eye, EyeClosed } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const Index = () => {
  const router = useRouter();
  const { login, continueAsGuest, token, isGuest } = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);


  // Navigate if already logged in or guest
  useEffect(() => {
    if (token || isGuest) {
      router.replace('/startScaningProcess');
    }
  }, [token, isGuest]);

  // Configure Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,
      offlineAccess: true,
      // forceCodeForRefreshToken: true,
    });
  }, []);


  // Normal email/password login or signup
  const handleContinue = async () => {
    if (isLogin) {
      if (!email || !password) return Alert.alert('Error', 'Please fill all fields');

      try {
        const res = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/login`, {
          email,
          password,
        });
        await login(res.data.access_token, { id: 'some-id', email }); // Backend should return user info
        router.replace('/startScaningProcess');
      } catch (err: any) {
        Alert.alert('Login Failed', err.response?.data?.message || 'Invalid credentials');
      }
    } else {
      if (!fullName || !email || !password) return Alert.alert('Error', 'Please fill all fields');

      try {
        await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/signup`, {
          name: fullName,
          email,
          password,
        });
        Alert.alert('Success', 'Check your email for the verification code.');
        setIsLogin(true); // Switch to login after signup
        console.log(process.env.EXPO_PUBLIC_API_URL)
      } catch (err: any) {
        Alert.alert('Signup Failed', err.response?.data?.message || 'Try again');
      }
    }
  };

  const handleGoogleAuthWithBackend = async (idToken: string) => {
    try {
      const res = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/google`, {
        token: idToken,
      });
      await login(res.data.access_token, { id: 'google-id', email: '' }); // Email can be fetched from idToken if needed
      router.replace('/startScaningProcess');
    } catch (error: any) {
      console.error('Google Sign-in Error:', error);
      Alert.alert('Google Auth Failed', error.response?.data?.message || error.message);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-in User Info:', userInfo);

      // Specifically use idToken for backend verification
      const idToken = userInfo.data?.idToken;
      if (idToken) {
        handleGoogleAuthWithBackend(idToken);
      } else {
        throw new Error('No idToken received from Google');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
        console.log('Google Sign-in Cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
        console.log('Google Sign-in In Progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // play services not available or outdated
        Alert.alert('Error', 'Google Play Services not available');
      } else {
        // some other error happened
        console.error('Google Sign-in Error:', error);
        Alert.alert('Google Auth Failed', error.message);
      }
    }
  };

  const handleGuestMode = () => {
    continueAsGuest();
    router.replace('/startScaningProcess');
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Logo */}
        <View className="items-center mt-10 mb-2">
          <Image
            style={{ width: 150, height: 150 }}
            source={require('../assets/images/logo.png')}
          />
        </View>

        {/* Login / Signup Tabs */}
        <View className="flex-row justify-around items-center mt-6 mb-10">
          <TouchableOpacity onPress={() => setIsLogin(true)} className="w-1/2 items-center">
            <Text className={`text-lg font-bold ${isLogin ? 'text-green-900' : 'text-gray-500'}`}>
              Log in
            </Text>
            {isLogin && <View className="h-1 w-full bg-green-800 rounded-full mt-2" />}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(false)} className="w-1/2 items-center">
            <Text className={`text-lg font-bold ${!isLogin ? 'text-green-900' : 'text-gray-500'}`}>
              Sign up
            </Text>
            {!isLogin && <View className="h-1 w-full bg-green-800 rounded-full mt-2" />}
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View className="px-8">
          {!isLogin && (
            <View className="mb-4">
              <Text className="text-md font-bold text-gray-700 mb-2">Your Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                className="border border-gray-400 rounded-xl px-4 py-3.5 text-base"
              />
            </View>
          )}

          <View className="mb-4">
            <Text className="text-md font-bold text-gray-700 mb-2">Your Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Enter your email"
              placeholderTextColor="#999"
              className="border border-gray-400 rounded-xl px-4 py-3.5 text-base"
            />
          </View>

          <View className="mb-6 relative">
            <Text className="text-md font-bold text-gray-700 mb-2">
              {isLogin ? 'Password' : 'Create Password'}
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              className="border border-gray-400 rounded-xl px-4 py-3.5 text-base pr-12"
            />
            <TouchableOpacity
              className="absolute right-4 top-10"
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeClosed color="#666" /> : <Eye color="#666" />}
            </TouchableOpacity>
          </View>

          {isLogin && (
            <View className="flex-row justify-between mb-6">
              <TouchableOpacity onPress={handleGuestMode}>
                <Text className="text-gray-500 text-sm">Guest Mode</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/forget-password')}>
                <Text className="text-gray-500 text-sm">Forgot password?</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            className="bg-green-900 py-4 rounded-xl items-center mb-6"
          >
            <Text className="text-white text-base font-semibold">Continue</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-300" />
            <Text className="mx-4 text-gray-500 text-sm">Or</Text>
            <View className="flex-1 h-px bg-gray-300" />
          </View>

          {/* Google Button - Triggers only on press */}
          <TouchableOpacity
            onPress={handleGoogleAuth}
            className={`flex-row items-center justify-center border border-gray-400 rounded-xl py-4`}
          >
            <Image
              source={require('../assets/images/google icon.png')}
              style={{ width: 24, height: 24, marginRight: 12 }}
            />
            <Text className="text-gray-800 text-base font-medium">
              {isLogin ? 'Login with Google' : 'Sign up with Google'}
            </Text>
          </TouchableOpacity>

          {/* Bottom Link */}
          <View className="items-center mt-8">
            <Text className="text-gray-600">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text
                onPress={() => setIsLogin(!isLogin)}
                className="text-blue-600 font-semibold"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScrollView>
  );
};

export default Index;