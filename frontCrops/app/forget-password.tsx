import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router'
import axios from 'axios';
import { ChevronLeftIcon } from 'lucide-react-native';
let API_URL = ''
const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const router = useRouter()
  const handleResetPassword = () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/forget-password`, {
      email
    }).then(response => {
      if (response.status == 200) {
        Alert.alert('Success', `Password reset link sent to ${email}`);
        router.push({
          pathname: '/verifyEmail',
          params: {
            email: email
          }
        })
      }
    }).catch((error) => {
      console.log(error)
      Alert.alert(error)
    })
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.push('/')}
          className="absolute top-12 left-6 z-10 bg-gray-100 rounded-full w-12 h-12 flex justify-center items-center shadow-md shadow-green-900"
        >
          <ChevronLeftIcon size={36} color="#333" />

        
        </TouchableOpacity>

        <View className="flex-1 justify-start px-8 pt-32 ">
          {/* Title */}
          <Text className="text-2xl font-bold text-gray-900 mb-4">
            Forgot password
          </Text>

          {/* Subtitle */}
          <Text className="text-md text-gray-600 mb-6 font-semibold">
            Please enter your email to reset the password
          </Text>

          {/* Email Input */}
          <View className="mb-6">
            <Text className="text-md font-bold text-gray-700 mb-2">
              Your Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Enter your email"
              placeholderTextColor="#999"
              className="border border-gray-500 rounded-xl px-4 py-3.5 text-base"
            />
          </View>
          {/* Reset Password Button */}
          <TouchableOpacity
            onPress={handleResetPassword}
            className="bg-green-900 py-4 rounded-xl items-center"
          >
            <Text className="text-white text-base font-semibold">
              Reset Password
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;