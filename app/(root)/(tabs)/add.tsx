import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "@/lib/upload";
import { useRouter } from "expo-router";
import CustomButton from "@/components/CustomButton";
import { icons, images } from "@/constants";
import { useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import InputField from "@/components/InputField";
import { db } from "@/lib/firebase";
import { doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { ActivityIndicator } from "react-native";

interface DriverFormData {
  carType: string;
  carSeats: string;
  carImage: string | null;
  profileImage: string | null;
}

interface FirebaseDriverData {
  car_type: string;
  car_image_url: string;
  profile_image_url: string;
  car_seats: number;
  created_at: string;
  is_active: boolean;
}

const Add = () => {
  const { user } = useUser();
  const router = useRouter();
  const [driverFormData, setDriverFormData] = useState<DriverFormData>({
    carType: "",
    carSeats: "",
    carImage: null,
    profileImage: null,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDriverChecked, setIsDriverChecked] = useState(false);

  const checkDriverStatus = useCallback(async () => {
    try {
      if (!user?.id) {
        console.log("No user ID available");
        return;
      }

      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.driver?.is_active) {
          // If already a driver, redirect to locationInfo
          router.replace({
            pathname: "/(root)/locationInfo",
            params: { driverId: user.id }
          });
          return;
        }
      }
      
      // If not a driver, redirect to home
      router.replace("/(root)/(tabs)/home");
      
    } catch (error: any) {
      console.error("Error checking driver status:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء التحقق من حالة السائق");
      router.replace("/(root)/(tabs)/home");
    } finally {
      setIsDriverChecked(true);
    }
  }, [user, router]);

  useEffect(() => {
    let isMounted = true;
    
    if (isMounted) {
      checkDriverStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [checkDriverStatus]);

  // تحسين اختيار الصور مع تحقق إضافي
  const pickImage = useCallback(async (type: "car" | "profile") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) return;

      // تحقق إضافي من نوع الملف
      const fileExtension = asset.uri.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
        Alert.alert("خطأ", "يجب اختيار صورة بصيغة JPG أو PNG");
        return;
      }

      if ((asset.fileSize || 0) > 5 * 1024 * 1024) {
        Alert.alert("خطأ", "حجم الصورة يجب أن يكون أقل من 5MB");
        return;
      }

      setDriverFormData(prev => ({
        ...prev,
        [type === "car" ? "carImage" : "profileImage"]: asset.uri,
      }));
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء اختيار الصورة");
    }
  }, []);

  // تحسين تسجيل السائق مع إدارة أفضل للطلبات
  const handleRegister = useCallback(async () => {
    setIsLoading(true);

    try {
      const { carType, carSeats, carImage, profileImage } = driverFormData;
      
      // تحقق شامل من البيانات
      if (!carType.trim() || !carSeats || !carImage || !profileImage) {
        throw new Error("يجب تعبئة جميع الحقول المطلوبة");
      }

      if (isNaN(Number(carSeats)) || Number(carSeats) < 1 || Number(carSeats) > 10) {
        throw new Error("عدد المقاعد يجب أن يكون بين 1 و 10");
      }

      const [carImageUrl, profileImageUrl] = await Promise.all([
        uploadImageToCloudinary(carImage),
        uploadImageToCloudinary(profileImage),
      ]);

      if (!carImageUrl || !profileImageUrl) {
        throw new Error("فشل في تحميل الصور، يرجى المحاولة لاحقًا");
      }

      // Create driver data object
      const driverData = {
        car_type: carType.trim(),
        car_image_url: carImageUrl,
        profile_image_url: profileImageUrl,
        car_seats: Number(carSeats),
        created_at: new Date().toISOString(),
        is_active: true
      };

      // Get user reference using Clerk ID
      const userRef = doc(db, "users", user?.id!);
      
      // Check if user document exists
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        // Update the existing user document with driver data
        await updateDoc(userRef, {
          driver: driverData
        });
      } else {
        // Create a new user document with driver data
        await setDoc(userRef, {
          userId: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          firstName: user?.firstName,
          lastName: user?.lastName,
          createdAt: new Date().toISOString(),
          driver: driverData
        });
      }

      // Save to AsyncStorage for local access
      await AsyncStorage.setItem('driverData', JSON.stringify(driverData));

      Alert.alert("نجاح", "تم تسجيلك كسائق بنجاح", [
        { text: "حسناً", onPress: () => router.push({
          pathname: "/(root)/locationInfo",
          params: { driverId: user?.id }
        })}
      ]);
    } catch (error: any) {
      console.error("Registration error:", error);
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء التسجيل");
    } finally {
      setIsLoading(false);
    }
  }, [driverFormData, user, router]);

  if (!isDriverChecked) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-4">
        <Image
          source={images.loadingcar} // تأكد إنك تضيف صورة gif مناسبة داخل مجلد الصور
          className="w-40 h-40 mb-6"
          resizeMode="contain"
        />
        <Text className="text-xl font-CairoBold text-orange-500 mb-2">
          جاري التحقق من بياناتك...
        </Text>
        <Text className="text-base text-gray-500 text-center">
          برجاء الانتظار قليلاً أثناء التحقق من حالة حسابك كسائق
        </Text>
        <ActivityIndicator size="large" color="#F97316" className="mt-6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 p-6 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-center text-black mb-6">تسجيل كسائق</Text>
      
        <InputField 
          label="نوع السيارة"
          value={driverFormData.carType}
          onChangeText={(text) => setDriverFormData(prev => ({ ...prev, carType: text }))}
          placeholder="مثال: تويوتا كورولا"
          className="border border-orange-500  placeholder:font-CairoBold"
          labelStyle="text-lg text-right text-gray-700 mb-4 font-CairoBold"
          maxLength={30}
        />
        
        <InputField 
          label="عدد المقاعد"
          value={driverFormData.carSeats}
          onChangeText={(text) => setDriverFormData(prev => ({ ...prev, carSeats: text }))}
          placeholder="مثال: 4"
          keyboardType="number-pad"
          className="border border-orange-500 placeholder:font-CairoBold"
          labelStyle="text-lg text-right text-gray-700 mb-4 font-CairoBold"
          maxLength={2}
        />  
        
        <Text className="text-lg text-right text-gray-700 mb-4 font-CairoBold">صورة السيارة</Text>
        <View className="mb-6 items-center">
          <TouchableOpacity
            onPress={() => pickImage("car")}
            className="w-full h-48 bg-gray-100 rounded-lg border-dashed border-2 border-gray-300 justify-center items-center"
            >
            {driverFormData.carImage ? (
              <Image 
                source={{ uri: driverFormData.carImage }} 
                className="w-full h-full rounded-lg" 
                resizeMode="cover" 
                onError={() => setDriverFormData(prev => ({ ...prev, carImage: null }))}
              />
            ) : (
              <>
                <Image source={icons.upload} className="w-12 h-12 mb-2" />
                <Text className="text-gray-500">اضغط لاختيار صورة للسيارة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        <Text className="text-lg text-right text-gray-700 mb-4 font-CairoBold">صورة البروفايل</Text>
        <View className="mb-6 items-center">
          <TouchableOpacity
            onPress={() => pickImage("profile")}
            className="w-full h-48 bg-gray-100 rounded-lg border-dashed border-2 border-gray-300 justify-center items-center"
            >
            {driverFormData.profileImage ? (
              <Image 
                source={{ uri: driverFormData.profileImage }} 
                className="w-full h-full rounded-lg" 
                resizeMode="cover" 
                onError={() => setDriverFormData(prev => ({ ...prev, profileImage: null }))}
              />
            ) : (
              <>
                <Image source={icons.upload} className="w-12 h-12 mb-2" />
                <Text className="text-gray-500">اضغط لاختيار صورة للبروفايل</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View className="pb-20 items-center">
          <CustomButton 
            title={isLoading ? "جاري التسجيل..." : "التسجيل كـ سائق"}
            onPress={handleRegister}
            disabled={isLoading}
            className="w-full"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Add;