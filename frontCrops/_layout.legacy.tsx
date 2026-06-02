// import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Drawer } from "expo-router/drawer";
import "../global.css";
import CustomMenuButton from "@/components/CustomMenuButton";
import { View, Text } from "react-native";
import { DrawerHeaderProps } from "@react-navigation/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

export default function RootLayout() {
  // const [loaded] = useFonts({
  //   SpaceMono: require("../assets/fonts/Lato-Regular.ttf"),
  // });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          drawerPosition: "right",
        }}
      >
        
        <Drawer.Screen
          name="index" // This is the name of the page and must match the url from root
          options={
            { 
              drawerLabel:"Get Started",
              headerShadowVisible:false,
              headerShown:false,
            }
          }
        />
        
        <Drawer.Screen
          name="contact-us" // This is the name of the page and must match the url from root
          options={
            {drawerLabel:'Contact',
              headerShadowVisible:false,
              headerShown:false,
            }
          }
        />
        
        <Drawer.Screen
          name="home" // This is the name of the page and must match the url from root
          options={({ navigation }: any) => ({
            header: (props: DrawerHeaderProps) => (
              <SafeAreaView style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:10,backgroundColor:"#F4FFFF"}} className="flex">
                <View>
                  <Text className="text-xl font-bold text-gray-600" style={{fontWeight:600
                  ,textTransform:"uppercase"}}>Welcome</Text>
                  <Text className="text-sm text-gray-500"  style={{fontWeight:800}}>
                    SignWave
                  </Text>
                </View>
                <CustomMenuButton navigation={navigation} />
              </SafeAreaView>
            ),
            drawerLabel:"Home",
            headerShadowVisible: false,
          })}
        />
        <Drawer.Screen
          name="sign-to-text" // This is the name of the page and must match the url from root
          options={({ navigation }: any) => ({
            header: (props: DrawerHeaderProps) => (
              <SafeAreaView style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:10,backgroundColor:"#F4FFFF"}} className="flex">
                <View>
                  <Link href={'/'}><Feather name="chevron-left" size={28} color="#000" /></Link>
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-600" style={{fontWeight:600,fontSize:20
                  }}>Sign Language To Text</Text>
                </View>
                <CustomMenuButton navigation={navigation} />
              </SafeAreaView>
            ),
            drawerLabel:"Sign To Text",
            headerShadowVisible: false,
          })}
        />
      <Drawer.Screen
        name="text-to-sign"
           options={({ navigation }: any) => ({
            header: (props: DrawerHeaderProps) => (
              <SafeAreaView style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:10,backgroundColor:"#F4FFFF"}} className="flex">
                <View>
                  <Link href={'/'}><Feather name="chevron-left" size={28} color="#000" /></Link>
                </View>
                <View>
                  <Text className="text-xl font-bold text-gray-600" style={{fontWeight:600,fontSize:20
                  }}>Text To Sign</Text>
                </View>
                <CustomMenuButton navigation={navigation} />
              </SafeAreaView>
            ),
            drawerLabel:"Text To Sign",
            headerShadowVisible: false,
          })}></Drawer.Screen>
      </Drawer>
    </GestureHandlerRootView>
  );
}
