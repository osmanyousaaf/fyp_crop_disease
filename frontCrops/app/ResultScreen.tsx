import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions,
    Alert,
    Platform,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppChrome } from '../components/AppChrome';
import { COLORS } from '../constants/theme';

const { width } = Dimensions.get('window');

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function prettifyClassLabel(raw: string): string {
    return raw
        .replace(/___/g, ' › ')
        .replace(/_/g, ' ')
        .trim();
}

type ParsedSummary =
    | { kind: 'disease'; rawClass: string; prettyClass: string; probabilityLabel: string; detail: string }
    | { kind: 'healthy'; headline: string; probabilityLabel: string; detail: string }
    | { kind: 'plain'; text: string };

function parseModelDescription(description: string): ParsedSummary {
    const diseaseMatch = description.match(
        /Classifier top class:\s*(.+)\s+\(([\d.]+%)\s*probability\)\.\s*(.*)$/is,
    );
    if (diseaseMatch) {
        const rawClass = diseaseMatch[1].trim();
        const pct = diseaseMatch[2].trim();
        const detail = (diseaseMatch[3] || '').trim();
        return {
            kind: 'disease',
            rawClass,
            prettyClass: prettifyClassLabel(rawClass),
            probabilityLabel: pct,
            detail,
        };
    }
    const healthyMatch = description.match(
        /^(.+?)\s+predicted healthy\s*\(([\d.]+)%\s*confidence\)\.\s*(.+)$/is,
    );
    if (healthyMatch) {
        return {
            kind: 'healthy',
            headline: `${healthyMatch[1].trim()} — predicted healthy`,
            probabilityLabel: `${healthyMatch[2].trim()}%`,
            detail: healthyMatch[3].trim(),
        };
    }
    return { kind: 'plain', text: description };
}

