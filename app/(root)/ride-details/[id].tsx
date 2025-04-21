import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import { icons } from '@/constants';
import RideMap from '@/components/RideMap';
import CustomButton from '@/components/CustomButton';
import { useAuth } from '@clerk/clerk-expo';
import { AirbnbRating } from 'react-native-ratings';

interface DriverData {
  car_seats?: number;
  car_type?: string;
  profile_image_url?: string;
  car_image_url?: string;
}

interface UserData {
  name?: string;
  driver?: DriverData;
}

interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  created_at: any;
  ride_datetime: string;
  driver_id?: string;
  status: string;
  available_seats: number;
  is_recurring: boolean;
  no_children: boolean;
  no_music: boolean;
  no_smoking: boolean;
  required_gender: string;
  ride_days?: string[];
  ride_number: number;
  driver?: {
    name: string;
    car_seats: number;
    profile_image_url?: string;
    car_type: string;
    car_image_url?: string;
  };
}

const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/40';
const DEFAULT_CAR_IMAGE = 'https://via.placeholder.com/120x80';

const RideDetails = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rideRequest, setRideRequest] = useState<any>(null);
  const { userId } = useAuth();
  const isDriver = ride?.driver_id === userId;
  const isPassenger = ride?.id && ride?.available_seats <= 0 || ride?.driver_id === userId;

  const fetchRideDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rideDocRef = doc(db, 'rides', id as string);
      const rideDocSnap = await getDoc(rideDocRef);

      if (!rideDocSnap.exists()) {
        setError('لم يتم العثور على الرحلة.');
        return;
      }

      const rideData = rideDocSnap.data();

      let driverInfo: UserData = { name: DEFAULT_DRIVER_NAME };

      if (rideData.driver_id) {
        const userDocRef = doc(db, 'users', rideData.driver_id);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          driverInfo = userDocSnap.data() as UserData;
        } else {
          console.warn(`User not found for driver_id: ${rideData.driver_id}`);
        }
      }

      let formattedDateTime = rideData.ride_datetime || 'وقت غير معروف';
      try {
        const date = new Date(rideData.ride_datetime);
        if (!isNaN(date.getTime())) {
          formattedDateTime = date.toLocaleString('ar-EG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
          });
        }
      } catch {
        console.warn('Invalid ride_datetime format');
      }

      const rideDetails: Ride = {
        id: rideDocSnap.id,
        origin_address: rideData.origin_address || 'غير معروف',
        destination_address: rideData.destination_address || 'غير معروف',
        origin_latitude: rideData.origin_latitude,
        origin_longitude: rideData.origin_longitude,
        destination_latitude: rideData.destination_latitude,
        destination_longitude: rideData.destination_longitude,
        created_at: rideData.created_at,
        ride_datetime: formattedDateTime,
        status: rideData.status || 'غير معروف',
        available_seats: rideData.available_seats || 0,
        is_recurring: rideData.is_recurring || false,
        no_children: rideData.no_children || false,
        no_music: rideData.no_music || false,
        no_smoking: rideData.no_smoking || false,
        required_gender: rideData.required_gender || 'أي',
        ride_days: rideData.ride_days || [],
        ride_number: rideData.ride_number || 0,
        driver_id: rideData.driver_id,
        driver: {
          name: driverInfo.name || DEFAULT_DRIVER_NAME,
          car_seats: driverInfo.driver?.car_seats || DEFAULT_CAR_SEATS,
          profile_image_url: driverInfo.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE,
          car_type: driverInfo.driver?.car_type || DEFAULT_CAR_TYPE,
          car_image_url: driverInfo.driver?.car_image_url || DEFAULT_CAR_IMAGE,
        },
      };

      setRide(rideDetails);
    } catch (err) {
      console.error('Error fetching ride details:', err);
      setError('فشل تحميل تفاصيل الرحلة. حاول مجددًا.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRideDetails();
  }, [fetchRideDetails]);

  useEffect(() => {
    if (!ride?.id || !userId) return;

    const q = query(
      collection(db, 'ride_requests'),
      where('ride_id', '==', ride.id),
      where('user_id', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setRideRequest(snapshot.docs[0].data());
      }
    });

    return () => unsubscribe();
  }, [ride?.id, userId]);

  const handleBookRide = async () => {
    try {
      if (!ride || !ride.id || !ride.driver_id) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      const requestRef = await addDoc(collection(db, 'ride_requests'), {
        ride_id: ride.id,
        user_id: userId,
        driver_id: ride.driver_id,
        status: 'waiting',
        created_at: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        user_id: ride.driver_id,
        title: 'طلب حجز جديد',
        message: 'لديك طلب حجز جديد للرحلة',
        type: 'new_booking',
        ride_id: ride.id,
        request_id: requestRef.id,
        created_at: serverTimestamp(),
        read: false
      });

      Alert.alert('✅ تم إرسال طلب الحجز بنجاح');
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('حدث خطأ أثناء إرسال طلب الحجز.');
    }
  };

  const handleCheckIn = async () => {
    try {
      if (!rideRequest) return;

      const requestRef = doc(db, 'ride_requests', rideRequest.id);
      await updateDoc(requestRef, {
        status: 'checked_in',
        check_in_time: serverTimestamp()
      });

      const rideRef = doc(db, 'rides', ride!.id);
      await updateDoc(rideRef, {
        available_seats: ride!.available_seats - 1
      });

      Alert.alert('✅ تم تسجيل الدخول بنجاح');
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الدخول.');
    }
  };

  const handleCheckOut = async () => {
    try {
      if (!rideRequest) return;

      const requestRef = doc(db, 'ride_requests', rideRequest.id);
      await updateDoc(requestRef, {
        status: 'completed',
        check_out_time: serverTimestamp()
      });

      setShowRatingModal(true);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };

  const handleCancelRide = async () => {
    try {
      if (!rideRequest) return;

      const requestRef = doc(db, 'ride_requests', rideRequest.id);
      await updateDoc(requestRef, {
        status: 'cancelled',
        cancelled_at: serverTimestamp()
      });

      const rideRef = doc(db, 'rides', ride!.id);
      await updateDoc(rideRef, {
        available_seats: ride!.available_seats + 1
      });

      Alert.alert('تم إلغاء الرحلة بنجاح');
    } catch (error) {
      console.error('Cancel error:', error);
      Alert.alert('حدث خطأ أثناء إلغاء الرحلة.');
    }
  };

  const handleRating = async (rating: number) => {
    try {
      if (!rideRequest) return;

      await addDoc(collection(db, 'ratings'), {
        ride_id: ride!.id,
        driver_id: ride!.driver_id,
        user_id: userId,
        rating: rating,
        created_at: serverTimestamp()
      });

      setShowRatingModal(false);
      Alert.alert('شكراً لتقييمك!');
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('حدث خطأ أثناء حفظ التقييم.');
    }
  };

  const renderActionButton = () => {
    if (!rideRequest) {
      return !isPassenger && <CustomButton title="احجز الرحلة" onPress={handleBookRide} />;
    }

    switch (rideRequest.status) {
      case 'waiting':
        return (
          <View>
            <Text className="text-orange-500 text-center mb-2">في انتظار موافقة السائق...</Text>
            <CustomButton title="إلغاء الطلب" onPress={handleCancelRide} type="secondary" />
          </View>
        );
      case 'accepted':
        return (
          <View className="space-y-2">
            <CustomButton title="تسجيل الدخول" onPress={handleCheckIn} />
            <CustomButton title="إلغاء الرحلة" onPress={handleCancelRide} type="secondary" />
          </View>
        );
      case 'checked_in':
        return <CustomButton title="تسجيل الخروج" onPress={handleCheckOut} />;
      case 'rejected':
        return (
          <View>
            <Text className="text-red-500 text-center mb-2">تم رفض طلبك</Text>
            <CustomButton title="احجز رحلة أخرى" onPress={() => router.back()} />
          </View>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (error || !ride) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <Text className="text-red-500 mb-4">{error || 'Ride not found.'}</Text>
        <TouchableOpacity onPress={fetchRideDetails} className="mb-2">
          <Text className="text-blue-500">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-2">
          <Text className="text-blue-500">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RideLayout
      title={
        <TouchableOpacity
          onPress={() => router.push(`/driver-profile/${ride.driver_id}`)}
          className="flex flex-row items-center space-x-2"
        >
          <Text className="text-xs text-red-600 font-CairoBold underline">
            (الملف الشخصي)
          </Text>
          <Text className="text-xl text-black-600 font-CairoBold">
            {ride.driver?.name}
          </Text>
        </TouchableOpacity>
      }
      snapPoints={["15%", "50%", "75%", "95%"]}
      origin={{ latitude: ride.origin_latitude, longitude: ride.origin_longitude }}
      destination={{ latitude: ride.destination_latitude, longitude: ride.destination_longitude }}
      MapComponent={RideMap}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Location Section */}
          <View className="mb-4">
            <Text className="text-base font-semibold text-black mb-2 text-right font-CairoBold">من</Text>
            <View className="flex-row items-center bg-gray-100 rounded-xl p-3 mb-4">
              <Image source={icons.point} className="w-7 h-7 ml-1.5" resizeMode='contain' />
              <Text className="flex-1 text-base text-gray-700 ml-2 text-right font-CairoBold">
                {ride.origin_address}
              </Text>
            </View>

            <Text className="text-base font-semibold text-black mb-2 text-right font-CairoBold">الى</Text>
            <View className="flex-row items-center bg-gray-100 rounded-xl p-3 mb-4">
              <Image source={icons.map} className="w-7 h-7 ml-1.5" resizeMode='contain' />
              <Text className="flex-1 text-base text-gray-700 ml-2 text-right font-CairoBold">
                {ride.destination_address}
              </Text>
            </View>
          </View>

          {/* Date and Time Section */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-200">
              <Text className="text-base text-gray-600 text-right font-CairoBold ">الوقت والتاريخ</Text>
              <View className="flex-column ">

                <Text className=" text-base text-red-700 font-medium text-right pb-2 font-CairoRegular">
                  {ride.ride_days}
                </Text>
                <Text className=" text-base text-gray-700 font-medium text-right font-CairoRegular">
                  {ride.ride_datetime}
                </Text>
              </View>
            </View>
          </View>

          {/* Driver Section */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-200">
              <Text className="text-base text-gray-600 text-right font-CairoBold">السائق</Text>
              <Text className="text-base text-gray-700 font-medium text-right font-CairoRegular">
                {ride.driver?.name || DEFAULT_DRIVER_NAME}
              </Text>
            </View>
          </View>

          {/* Available Seats Section */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-200">
              <Text className="text-base text-gray-600 text-right font-CairoBold">عدد المقاعد المتاحة</Text>
              <Text className="text-base text-red-600 font-medium text-right font-CairoBold">
                {ride.available_seats}
              </Text>
            </View>
          </View>

          {/* Car Section */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-200">
              <Text className="text-base text-gray-600 text-right font-CairoBold">السيارة</Text>
              <TouchableOpacity
                onPress={() => {
                  if (ride.driver?.car_image_url) {
                    setSelectedImage(ride.driver.car_image_url);
                    setShowImageModal(true);
                  }
                }}
              >
                <Image
                  source={{ uri: ride.driver?.car_image_url || DEFAULT_CAR_IMAGE }}
                  className="w-32 h-20 rounded-xl"
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Required Amount Section
          <View className="mb-4">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-200">
              <Text className="text-base text-gray-600 text-right">المبلغ المطلوب</Text>
              <Text className="text-sm text-orange-500 text-right">
                تواصل مع السائق لمعرفة التفاصيل
              </Text>
            </View>
          </View> */}

          {/* Gender Section */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center py-2 border-b border-gray-200">
              <Text className="text-base text-gray-600 text-right font-CairoBold ">الجنس المطلوب</Text>
              <Text className="text-base text-gray-700 font-medium text-right font-CairoRegular">
                {ride.required_gender === 'كلاهما' ? 'ذكر وأنثى' : ride.required_gender}
              </Text>
            </View>
          </View>

          {/* Ride Rules Section */}
          <View className="mb-4 w-full">
            <View className="flex-row justify-between border-b border-gray-200 py-2 w-full">
              <Text className="text-base text-gray-600 font-CairoBold text-left w-1/2">
                قوانين الرحلة
              </Text>

              <View className="flex-col items-end w-1/2">
                {[
                  ride.no_children && 'بدون أطفال',
                  ride.no_music && 'بدون موسيقى',
                  ride.no_smoking && 'بدون تدخين',
                ]
                  .filter(Boolean)
                  .map((rule, index) => (
                    <Text
                      key={index}
                      className="text-base text-gray-700 text-right font-CairoRegular"
                    >
                      {rule}
                    </Text>
                  ))}

                {![ride.no_children, ride.no_music, ride.no_smoking].some(Boolean) && (
                  <Text className="text-base text-gray-700 text-right font-CairoBold">
                    لا توجد قواعد خاصة
                  </Text>
                )}
              </View>
            </View>
          </View>

          {renderActionButton()}

          {/* Rating Modal */}
          <Modal
            visible={showRatingModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowRatingModal(false)}
          >
            <View className="flex-1 bg-black/70 justify-center items-center p-4">
              <View className="bg-white p-6 rounded-xl w-full max-w-sm">
                <Text className="text-xl text-center mb-4 font-CairoBold">قيّم السائق</Text>
                <AirbnbRating
                  count={5}
                  defaultRating={5}
                  size={30}
                  showRating={false}
                  onFinishRating={handleRating}
                />
                <View className="flex-row justify-center mt-4 space-x-2">
                  <CustomButton
                    title="تخطي"
                    onPress={() => setShowRatingModal(false)}
                    type="secondary"
                  />
                  <CustomButton
                    title="تقييم"
                    onPress={() => handleRating(5)}
                  />
                </View>
              </View>
            </View>
          </Modal>

          {/* Image Modal */}
          <Modal
            visible={showImageModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowImageModal(false)}
          >
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setShowImageModal(false)}
            >
              <Image
                source={{ uri: selectedImage ?? DEFAULT_CAR_IMAGE }}
                style={{ width: '90%', height: 200, resizeMode: 'contain', borderRadius: 10 }}
              />
              <Text className="text-white mt-4 font-CairoBold">اضغط في أي مكان للإغلاق</Text>
            </Pressable>
          </Modal>
        </View>
      </ScrollView>
    </RideLayout>
  );
};

export default RideDetails;