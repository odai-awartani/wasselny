import { useUser } from "@clerk/clerk-expo";
import { Image, ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import InputField from "@/components/InputField";
import { useLanguage } from '@/context/LanguageContext';
import * as ImagePicker from 'expo-image-picker'; // Import ImagePicker
import { icons } from '@/constants'; // Import your icons object

const Profile = () => {
  const { user } = useUser();
  const { language } = useLanguage();

  // Access phone number from unsafeMetadata
  const phoneNumber = user?.unsafeMetadata?.phoneNumber || "Not Found";

  // Function to handle image upload/edit
  const handleEditImage = async () => {
    // Request permission to access the media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t.permissionDenied,
        t.cameraRollPermissionMessage
      );
      return;
    }

    // Open the image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio
      quality: 1,
    });

    if (!result.canceled) {
      // Handle the selected image
      const selectedImage = result.assets[0].uri;
      console.log("Selected image:", selectedImage);
      // Update the user's profile image (e.g., upload to a server or update Clerk metadata)
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Profile Title */}
        <Text
          className={`text-2xl my-5 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}`}
        >
          {language === 'ar' ? 'الملف الشخصي' : 'My Profile'}
        </Text>

        {/* Profile Image with Edit Icon */}
        <View className="flex items-center justify-center my-5">
          <View className="relative">
            {/* User Image */}
            <Image
              source={{
                uri: user?.externalAccounts[0]?.imageUrl ?? user?.imageUrl,
              }}
              style={{ width: 110, height: 110, borderRadius: 110 / 2 }}
              className="rounded-full h-[110px] w-[110px] border-[3px] border-white shadow-sm shadow-neutral-300"
            />

            {/* Edit Icon Button */}
            <TouchableOpacity
              onPress={handleEditImage}
              className="absolute bottom-0 right-0" // No background color
            >
              <Image
                source={icons.image} // Use the image icon from your icons object
                style={{ width: 30, height: 30 }} // Larger icon size
                className="rounded-full" // Optional: Add rounded corners
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Details */}
        <View className="flex flex-col items-start justify-center bg-white rounded-lg shadow-sm shadow-neutral-300 px-5 py-3">
          <View className="flex flex-col items-start justify-start w-full">
            {/* First Name */}
            <InputField
              label={language === 'ar' ? 'الاسم الأول' : 'First Name'}
              placeholder={user?.firstName || "Not Found"}
              containerStyle="w-full"
              inputStyle={`p-3.5 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              editable={false}
              labelStyle={language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}
              className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold' : 'text-left placeholder:text-left'}`}
            />

            {/* Last Name */}
            <InputField
              label={language === 'ar' ? 'الاسم الأخير' : 'Last Name'}
              placeholder={user?.lastName || "Not Found"}
              containerStyle="w-full"
              inputStyle={`p-3.5 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              editable={false}
              labelStyle={language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}
              className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold' : 'text-left placeholder:text-left'}`}
            />

            {/* Email */}
            <InputField
              label={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              placeholder={user?.primaryEmailAddress?.emailAddress || "Not Found"}
              containerStyle="w-full"
              inputStyle={`p-3.5 ${language === 'ar' ? 'text-right' : 'text-left'}`}
              editable={false}
              labelStyle={language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}
              className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold' : 'text-left placeholder:text-left'}`}
            />

            {/* Phone Number */}
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