function ModelSummaryCard({ description }: { description: string }) {
    const parsed = useMemo(() => parseModelDescription(description), [description]);

    if (parsed.kind === 'plain') {
        return (
            <View style={rs.card}>
                <View style={rs.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <MaterialCommunityIcons name="chip" size={22} color={COLORS.jetMuted} />
                        <Text style={rs.cardHeaderTitle}>Model summary</Text>
                    </View>
                    <MaterialCommunityIcons name="leaf" size={24} color={COLORS.textMuted} />
                </View>
                <View style={rs.cardBody}>
                    <Text style={rs.bodyText}>{parsed.text}</Text>
                </View>
            </View>
        );
    }

    if (parsed.kind === 'healthy') {
        return (
            <View style={rs.card}>
                <View style={[rs.cardHeader, { backgroundColor: COLORS.bgMuted }]}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={rs.kicker}>Classifier output</Text>
                        <Text style={rs.headline}>{parsed.headline}</Text>
                    </View>
                    <View style={rs.probBadge}>
                        <Text style={[rs.probMono, { fontFamily: monoFont }]}>{parsed.probabilityLabel}</Text>
                        <Text style={rs.probCaption}>confidence</Text>
                    </View>
                </View>
                <View style={[rs.cardBody, rs.cardBodyBorder]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <MaterialCommunityIcons name="tag-outline" size={18} color={COLORS.jetMuted} style={{ marginTop: 2 }} />
                        <Text style={[rs.mutedLine, { marginLeft: 8, flex: 1 }]}>{parsed.detail}</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={rs.card}>
            <View style={[rs.cardHeader, { backgroundColor: COLORS.bgMuted }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={rs.iconTile}>
                        <MaterialCommunityIcons name="brain" size={22} color={COLORS.jet} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                        <Text style={rs.kicker}>CNN top class</Text>
                        <Text style={rs.subHeadBlack}>Model summary</Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <View style={rs.probPill}>
                        <Text style={[rs.probMonoDark, { fontFamily: monoFont }]}>{parsed.probabilityLabel}</Text>
                    </View>
                    <Text style={rs.probCaption}>probability</Text>
                </View>
            </View>

            <View style={rs.denseBody}>
                <View style={rs.monoBlock}>
                    <Text style={[rs.monoText, { fontFamily: monoFont }]} numberOfLines={4}>
                        {parsed.rawClass}
                    </Text>
                    <View style={rs.hRule} />
                    <Text style={rs.prettyClass}>{parsed.prettyClass}</Text>
                </View>

                {parsed.detail ? (
                    <View style={rs.detailBox}>
                        <MaterialCommunityIcons name="map-marker-radius" size={20} color={COLORS.jetMuted} style={{ marginTop: 1 }} />
                        <Text style={[rs.mutedLine, { marginLeft: 8, flex: 1 }]}>{parsed.detail}</Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const rs = StyleSheet.create({
    card: {
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
    },
    cardHeaderTitle: {
        color: COLORS.jet,
        fontWeight: '700',
        fontSize: 18,
        marginLeft: 8,
    },
    cardBody: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    cardBodyBorder: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    bodyText: {
        color: COLORS.jetMuted,
        fontSize: 15,
        lineHeight: 24,
    },
    kicker: {
        color: COLORS.textSecondary,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    headline: {
        color: COLORS.jet,
        fontSize: 20,
        fontWeight: '800',
        lineHeight: 26,
    },
    subHeadBlack: {
        color: COLORS.jet,
        fontSize: 17,
        fontWeight: '800',
    },
    probBadge: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
    },
    probMono: {
        color: COLORS.jet,
        fontSize: 18,
        fontWeight: '800',
    },
    probCaption: {
        color: COLORS.textMuted,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    iconTile: {
        padding: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    probPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.borderStrong,
        backgroundColor: COLORS.bgSubtle,
    },
    probMonoDark: {
        color: COLORS.jet,
        fontSize: 16,
        fontWeight: '800',
    },
    denseBody: {
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: COLORS.bgMuted,
    },
    monoBlock: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    monoText: {
        color: COLORS.jetMuted,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '600',
    },
    hRule: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 12,
    },
    prettyClass: {
        color: COLORS.jet,
        fontSize: 15,
        lineHeight: 24,
        fontWeight: '600',
    },
    detailBox: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    mutedLine: {
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 22,
    },
});

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
    prevention_tips: string[];
    heatmap_png_base64?: string;
    sector?: string;
    sector_title?: string;
    sector_tagline?: string;
    grad_cam?: boolean;
}

const PENDING_PREDICT_JSON_KEY = 'pending_predict_result_v1';

async function mergePendingHeatmap(data: DiseaseData): Promise<DiseaseData> {
    const hm = await AsyncStorage.getItem('pending_heatmap_b64');
    if (hm) {
        await AsyncStorage.removeItem('pending_heatmap_b64');
        return { ...data, heatmap_png_base64: hm };
    }
    return data;
}

export default function ResultScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { isGuest, token: authToken } = useAuth();
    const [diseaseData, setDiseaseData] = useState<DiseaseData>();
    const [imageUri, setImageUri] = useState<string>('');
    const [bootError, setBootError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setBootError(null);

            if (params.imageUri) {
                setImageUri(params.imageUri as string);
            }

            const fromPending = params.fromPending === '1';

            if (fromPending) {
                try {
                    const raw = await AsyncStorage.getItem(PENDING_PREDICT_JSON_KEY);
                    if (!raw) {
                        if (!cancelled) setBootError('Could not load analysis results. Please run analysis again.');
                        return;
                    }
                    let data = JSON.parse(raw) as DiseaseData;
                    data = await mergePendingHeatmap(data);
                    if (cancelled) return;
                    await AsyncStorage.removeItem(PENDING_PREDICT_JSON_KEY);
                    setDiseaseData(data);
                } catch (error) {
                    console.error('Error loading pending disease data:', error);
                    if (!cancelled) setBootError('Could not read analysis results.');
                }
                return;
            }

            if (!params.diseaseData) {
                if (!cancelled) setBootError('No results to display.');
                return;
            }

            try {
                let data = JSON.parse(params.diseaseData as string) as DiseaseData;
                data = await mergePendingHeatmap(data);
                if (!cancelled) setDiseaseData(data);
            } catch (error) {
                console.error('Error parsing disease data:', error);
                if (!cancelled) setBootError('Could not parse results.');
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [params.fromPending, params.diseaseData, params.imageUri]);

    // Prepare data for Gifted Charts
    const barData = [
        {
            value: Math.round(diseaseData?.not_affected || 0),
            label: 'Healthy',
            frontColor: '#22c55e',
            labelTextStyle: { color: '#374151', fontWeight: 'bold' as const },
        },
        {
            value: Math.round(diseaseData?.slightly_affected || 0),
            label: 'Slight',
            frontColor: '#fbbf24',
            labelTextStyle: { color: '#374151', fontWeight: 'bold' as const },
        },
        {
            value: Math.round(diseaseData?.affected || 0) || 1,
            label: 'Affected',
            frontColor: '#f87171',
            labelTextStyle: { color: '#374151', fontWeight: 'bold' as const },
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
                    <strong>Healthy</strong><br/>${Math.round(diseaseData?.not_affected || 0)}%
                </div>
                <div class="severity-item slight">
                    <strong>Slightly Affected</strong><br/>${Math.round(diseaseData?.slightly_affected || 0)}%
                </div>
                <div class="severity-item affected">
                    <strong>Affected</strong><br/>${Math.round(diseaseData?.affected || 0) || 1}%
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
                <h2>Precautions</h2>
                <ul>
                    ${diseaseData.prevention_tips.map(item => `<li>${item}</li>`).join('')}
                </ul>
            ` : ''}

            ${diseaseData?.treatment && diseaseData.treatment.length > 0 ? `
                <h2>Recommended actions (cultural)</h2>
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

    if (bootError) {
        return (
            <AppChrome>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.jetMuted} />
                    <Text style={{ color: COLORS.jet, marginTop: 20, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>
                        Something went wrong
                    </Text>
                    <Text style={{ color: COLORS.textSecondary, marginTop: 12, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                        {bootError}
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        activeOpacity={0.9}
                        style={{
                            marginTop: 28,
                            paddingVertical: 14,
                            paddingHorizontal: 24,
                            borderRadius: 14,
                            backgroundColor: COLORS.jet,
                        }}
                    >
                        <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 16 }}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </AppChrome>
        );
    }

    if (!diseaseData) {
        return (
            <AppChrome>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
                    <ActivityIndicator size="large" color={COLORS.jet} />
                    <Text style={{ color: COLORS.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '600' }}>
                        Preparing your results…
                    </Text>
                </View>
            </AppChrome>
        );
    }

    const InfoSection = ({ title, icon, data }: { title: string; icon: string; data: string[] | string }) => {
        if (!data || (Array.isArray(data) && data.length === 0)) return null;

        return (
            <View
                style={{
                    borderRadius: 24,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.white,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View
                        style={{
                            padding: 8,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            backgroundColor: COLORS.bgSubtle,
                        }}
                    >
                        <MaterialCommunityIcons name={icon as any} size={20} color={COLORS.jet} />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.jet, marginLeft: 12 }}>{title}</Text>
                </View>
                {Array.isArray(data) ? (
                    data.map((item, index) => (
                        <View key={index} style={{ flexDirection: 'row', marginBottom: 8 }}>
                            <Text style={{ color: COLORS.jetMuted, marginRight: 8 }}>•</Text>
                            <Text style={{ color: COLORS.textSecondary, flex: 1, lineHeight: 22 }}>{item}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={{ color: COLORS.textSecondary, lineHeight: 22 }}>{data}</Text>
                )}
            </View>
        );
    };

    return (
        <AppChrome>
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 36 }}>
                <View className="px-5 pt-3">
                    <View
                        style={{
                            borderRadius: 28,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            backgroundColor: COLORS.white,
                            overflow: 'hidden',
                            marginBottom: 20,
                        }}
                    >
                        <View style={{ paddingHorizontal: 18, paddingVertical: 18 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ position: 'relative' }}>
                                    {imageUri ? (
                                        <Image
                                            source={{ uri: imageUri }}
                                            style={{
                                                width: 120,
                                                height: 120,
                                                borderRadius: 22,
                                                borderWidth: 2,
                                                borderColor: COLORS.borderStrong,
                                            }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View
                                            style={{
                                                width: 120,
                                                height: 120,
                                                borderRadius: 22,
                                                borderWidth: 2,
                                                borderColor: COLORS.border,
                                                backgroundColor: COLORS.bgSubtle,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <MaterialCommunityIcons name="leaf" size={52} color={COLORS.jetMuted} />
                                        </View>
                                    )}
                                    <View
                                        style={{
                                            position: 'absolute',
                                            bottom: -4,
                                            right: -4,
                                            backgroundColor: COLORS.jet,
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: COLORS.borderStrong,
                                        }}
                                    >
                                        <Text style={{ fontFamily: monoFont, color: COLORS.white, fontWeight: '900', fontSize: 12 }}>
                                            {(diseaseData.confidence_score || 0).toFixed(1)}%
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ marginLeft: 20, flex: 1 }}>
                                    <Text
                                        style={{
                                            color: COLORS.textSecondary,
                                            fontSize: 11,
                                            fontWeight: '800',
                                            letterSpacing: 2,
                                            textTransform: 'uppercase',
                                            marginBottom: 6,
                                        }}
                                    >
                                        {diseaseData.plant_type}
                                    </Text>
                                    {diseaseData.sector_title ? (
                                        <View
                                            style={{
                                                alignSelf: 'flex-start',
                                                marginBottom: 8,
                                                paddingHorizontal: 10,
                                                paddingVertical: 6,
                                                borderRadius: 8,
                                                backgroundColor: COLORS.bgMuted,
                                                borderWidth: 1,
                                                borderColor: COLORS.border,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: COLORS.jetMuted,
                                                    fontSize: 10,
                                                    fontWeight: '800',
                                                    letterSpacing: 1,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {diseaseData.sector_title}
                                                {diseaseData.sector_tagline ? ` · ${diseaseData.sector_tagline}` : ''}
                                            </Text>
                                        </View>
                                    ) : null}
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.jet, lineHeight: 30 }}>
                                        {diseaseData.disease_name}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                                        <View
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                marginRight: 8,
                                                backgroundColor: diseaseData.affected > 50 ? '#f87171' : '#fbbf24',
                                            }}
                                        />
                                        <Text style={{ color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 }}>
                                            {diseaseData.affected > 50 ? 'Higher severity signal' : 'Monitor and recheck'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View
                        style={{
                            borderRadius: 28,
                            padding: 20,
                            marginBottom: 20,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            backgroundColor: COLORS.white,
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.jet }}>Health breakdown</Text>
                            <MaterialCommunityIcons name="chart-bar" size={26} color={COLORS.jetMuted} />
                        </View>

                        <View style={{ alignItems: 'center' }}>
                            <BarChart
                                data={barData}
                                barWidth={45}
                                spacing={30}
                                width={width - 120}
                                height={200}
                                noOfSections={5}
                                maxValue={100}
                                yAxisThickness={0}
                                xAxisThickness={1}
                                xAxisColor={COLORS.border}
                                frontColor="#16a34a"
                                isAnimated
                                animationDuration={1000}
                                yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
                                xAxisLabelTextStyle={{ color: '#374151', fontWeight: 'bold', fontSize: 12 }}
                                hideRules
                                renderTooltip={(item: any) => (
                                    <View
                                        style={{
                                            backgroundColor: COLORS.jet,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            marginTop: -32,
                                            borderWidth: 1,
                                            borderColor: COLORS.borderStrong,
                                        }}
                                    >
                                        <Text style={{ color: COLORS.white, fontWeight: '800', fontSize: 14 }}>
                                            {item.value}%
                                        </Text>
                                    </View>
                                )}
                            />
                        </View>
                    </View>

                    {/* Information Sections */}
                    {diseaseData.description?.trim() ? (
                        <ModelSummaryCard description={diseaseData.description} />
                    ) : null}

                    {diseaseData.heatmap_png_base64 ? (
                        <View
                            style={{
                                borderRadius: 24,
                                padding: 16,
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: COLORS.border,
                                backgroundColor: COLORS.white,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                <View
                                    style={{
                                        padding: 8,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: COLORS.border,
                                        backgroundColor: COLORS.bgSubtle,
                                    }}
                                >
                                    <MaterialCommunityIcons name="fire" size={20} color={COLORS.jet} />
                                </View>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.jet, marginLeft: 12, flex: 1 }}>
                                    Grad-CAM focus map
                                </Text>
                            </View>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginBottom: 12, lineHeight: 22 }}>
                                Warmer regions influenced the classifier most (PyTorch checkpoint; not an LLM).
                            </Text>
                            <Image
                                source={{
                                    uri: `data:image/png;base64,${diseaseData.heatmap_png_base64}`,
                                }}
                                style={{
                                    width: '100%',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: COLORS.border,
                                    height: width - 40,
                                    maxHeight: 340,
                                }}
                                resizeMode="contain"
                            />
                        </View>
                    ) : null}

                    <InfoSection title="Possible Causes" icon="alert-octagon" data={diseaseData.causes} />

                    <InfoSection title="Precautions" icon="shield-check" data={diseaseData.prevention_tips} />

                    <InfoSection title="Recommended actions (cultural)" icon="medical-bag" data={diseaseData.treatment} />

                    <View
                        style={{
                            borderRadius: 22,
                            padding: 16,
                            marginBottom: 32,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            backgroundColor: COLORS.bgMuted,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.textSecondary} />
                            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 18 }}>
                                Results come from your CNN classifier (optional Grad-CAM). Not from Gemini or other LLMs. Consult an agronomist for critical decisions.
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginBottom: 40 }}>
                        <TouchableOpacity
                            onPress={handleRecapture}
                            activeOpacity={0.9}
                            style={{
                                flex: 1,
                                marginRight: 12,
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: COLORS.jet,
                                paddingVertical: 16,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: COLORS.white,
                            }}
                        >
                            <MaterialCommunityIcons name="camera-retake" size={22} color={COLORS.jet} />
                            <Text style={{ color: COLORS.jet, fontSize: 16, fontWeight: '800', marginLeft: 8 }}>Retake</Text>
                        </TouchableOpacity>
                        {isGuest && !authToken ? (
                            <View
                                style={{
                                    flex: 1,
                                    marginLeft: 12,
                                    borderRadius: 16,
                                    paddingVertical: 16,
                                    flexDirection: 'row',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    backgroundColor: COLORS.bgSubtle,
                                    borderWidth: 1,
                                    borderColor: COLORS.border,
                                    opacity: 0.85,
                                }}
                            >
                                <Feather name="lock" size={22} color={COLORS.textMuted} />
                                <Text style={{ color: COLORS.textMuted, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                                    Sign in to export
                                </Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={handleSavePDF}
                                activeOpacity={0.92}
                                style={{
                                    flex: 1,
                                    marginLeft: 12,
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    backgroundColor: COLORS.jet,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 16,
                                }}
                            >
                                <Feather name="download" size={22} color={COLORS.white} />
                                <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: '900', marginLeft: 8 }}>Save report</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </ScrollView>
        </AppChrome>
    );
}
