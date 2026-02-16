import React, { useState,useRef, useEffect, act } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeftIcon } from 'lucide-react-native'; // Optional: for better back ico
import { useLocalSearchParams, useRouter } from 'expo-router/build/hooks';
import axios from 'axios';
let CODE_LENGTH = 5

type params={
  email:string
}
const VerifyEmailScreen = () => {
  
  const [verifyCode, setVerifyCode] = useState(Array(CODE_LENGTH).fill(''));
  const [isCompleted,setIsCompleted]=useState<boolean>(false)
  const inputRef=useRef<Array<TextInput|null>>([])
  const navigation = useNavigation();
  const router = useRouter()
  const params:params = useLocalSearchParams()
  useEffect(()=>{
    let fill = verifyCode.join('')
    let complete = fill.length === CODE_LENGTH && /\d+$/.test(fill)
    if (complete)console.log('good')
  },[verifyCode])

  const handleVerifyCode = (elm:string,index:number) => {
      const digit = elm.replace(/[^0-9]/g,'')
      if (digit.length == 1){
        const newCode = [...verifyCode];
        newCode[index]=digit;
        setVerifyCode(newCode)
        if(index < CODE_LENGTH - 1){
          inputRef.current[index + 1]?.focus()
        }
      }else if(digit.length == 0){
        const newCode = [...verifyCode];
        newCode[index]=''
        setVerifyCode(newCode)
      }else if(digit.length > 1){
        let paste = digit.slice(0,CODE_LENGTH).split('')
        let conctcode = paste.concat(Array(CODE_LENGTH - paste.length).fill(''))
        setVerifyCode(conctcode)
        Keyboard.dismiss();
      }
  };
  const handleKeyPress=(e:any,index:number)=>{
    if(e.nativeEvent.Key === 'Backspace' && ! verifyCode[index] && index > 0){
      inputRef.current[index - 1]?.focus()
      const newCode = [...verifyCode];
      newCode[index - 1]='';
      setVerifyCode(newCode)
    }
  }
  const classBasedInputColorChanging=(elm:string,index:number)=>{
    let fill = verifyCode[index] !== '';
    let active = fill || isCompleted;

     return `
      border  w-12 rounded-xl h-12 text-center text-base ${
      isCompleted ? 'border-green-900 bg-green-50 text-green-900':active ?"border-gray-50 bg-white text-gray-800":
      "border-gray-300 bg-white text-gray-300"
      } 
    `.replace(/\s+/g,' ').trim()
    
  }
  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.push('/forget-password')}
          className="absolute top-12 left-6 z-10 bg-gray-100 rounded-full w-12 h-12 flex justify-center items-center shadow-md shadow-green-900"
        >
          {/* Option 1: Use Heroicon (install: npm install react-native-heroicons) */}
          <ChevronLeftIcon size={36} color="#333" />

         
        </TouchableOpacity>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>

        <View className="flex-1 justify-start px-8 pt-32 ">
          {/* Title */}
          <Text className="text-2xl font-bold poppins-bold text-gray-900 mb-4">
            Check Your Email
          </Text>

          {/* Subtitle */}
          <Text className="text-md text-gray-600 poppins-semibold capitalize">
                we will sent reset link to <Text className='poppins-bold'>{params && params.email }</Text>  
          </Text>
          <Text className="text-md text-gray-600 mb-6 poppins-semibold capitalize">
                enter 5 digit code that mentioned in the email  
          </Text>

          {/* Email Input */}
          <View className="mb-6">
            <Text className="text-md poppins-bold text-gray-700 mb-4">
              Verify Code
            </Text>
            <View className='w-full h-auto flex justify-between items-center flex-row'>
           {
            verifyCode.map((elm,index:number)=>{
              return <>
            <TextInput
              key={index+'098'}
              value={elm}
              ref={(ref)=>{inputRef.current[index]=ref}}
              onChangeText={(e)=>handleVerifyCode(e,index)}
              onPress={(e)=>handleKeyPress(e,index)}
              keyboardType="numeric"
              autoCapitalize="none"
              placeholder=""
              maxLength={1}
              placeholderTextColor="#999"
              textAlign='center'
              className={classBasedInputColorChanging(elm as string,index)}
            />  
              </>
            })
           }
            
         
            </View>
          </View>
          {/* Reset Password Button */}
          <TouchableOpacity
            onPress={()=>{
              let code = verifyCode.join('').length == 5 ? verifyCode.join(''):''
              axios.post(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/verify`,{
                email:params && params.email,code
              }).then(
                response => response.status == 200 && router.push(
                  {
                    pathname:'/setPassword',
                    params:{
                      email:params.email,
                      code:code,
                    }
                  }
                )
              ).catch(
                error => Alert.alert(error)
              )
            }}
            className="bg-green-900 py-4 rounded-xl items-center"
          >
            <Text className="text-white text-base poppins-semibold">
              Verify Code
            </Text>
          </TouchableOpacity>
        </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default VerifyEmailScreen;