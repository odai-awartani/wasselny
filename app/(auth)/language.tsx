// app/(auth)/language.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';

const { width, height } = Dimensions.get('window');

export default function LanguageScreen() {
  const { setLanguage } = useLanguage();

  const handleLanguageSelect = async (lang: 'en' | 'ar') => {
    try {
      await setLanguage(lang);
      router.replace('/welcome');
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <Image
        source={require('@/assets/images/0.png')}
        style={styles.backgroundImage}
      />

      {/* Content */}
      <SafeAreaView style={styles.content}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={() => handleLanguageSelect('en')}
            style={styles.button}
          >
            <Text style={styles.buttonText}>English</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleLanguageSelect('ar')}
            style={styles.button}
          >
            <Text style={styles.buttonText}>عربي</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  backgroundImage: {
    flex: 1,
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    gap: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: 'black',
    width: 140,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});