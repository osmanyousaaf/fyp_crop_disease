import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import React from 'react';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppChrome } from '@/components/AppChrome';

import { CROP_SECTORS, CropSectorId } from '@/constants/sectors';

import { COLORS } from '@/constants/theme';

import { useSector } from '@/context/SectorContext';



export default function SelectSectorScreen() {

  const router = useRouter();

  const { setSector } = useSector();



  const choose = async (id: CropSectorId) => {

    await setSector(id);

    router.replace('/startScaningProcess');

  };



  return (

    <AppChrome>

      <View className="px-5 pt-4 pb-8 flex-1">

        <Text style={styles.kicker}>Choose your lane</Text>

        <Text style={styles.title}>Which crops are you diagnosing?</Text>

        <Text style={styles.subtitle}>

          Each lane uses a dedicated model profile. You can switch later from the home screen.

        </Text>



        <View>

          {CROP_SECTORS.map((s, i) => (

            <TouchableOpacity

              key={s.id}

              activeOpacity={0.92}

              onPress={() => choose(s.id)}

              style={[styles.card, i > 0 && { marginTop: 16 }]}

            >

              <View style={styles.cardHeaderRow}>

                <View style={{ flex: 1, paddingRight: 12 }}>

                  <Text style={styles.brand}>{s.brand}</Text>

                  <Text style={styles.cardSub}>{s.subtitle}</Text>

                  <View style={{ marginTop: 12 }}>

                    {s.highlights.map((line) => (

                      <View key={line} style={styles.bulletRow}>

                        <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.jetMuted} />

                        <Text style={styles.bulletText}>{line}</Text>

                      </View>

                    ))}

                  </View>

                </View>

                <MaterialCommunityIcons name="chevron-right" size={26} color={COLORS.textMuted} style={{ marginTop: 4 }} />

              </View>

              <View style={styles.cta}>

                <Text style={styles.ctaText}>Use {s.brand}</Text>

              </View>

            </TouchableOpacity>

          ))}

        </View>

      </View>

    </AppChrome>

  );

}



const styles = StyleSheet.create({

  kicker: {

    color: COLORS.textSecondary,

    fontSize: 11,

    fontWeight: '800',

    letterSpacing: 3,

    textTransform: 'uppercase',

    marginBottom: 8,

  },

  title: {

    color: COLORS.jet,

    fontSize: 28,

    fontWeight: '800',

    letterSpacing: -0.5,

    marginBottom: 8,

  },

  subtitle: {

    color: COLORS.textSecondary,

    fontSize: 15,

    lineHeight: 22,

    marginBottom: 28,

  },

  card: {

    borderRadius: 22,

    overflow: 'hidden',

    borderWidth: 1,

    borderColor: COLORS.border,

    backgroundColor: COLORS.white,

    padding: 18,

  },

  cardHeaderRow: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    justifyContent: 'space-between',

  },

  brand: {

    color: COLORS.jet,

    fontSize: 20,

    fontWeight: '800',

  },

  cardSub: {

    color: COLORS.textSecondary,

    fontSize: 14,

    marginTop: 4,

    fontWeight: '500',

  },

  bulletRow: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    marginTop: 6,

  },

  bulletText: {

    color: COLORS.textSecondary,

    fontSize: 13,

    marginLeft: 8,

    flex: 1,

    lineHeight: 20,

  },

  cta: {

    marginTop: 16,

    backgroundColor: COLORS.jet,

    borderRadius: 14,

    paddingVertical: 14,

    alignItems: 'center',

  },

  ctaText: {

    color: COLORS.white,

    fontWeight: '800',

    fontSize: 14,

    letterSpacing: 0.3,

  },

});

