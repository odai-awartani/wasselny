import React, { useState } from "react";
import { useUser } from "@clerk/clerk-expo";
import { Image, ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import InputField from "@/components/InputField";
import { useLanguage } from '@/context/LanguageContext';
import * as ImagePicker from 'expo-image-picker';
import { icons } from '@/constants';

const Profile = () => {
  const { user } = useUser();
  const { language } = useLanguage();

  const phoneNumber = user?.unsafeMetadata?.phoneNumber || "Not Found";

  const [profileImage, setProfileImage] = useState(null);

  const handleEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        language === 'ar' ? 'تم رفض الإذن' : 'Permission Denied',
        language === 'ar' ? 'يجب منح إذن للوصول إلى مكتبة الصور' : 'You need to grant permission to access media library.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0].uri;
      setProfileImage(selectedImage);
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        <Text className={`text-2xl my-5 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}`}>
          {language === 'ar' ? 'الملف الشخصي' : 'My Profile'}
        </Text>

        <View className="flex items-center justify-center my-5">
          <View className="relative">
            <Image
              source={{
                uri: profileImage || user?.externalAccounts[0]?.imageUrl || user?.imageUrl,
              }}
              style={{ width: 110, height: 110, borderRadius: 110 / 2 }}
              className="rounded-full h-[110px] w-[110px] border-[3px] border-white shadow-sm shadow-neutral-300"
            />
            <TouchableOpacity
              onPress={handleEditImage}
              className="absolute bottom-0 right-0"
            >
              <Image
                source={icons.image}
                style={{ width: 30, height: 30 }}
                className="rounded-full"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex flex-col items-start justify-center bg-white rounded-lg shadow-sm shadow-neutral-300 px-5 py-3">
          <View className="flex flex-col items-start justify-start w-full">
            <InputField
              label={language === 'ar' ? 'الاسم الأول' : 'First Name'}
              placeholder={user?.firstName || "Not Found"}
              containerStyle="w-full"
              inputStyle={`p-3.5 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              editable={false}
              labelStyle={language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}
              className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold' : 'text-left placeholder:text-left'}`}
            />

            <InputField
              label={language === 'ar' ? 'الاسم الأخير' : 'Last Name'}
              placeholder={user?.lastName || "Not Found"}
              containerStyle="w-full"
              inputStyle={`p-3.5 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              editable={false}
              labelStyle={language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}
              className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold' : 'text-left placeholder:text-left'}`}
            />

            <InputField
              label={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              placeholder={user?.primaryEmailAddress?.emailAddress || "Not Found"}
              containerStyle="w-full"
              inputStyle={`p-3.5 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              editable={false}
              labelStyle={language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}
              className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold' : 'text-left placeholder:text-left'}`}
            />

            <InputField
              label={language === 'ar' ? 'رقم الهاتف' : 'Phone'}
              placeholder={phoneNumber || "Not Found"}
              containerStyle="w-full"
              inputStyle={`p-3.5 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              editable={false}
              labelStyle={language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}
              className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold' : 'text-left placeholder:text-left'}`}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;