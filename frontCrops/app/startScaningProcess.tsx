import { KeyboardAvoidingView, Platform, Image, View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
// import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ScrollView } from 'react-native-gesture-handler'
import { useAuth } from '@/context/AuthContext'

const StartScaningProcess = () => {
    const {navigate} = useRouter();
    const {isGuest,token:authToken,logout}=useAuth()
    return (
        <View className="flex-1 bg-green-50 pt-14">

          
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-center items-center"
            >
                {/* Image Section */}
                <View className="flex-col justify-end items-end ">
                    <Image
                        source={require('../assets/images/backgroundImage.png')}
                        style={{ width: 375, height: 550,marginBottom:-90 }}
                        resizeMode='cover'
                    />
                </View>
                 {!isGuest && (authToken) ? (
                            <TouchableOpacity
                                onPress={logout}
                                className='absolute top-2 right-0 w-18 h-6 rounded text-sm font-bold text-white flex justify-center items-center bg-red-300 p-3 leading-9'
                            >
                                
                                <Text>
                                    Log Out
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="absolute top-2 right-0 bg-gray-200 border-2 border-gray-300 rounded w-18 h-6  flex-row justify-center items-center opacity-50">
                                <Text className="text-gray-500 text-sm">
                                    Guest
                                </Text>
                            </View>
                        )}
                {/* Bottom Card */}
                <View className="rounded-t-3xl w-full flex-1 items-center justify-start bg-white py-10 px-6" style={{shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5 }}>
                    <Text className='poppins-semibold text-sm text-gray-500 text-center mb-4'>
                        "Scan your plant, spot the disease, save your harvest."
                    </Text>
                    <Text className='poppins-semibold text-3xl text-black text-center mb-10 px-4'>
                        Check your plants condition with scan features 
                    </Text>
                    <TouchableOpacity
                        onPress={() => { 
                            navigate('/ScanningProcess');
                        }}
                        className="bg-green-900 w-60 py-6 rounded-xl items-center shadow-lg"
                    >
                        <Text className="text-white text-base font-semibold poppins-semibold">
                            Start Scanning
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    )
}

export default StartScaningProcess