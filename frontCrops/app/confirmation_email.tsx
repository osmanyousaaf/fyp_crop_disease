import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context'
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';

import { useRouter } from 'expo-router'
import { useNavigation } from '@react-navigation/native';

export default function ConforimationEmailScreen() {
    const [password, setPassword] = useState('')
    const [conformpassword, setConformPassword] = useState('')
    const navigation = useNavigation()
    const { navigate } = useRouter()
    const handleSubmitReNewPassword = () => {
        if (!password) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        navigate('/startScaningProcess')
        Alert.alert('Success', `Password reset link sent to ${password}`);
        // navigation.goBack(); // Optional: go back after success
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >

                <View className="flex-1 justify-start px-8 pt-32 text-center ">
                    <Image
                        source={require('../assets/images/success.png')}
                        className="w-32 h-32 mb-6 self-center"/>

                    <Text className="text-2xl font-bold text-gray-900 mb-4 poppins-bold text-center">
                        Success
                    </Text>

                    {/* Subtitle */}
                    <Text className="text-md text-center text-gray-600 mb-6 font-semibold poppins-semibold capitalize">
                        Create a New Password. Ensure it offers than differs from previous ones from it
                    </Text>


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
