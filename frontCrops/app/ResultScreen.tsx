import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

interface DiseaseData {
    disease_name: string;
    plant_type: string;
    confidence_score: number;
    not_affected: number;
    slightly_affected: number;
    affected: number;
    treatment: string[];
    description: string;
    causes: string[];
    prevention_tips: string[]
}

export default function ResultScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { isGuest, token: authToken } = useAuth();
    const [diseaseData, setDiseaseData] = useState<DiseaseData>();
    const [imageUri, setImageUri] = useState<string>('');

    useEffect(() => {

        if (params.diseaseData) {
            try {
                const data = JSON.parse(params.diseaseData as string);
                setDiseaseData(data);
            } catch (error) {
                console.error('Error parsing disease data:', error);
            }
        }

        if (params.imageUri) {
            setImageUri(params.imageUri as string);
        }
    }, []);

    // Prepare data for Gifted Charts
    const barData = [
        {
            value: Math.round((diseaseData?.not_affected || 0)),
            label: 'Healthy',
            frontColor: '#22c55e',
            labelTextStyle: { color: '#1f2937', fontWeight: 'bold' as const },
        },
        {
            value: Math.round((diseaseData?.slightly_affected || 0)),
            label: 'Slight',
            frontColor: '#fbbf24',
            labelTextStyle: { color: '#1f2937', fontWeight: 'bold' as const },
        },
        {
            value: Math.round((diseaseData?.affected || 0)) || 1, // Ensure min 1 for visibility if affected
            label: 'Affected',
            frontColor: '#ef4444',
            labelTextStyle: { color: '#1f2937', fontWeight: 'bold' as const },
        },
    ];

    const handleSavePDF = async () => {
        try {
            const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
              .header { text-align: center; border-bottom: 2px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; }
              h1 { color: #16a34a; margin: 0; }
              h2 { color: #1f2937; border-left: 4px solid #16a34a; padding-left: 10px; margin-top: 30px; }
              .section { margin: 20px 0; background: #f9fafb; padding: 15px; rounded: 8px; }
              .label { font-weight: bold; color: #4b5563; }
              .value { color: #111827; }
              ul { padding-left: 20px; }
              li { margin-bottom: 8px; }
              .severity-grid { display: flex; justify-content: space-between; margin-top: 20px; }
              .severity-item { text-align: center; flex: 1; padding: 10px; border-radius: 8px; margin: 0 5px; }
              .healthy { background: #dcfce7; color: #166534; }
              .slight { background: #fef3c7; color: #92400e; }
              .affected { background: #fee2e2; color: #991b1b; }
            </style>
          </head>
          <body>
            <div class="header">
                <h1>Crop Disease Analysis Report</h1>
                <p>Generated on ${new Date().toLocaleDateString()}</p>
            </div>

            <div class="section">
                <p><span class="label">Plant Type:</span> <span class="value">${diseaseData?.plant_type}</span></p>
                <p><span class="label">Detected Condition:</span> <span class="value">${diseaseData?.disease_name}</span></p>
                <p><span class="label">Confidence Score:</span> <span class="value">${(diseaseData?.confidence_score || 0).toFixed(1)}%</span></p>
            </div>

            <h2>Severity Distribution</h2>
            <div class="severity-grid">
                <div class="severity-item healthy">
                    <strong>Healthy</strong><br/>${Math.round((diseaseData?.not_affected || 0))}%
                </div>
                <div class="severity-item slight">
                    <strong>Slightly Affected</strong><br/>${Math.round((diseaseData?.slightly_affected || 0))}%
                </div>
                <div class="severity-item affected">
                    <strong>Affected</strong><br/>${Math.round((diseaseData?.affected || 0))}%
                </div>
            </div>

            <h2>Description</h2>
            <p>${diseaseData?.description}</p>

            ${diseaseData?.causes && diseaseData.causes.length > 0 ? `
                <h2>Possible Causes</h2>
                <ul>
                    ${diseaseData.causes.map(item => `<li>${item}</li>`).join('')}
                </ul>
            ` : ''}

            ${diseaseData?.prevention_tips && diseaseData.prevention_tips.length > 0 ? `
                <h2>Prevention Tips</h2>
                <ul>
                    ${diseaseData.prevention_tips.map(item => `<li>${item}</li>`).join('')}
                </ul>
            ` : ''}

            ${diseaseData?.treatment && diseaseData.treatment.length > 0 ? `
                <h2>Recommended Treatment</h2>
                <ul>
                    ${diseaseData.treatment.map(item => `<li>${item}</li>`).join('')}
                </ul>
            ` : ''}

            <div style="margin-top: 50px; font-size: 12px; color: #6b7280; text-align: center;">
                <p>This report is for informational purposes only. Consult with an agricultural expert for critical decisions.</p>
            </div>
          </body>
        </html>
      `;

            const { uri } = await Print.printToFileAsync({ html });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Success', 'PDF saved successfully');
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            Alert.alert('Error', 'Failed to generate PDF');
        }
    };
    const handleRecapture = () => router.push('/ScanningProcess');

    if (!diseaseData) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <Text className="text-gray-600">Loading results...</Text>
            </View>
        );
    }

    const InfoSection = ({ title, icon, data, color }: { title: string, icon: string, data: string[] | string, color: string }) => {
        if (!data || (Array.isArray(data) && data.length === 0)) return null;

        return (
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
                <View className="flex-row items-center mb-3">
                    <View className={`p-2 rounded-lg ${color}`}>
                        <MaterialCommunityIcons name={icon as any} size={20} color="#fff" />
                    </View>
                    <Text className="text-lg font-bold text-gray-800 ml-3">{title}</Text>
                </View>
                {Array.isArray(data) ? (
                    data.map((item, index) => (
                        <View key={index} className="flex-row mb-2">
                            <Text className="text-green-600 mr-2">•</Text>
                            <Text className="text-gray-600 flex-1 leading-5">{item}</Text>
                        </View>
                    ))
                ) : (
                    <Text className="text-gray-600 leading-5">{data}</Text>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F3F4F6]">
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Header Image Area */}
                <View className="bg-gray-900 rounded-b-[40px] pb-8 pt-4 px-6 shadow-xl">
                    <View className="flex-row items-center">
                        <View className="relative">
                            {imageUri ? (
                                <Image
                                    source={{ uri: imageUri }}
                                    className="w-32 h-32 rounded-3xl border-4 border-green-500/30"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="w-32 h-32 bg-green-800/20 rounded-3xl items-center justify-center border-4 border-green-500/30">
                                    <MaterialCommunityIcons name="leaf" size={60} color="#22c55e" />
                                </View>
                            )}
                            <View className="absolute -bottom-2 -right-2 bg-green-500 px-3 py-1 rounded-full shadow-lg">
                                <Text className="text-white font-bold text-xs">
                                    {(diseaseData.confidence_score || 0).toFixed(1)}%
                                </Text>
                            </View>
                        </View>

                        <View className="ml-6 flex-1">
                            <Text className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                                {diseaseData.plant_type}
                            </Text>
                            <Text className="text-2xl font-black text-white leading-tight">
                                {diseaseData.disease_name}
                            </Text>
                            <View className="flex-row items-center mt-2">
                                <View className={`w-3 h-3 rounded-full ${diseaseData.affected > 0.5 ? 'bg-red-500' : 'bg-yellow-500'} mr-2`} />
                                <Text className="text-gray-300 font-semibold italic">
                                    {diseaseData.affected > 0.5 ? 'High Severity' : 'Monitor Closely'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View className="px-5 -mt-6">
                    {/* Severity Distribution Card */}
                    <View className="bg-white rounded-[32px] p-6 shadow-lg mb-6 border border-gray-100">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-gray-800">
                                Health Analysis
                            </Text>
                            <MaterialCommunityIcons name="chart-bar" size={24} color="#16a34a" />
                        </View>

                        <View className="items-center">
                            <BarChart
                                data={barData}
                                barWidth={45}
                                spacing={30}
                                width={width - 120}
                                height={200}
                                noOfSections={5}
                                maxValue={100}
                                yAxisThickness={0}
                                xAxisThickness={0}
                                frontColor="#16a34a"
                                isAnimated
                                animationDuration={1000}
                                yAxisTextStyle={{ color: '#9ca3af', fontSize: 10 }}
                                xAxisLabelTextStyle={{ color: '#4b5563', fontWeight: 'bold', fontSize: 12 }}
                                hideRules
                                renderTooltip={(item: any) => (
                                    <View className="bg-gray-800 px-3 py-1.5 rounded-xl -mt-8 shadow-md">
                                        <Text className="text-white font-bold text-sm">{item.value}%</Text>
                                    </View>
                                )}
                            />
                        </View>
                    </View>

                    {/* Information Sections */}
                    <InfoSection
                        title="Analysis Description"
                        icon="information"
                        data={diseaseData.description}
                        color="bg-blue-600"
                    />

                    <InfoSection
                        title="Possible Causes"
                        icon="alert-octagon"
                        data={diseaseData.causes}
                        color="bg-amber-500"
                    />

                    <InfoSection
                        title="Prevention Tips"
                        icon="shield-check"
                        data={diseaseData.prevention_tips}
                        color="bg-teal-600"
                    />

                    <InfoSection
                        title="Recommended Treatment"
                        icon="medical-bag"
                        data={diseaseData.treatment}
                        color="bg-green-600"
                    />

                    {/* Disclaimer Note */}
                    <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-8">
                        <View className="flex-row items-start">
                            <MaterialCommunityIcons name="information-outline" size={20} color="#6b7280" />
                            <Text className="text-gray-500 text-xs ml-2 flex-1 italic leading-4">
                                This analysis is powered by AI and should be used as a guidance tool. For critical decisions, please consult with a qualified agricultural expert or lab analysis.
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row mb-12 space-x-4">
                        <TouchableOpacity
                            onPress={handleRecapture}
                            className="flex-1 bg-white border-2 border-green-600 rounded-2xl py-4 flex-row justify-center items-center shadow-sm"
                        >
                            <MaterialCommunityIcons name="camera-retake" size={22} color="#16a34a" />
                            <Text className="text-green-600 text-lg font-bold ml-2">Retake</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSavePDF}
                            disabled={!authToken}
                            className={`flex-1 rounded-2xl py-4 flex-row justify-center items-center shadow-md ${!authToken ? 'bg-gray-300' : 'bg-green-600'}`}
                        >
                            <Feather name={!authToken ? "lock" : "download"} size={22} color="#fff" />
                            <Text className="text-white text-lg font-bold ml-2">
                                {!authToken ? 'Login to Save' : 'Save Report'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
    