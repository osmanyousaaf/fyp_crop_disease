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
import { ChevronLeftIcon } from 'lucide-react-native'; // Optional: for better back icon
import {useLocalSearchParams, useRouter} from 'expo-router'
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';

type ParamsProps={
  email:string;
  code:string;
}
const SetNewPasswordScreen = () => {
  const [password,setPassword]=useState('')
  const [conformpassword,setConformPassword]=useState('')
  const params:ParamsProps = useLocalSearchParams()
  const navigation = useNavigation()
  const router=useRouter()
  const handleSubmitReNewPassword = () => {
    if (!password) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/reset`,{
      email:params.email,
      code:params.code,
      password
    }).then(
      response => {
        Alert.alert('Success', `Password reset link sent to ${password}`);
        response.status == 200 && router.push('/confirmation_email')
      }
    ).catch(
      error =>{
        Alert.alert(error)
      }
    )
    };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="absolute top-12 left-6 z-10 bg-gray-100 rounded-full w-12 h-12 flex justify-center items-center shadow-md shadow-green-900"
        >
          {/* Option 1: Use Heroicon (install: npm install react-native-heroicons) */}
          <ChevronLeftIcon size={36} color="#333" />

          {/* Option 2: Use text fallback */}
          {/* <Text className="text-2xl text-gray-200 font-bold text-center">{'<'}</Text> */}
        </TouchableOpacity>

        <View className="flex-1 justify-start px-8 pt-32 ">
          {/* Title */}
          <Text className="text-2xl font-bold text-gray-900 mb-4 poppins-bold">
            Set New password
          </Text>

          {/* Subtitle */}
          <Text className="text-md text-gray-600 mb-6 font-semibold poppins-semibold capitalize">
            Create a New Password. Ensure it offers than differs from previous ones from it
          </Text>

          {/* Email Input */}
          <View className="mb-6">
            <Text className="text-md font-bold text-gray-700 mb-2 poppins-bold">
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              keyboardType="visible-password"
              autoCapitalize="none"
              placeholder="*********"
              placeholderTextColor="#999"
              className="border border-gray-500 rounded-xl px-4 py-3.5 text-base"
            />
          </View>
          <View className="mb-12">
            <Text className="text-md font-bold text-gray-700 mb-2 poppins-bold">
              Confirm Password
            </Text>
            <TextInput
              value={conformpassword}
              onChangeText={setConformPassword}
              keyboardType="visible-password"
              autoCapitalize="none"
              placeholder="*********"
              placeholderTextColor="#999"
              className="border border-gray-500 rounded-xl px-4 py-3.5 text-base"
            />
          </View>
          {/* Reset Password Button */}
          <TouchableOpacity
            onPress={handleSubmitReNewPassword}
            className="bg-green-900 py-4 rounded-xl items-center"
          >
            <Text className="text-white text-base font-semibold poppins-semibold">
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SetNewPasswordScreen;