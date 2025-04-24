import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, query, where, Query, setDoc, getDocs } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import { icons } from '@/constants';
import RideMap from '@/components/RideMap';
import CustomButton from '@/components/CustomButton';
import { useAuth } from '@clerk/clerk-expo';
import { scheduleNotification, setupNotifications, cancelNotification, sendRideStatusNotification, sendRideRequestNotification } from '@/lib/notifications';
import { BottomSheet } from '@/components/BottomSheet';

interface DriverData {
  car_seats?: number;
  car_type?: string;
  profile_image_url?: string;
  car_image_url?: string;
  gender?: string;
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
  accepted_passengers?: { id: string; name: string }[];
  user_id?: string;
  passenger_name: string;
  driver?: {
    name: string;
    car_seats: number;
    profile_image_url?: string;
    car_type: string;
    car_image_url?: string;
    gender?: string;
  };
}

interface RideRequest {
  id: string;
  ride_id: string;
  user_id: string;
  status: 'waiting' | 'accepted' | 'rejected' | 'checked_in' | 'checked_out' | 'cancelled';
  created_at: any;
  rating?: number;
}

const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/40';
const DEFAULT_CAR_IMAGE = 'https://via.placeholder.com/120x80';

const RideDetails = () => {
  const [pendingRequests, setPendingRequests] = useState<RideRequest[]>([]);
  const [acceptedPassengers, setAcceptedPassengers] = useState<{ id: string; name: string }[]>([]);
  const router = useRouter();
  const { id, notificationId } = useLocalSearchParams();
  const [ride, setRide] = useState<Ride | null>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const { userId } = useAuth();
  const isDriver = ride?.driver_id === userId;
  const isPassenger = ride?.driver_id === userId || (ride?.available_seats ?? 0) <= 0;
  const bottomSheetRef = useRef<any>(null);

  // إعداد أذونات الإشعارات
  useEffect(() => {
    if (userId) {
      setupNotifications(userId);
    }
  }, [userId]);

  // جدولة الإشعار للراكب
  useEffect(() => {
    if (ride && ride.ride_datetime) {
      try {
        // Parse ride_datetime from DD/MM/YYYY HH:mm format (local time)
        const [datePart, timePart] = ride.ride_datetime.split(' ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
  
        // Create a Date object in local time
        const rideDate = new Date(year, month - 1, day, hours, minutes);
  
        // Validate the date
        if (isNaN(rideDate.getTime())) {
          console.warn('Invalid ride_datetime after parsing:', ride.ride_datetime);
          return;
        }
  
        // Calculate reminder time (15 minutes before)
        const reminderTime = new Date(rideDate.getTime() - 15 * 60 * 1000);
        const now = new Date();
  
        // Log times for debugging
        console.log('Current time:', now.toISOString());
        console.log('Ride time:', rideDate.toISOString());
        console.log('Reminder time:', reminderTime.toISOString());
  
        // Check if reminder time is in the future
        if (reminderTime > now) {
          scheduleNotification(
            'تذكير: رحلتك على وشك البدء!',
            `تستعد للانطلاق من ${ride.origin_address} إلى ${ride.destination_address}`,
            reminderTime,
            ride.id
          ).then((id) => {
            if (id) {
              console.log('Notification scheduled with ID:', id);
            } else {
              console.warn('Failed to schedule notification');
            }
          });
        } else {
          console.warn('Reminder time is in the past:', reminderTime.toISOString());
        }
      } catch (error) {
        console.error('Error scheduling notification:', error);
      }
    }
  
    return () => {
      if (notificationId && typeof notificationId === 'string') {
        cancelNotification(notificationId);
      }
    };
  }, [ride]);

  // Handle notification when page loads
  useEffect(() => {
    if (notificationId && typeof notificationId === 'string') {
      // Mark notification as read
      const markNotificationAsRead = async () => {
        try {
          const notificationRef = doc(db, 'notifications', notificationId);
          await updateDoc(notificationRef, { read: true });
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      };
      markNotificationAsRead();
    }
  }, [notificationId]);

  // جلب تفاصيل الرحلة
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
      console.log('Ride Data:', rideData);

      let driverInfo: UserData = { name: DEFAULT_DRIVER_NAME };
      let passengerName = 'Unknown Passenger';

      if (rideData.driver_id) {
        const userDocRef = doc(db, 'users', rideData.driver_id);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          driverInfo = userDocSnap.data() as UserData;
        }
      }

      // Get passenger name if available
      if (rideData.user_id) {
        const passengerDocRef = doc(db, 'users', rideData.user_id);
        const passengerDocSnap = await getDoc(passengerDocRef);
        if (passengerDocSnap.exists()) {
          passengerName = passengerDocSnap.data().name || 'Unknown Passenger';
        }
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
        ride_datetime: rideData.ride_datetime,
        status: rideData.status || 'غير معروف',
        available_seats: rideData.available_seats || 0,
        is_recurring: rideData.is_recurring || false,
        no_children: rideData.no_children || false,
        no_music: rideData.no_music || false,
        no_smoking: rideData.no_smoking || false,
        required_gender: rideData.required_gender || 'كلاهما',
        ride_days: rideData.ride_days || [],
        ride_number: rideData.ride_number || 0,
        driver_id: rideData.driver_id,
        user_id: rideData.user_id,
        passenger_name: passengerName,
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

  // مراقبة حالة طلب الحجز
  useEffect(() => {
    if (!userId || !id) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef,
      where('ride_id', '==', id),
      where('user_id', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setRideRequest({ id: doc.id, ...doc.data() } as RideRequest);
      } else {
        setRideRequest(null);
      }
    }, (error) => {
      console.error('Error fetching ride request:', error);
    });

    return () => unsubscribe();
  }, [id, userId]);

  useEffect(() => {
    fetchRideDetails();
  }, [fetchRideDetails]);

  // Fetch pending ride requests for driver
  useEffect(() => {
    if (!ride?.id || !isDriver) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, 
      where('ride_id', '==', ride.id),
      where('status', '==', 'waiting')
    );
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const requests: RideRequest[] = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setPendingRequests(requests);
      },
      (error) => {
        console.error('Error fetching ride requests:', error);
      }
    );

    return () => unsubscribe();
  }, [ride?.id, isDriver]);

  // Fetch accepted passengers
  useEffect(() => {
    if (!id) return;

    const fetchAcceptedPassengers = async () => {
      try {
        const rideRequestsRef = collection(db, 'ride_requests');
        const q = query(rideRequestsRef,
          where('ride_id', '==', id),
          where('status', '==', 'accepted')
        );

        const querySnapshot = await getDocs(q);
        const passengers: { id: string; name: string }[] = [];

        for (const docSnap of querySnapshot.docs) {
          const requestData = docSnap.data();
          const userDocRef = doc(db, 'users', requestData.user_id);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as { name?: string };
            passengers.push({
              id: requestData.user_id,
              name: userData.name || 'Unknown Passenger'
            });
          }
        }

        setAcceptedPassengers(passengers);
      } catch (error) {
        console.error('Error fetching accepted passengers:', error);
      }
    };

    fetchAcceptedPassengers();
  }, [id]);

  // Handle driver accepting ride request
  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'accepted',
        updated_at: serverTimestamp(),
      });

      // Send notification to user
      await sendRideStatusNotification(
        userId,
        'تم قبول طلب الحجز!',
        `تم قبول طلب حجزك للرحلة من ${ride?.origin_address} إلى ${ride?.destination_address}`,
        ride?.id || ''
      );

      // Update notification status
      if (notificationId && typeof notificationId === 'string') {
        const updateData = {
          read: true,
          data: {
            status: 'accepted',
            rideId: ride?.id || ''
          }
        };
        await updateDoc(doc(db, 'notifications', notificationId), updateData);
      }

      Alert.alert('✅ تم قبول طلب الحجز بنجاح');
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('حدث خطأ أثناء قبول الطلب.');
    }
  };

  // Handle driver rejecting ride request
  const handleRejectRequest = async (requestId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'rejected',
        updated_at: serverTimestamp(),
      });

      // Send notification to user
      await sendRideStatusNotification(
        userId,
        'تم رفض طلب الحجز',
        `عذراً، تم رفض طلب حجزك للرحلة من ${ride?.origin_address} إلى ${ride?.destination_address}`,
        ride?.id || ''
      );

      // Update notification status
      if (notificationId && typeof notificationId === 'string') {
        const updateData = {
          read: true,
          data: {
            status: 'rejected',
            rideId: ride?.id || ''
          }
        };
        await updateDoc(doc(db, 'notifications', notificationId), updateData);
      }

      Alert.alert('✅ تم رفض طلب الحجز');
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('حدث خطأ أثناء رفض الطلب.');
    }
  };

  // User booking the ride
  const handleBookRide = async () => {
    try {
      if (!ride || !ride.id || !ride.driver_id || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      // Get user's name for the notification
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userName = userDoc.data()?.name || 'A passenger';

      // Create the ride request document
      const rideRequestRef = await addDoc(collection(db, 'ride_requests'), {
        ride_id: ride.id,
        user_id: userId,
        driver_id: ride.driver_id,
        status: 'waiting',
        created_at: serverTimestamp(),
      });

      // Send push notification to driver
      await sendRideRequestNotification(
        ride.driver_id,
        userName,
        ride.origin_address,
        ride.destination_address,
        ride.id
      );

      Alert.alert('✅ تم إرسال طلب الحجز بنجاح');
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('حدث خطأ أثناء إرسال طلب الحجز.');
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    try {
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_in',
        updated_at: serverTimestamp(),
      });

      // Update available seats
      await updateDoc(doc(db, 'rides', ride.id), {
        available_seats: ride.available_seats - 1,
      });

      // Send notification to driver
      await sendRideStatusNotification(
        ride.driver_id!,
        'تم تسجيل الدخول!',
        'قام الراكب بتسجيل الدخول للرحلة',
        ride.id
      );

      Alert.alert('✅ تم تسجيل دخولك للرحلة');
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الدخول.');
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    try {
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_out',
        updated_at: serverTimestamp(),
      });

      // Send notification to driver
      await sendRideStatusNotification(
        ride.driver_id!,
        'تم تسجيل الخروج!',
        'قام الراكب بتسجيل الخروج من الرحلة',
        ride.id
      );

      // Show rating modal
      setShowRatingModal(true);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };

  // Handle rating submission
  const handleRateDriver = async () => {
    try {
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        rating: rating,
        updated_at: serverTimestamp(),
      });

      // Send notification to driver
      if (ride.driver_id) {
        await sendRideStatusNotification(
          ride.driver_id,
          'تقييم جديد!',
          `قام الراكب بتقييم رحلتك بـ ${rating} نجوم`,
          ride.id
        );
      }

      setShowRatingModal(false);
      Alert.alert('✅ شكراً على تقييمك!');
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('حدث خطأ أثناء إرسال التقييم.');
    }
  };

  // Handle ride cancellation
  const handleCancelRide = async () => {
    try {
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });

      // Send notification to driver
      if (ride.driver_id) {
        await sendRideStatusNotification(
          ride.driver_id,
          'تم إلغاء الحجز',
          'قام الراكب بإلغاء حجز الرحلة',
          ride.id
        );
      }

      Alert.alert('✅ تم إلغاء الحجز بنجاح');
    } catch (error) {
      console.error('Cancellation error:', error);
      Alert.alert('حدث خطأ أثناء إلغاء الحجز.');
    }
  };

  // Function to handle target icon press
  const handleTargetPress = () => {
    // Collapse the bottom sheet to show only the map
    bottomSheetRef.current?.snapToIndex(0);
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
      title=" "
      snapPoints={["15%", "50%", "75%", "95%"]}
      origin={{ latitude: ride.origin_latitude, longitude: ride.origin_longitude }}
      destination={{ latitude: ride.destination_latitude, longitude: ride.destination_longitude }}
      MapComponent={(props) => <RideMap {...props} onTargetPress={handleTargetPress} />}
      bottomSheetRef={bottomSheetRef}
    >
      <ScrollView className="flex-1 bg-gray-100" showsVerticalScrollIndicator={false}>
        {/* Main Card */}
        <View className="m-4 bg-white rounded-2xl shadow-lg">
          {/* Location Section */}
          <View className="p-4">
            {/* From */}
            <View className="flex-row items-center space-x-3">
              <Image source={icons.point} className="w-6 h-6" resizeMode="contain" />
              <View>
                <Text className="text-gray-500 text-sm font-CairoRegular">From</Text>
                <Text className="text-black font-CairoBold">{ride.origin_address}</Text>
              </View>
            </View>

            {/* To */}
            <View className="flex-row items-center space-x-3 mt-4">
              <Image source={icons.map} className="w-6 h-6" resizeMode="contain" />
              <View>
                <Text className="text-gray-500 text-sm font-CairoRegular">To</Text>
                <Text className="text-black font-CairoBold">{ride.destination_address}</Text>
              </View>
            </View>
          </View>

          {/* Orange Divider */}
          <View className="mx-4">
            <View className="h-0.5 bg-orange-500 opacity-20" />
          </View>

          {/* Date & Time and Seats Section */}
          <View className="p-4">
            <View className="flex-row justify-between">
              <View>
                <Text className="text-gray-500 text-sm font-CairoRegular">Date & Time</Text>
                <Text className="text-black font-CairoBold">{ride.ride_datetime}</Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-500 text-sm font-CairoRegular">Available Seats</Text>
                <Text className="text-black font-CairoBold">{ride.available_seats} seats</Text>
              </View>
            </View>
          </View>

          {/* Orange Divider */}
          <View className="mx-4">
            <View className="h-0.5 bg-orange-500 opacity-20" />
          </View>

          {/* Vehicle Section */}
          <View className="p-4">
            <Text className="text-gray-500 text-sm font-CairoRegular mb-1">Vehicle</Text>
            <Text className="text-black font-CairoBold mb-3">{ride.driver?.car_type || 'Tesla Model 3'}</Text>
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
                className="w-full h-48 rounded-xl"
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>

          {/* Orange Divider */}
          <View className="mx-4">
            <View className="h-0.5 bg-orange-500 opacity-20" />
          </View>

          {/* Preferences & Rules Section */}
          <View className="p-4">
            <Text className="text-gray-500 text-sm font-CairoRegular mb-2">Preferences</Text>
            <View className="space-y-2">
              {/* Driver Gender */}
              <Text className="text-black font-CairoRegular">
                {ride?.required_gender === 'ذكر' ? 'Male' : 
                 ride?.required_gender === 'أنثى' ? 'Female' : 
                 'Male and Female'}
              </Text>

              {/* Accepted Passengers */}
              {acceptedPassengers.length > 0 && (
                <View>
                  <Text className="text-black font-CairoRegular mb-1">Passengers:</Text>
                  {acceptedPassengers.map((passenger) => (
                    <Text key={passenger.id} className="text-black font-CairoRegular ml-2">
                      • {passenger.name}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Orange Divider */}
            <View className="mx-4 my-4">
              <View className="h-0.5 bg-orange-500 opacity-20" />
            </View>

            {/* Rules Section */}
            <Text className="text-gray-500 text-sm font-CairoRegular mb-2">Rules</Text>
            <View className="space-y-1">
              {ride.no_smoking && (
                <Text className="text-black font-CairoRegular">• No smoking</Text>
              )}
              {ride.no_children && (
                <Text className="text-black font-CairoRegular">• Small bags only</Text>
              )}
              {ride.no_music && (
                <Text className="text-black font-CairoRegular">• Pets allowed with carrier</Text>
              )}
            </View>
          </View>

          {/* Orange Divider */}
          <View className="mx-4">
            <View className="h-0.5 bg-orange-500 opacity-20" />
          </View>

          {/* Driver Profile Section - Very Soft Orange Background */}
          <View className="bg-orange-50 p-4 rounded-b-2xl">
            <TouchableOpacity
              onPress={() => router.push(`/driver-profile/${ride.driver_id}`)}
              className="flex-row items-center space-x-3"
            >
              <Image
                source={{ uri: ride.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE }}
                className="w-12 h-12 rounded-full border-2 border-orange-100"
              />
              <View>
                <Text className="text-lg font-CairoBold text-orange-600">{ride.driver?.name}</Text>
                <Text className="text-orange-500 font-CairoRegular">View Profile</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Button - Outside the card */}
        <View className="px-4 pb-4">
          {isDriver ? (
            <Text className="text-red-500 text-center font-CairoBold">
              You cannot book your own ride.
            </Text>
          ) : !rideRequest ? (
            <TouchableOpacity
              onPress={handleBookRide}
              className="bg-orange-500 py-4 rounded-xl"
            >
              <Text className="text-white text-center font-CairoBold">Book This Ride</Text>
            </TouchableOpacity>
          ) : rideRequest.status === 'waiting' ? (
            <View className="flex-row justify-between mt-4">
              <CustomButton
                title="إلغاء الطلب"
                onPress={handleCancelRide}
                className="bg-red-500"
              />
              <Text className="text-gray-600">في انتظار موافقة السائق...</Text>
            </View>
          ) : rideRequest.status === 'accepted' ? (
            <View className="flex-row justify-between mt-4">
              <CustomButton
                title="تسجيل الدخول"
                onPress={handleCheckIn}
                className="flex-1 mr-2 bg-green-500"
              />
              <CustomButton
                title="إلغاء الحجز"
                onPress={handleCancelRide}
                className="flex-1 ml-2 bg-red-500"
              />
            </View>
          ) : rideRequest.status === 'checked_in' ? (
            <View className="flex-row justify-between mt-4">
              <CustomButton
                title="تسجيل الخروج"
                onPress={handleCheckOut}
                className="flex-1 mr-2 bg-blue-500"
              />
              <CustomButton
                title="إلغاء الحجز"
                onPress={handleCancelRide}
                className="flex-1 ml-2 bg-red-500"
              />
            </View>
          ) : rideRequest.status === 'rejected' ? (
            <Text className="text-red-500 text-center mt-4 font-CairoBold">
              تم رفض طلب الحجز.
            </Text>
          ) : rideRequest.status === 'checked_out' ? (
            <Text className="text-green-500 text-center mt-4 font-CairoBold">
              تم تسجيل خروجك من الرحلة!
            </Text>
          ) : rideRequest.status === 'cancelled' ? (
            <Text className="text-red-500 text-center mt-4 font-CairoBold">
              تم إلغاء الحجز.
            </Text>
          ) : isDriver && pendingRequests.length > 0 ? (
            <View className="space-y-4">
              <Text className="text-lg text-center font-CairoBold mb-2">طلبات الحجز المعلقة</Text>
              {pendingRequests.map((request) => (
                <View key={request.id} className="flex-row justify-between items-center bg-gray-100 p-4 rounded-xl">
                  <View className="flex-row space-x-2">
                    <CustomButton
                      title="قبول"
                      onPress={() => handleAcceptRequest(request.id, request.user_id)}
                      className="bg-green-500 px-4"
                    />
                    <CustomButton
                      title="رفض"
                      onPress={() => handleRejectRequest(request.id, request.user_id)}
                      className="bg-red-500 px-4"
                    />
                  </View>
                  <Text className="font-CairoBold">طلب حجز جديد</Text>
                </View>
              ))}
            </View>
          ) : (
            <CustomButton title="احجز الرحلة" onPress={handleBookRide} />
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View className="bg-white p-6 rounded-xl w-[90%]">
            <Text className="text-xl font-CairoBold mb-4 text-center">قيّم رحلتك</Text>
            <View className="flex-row justify-center space-x-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                >
                  <Text style={{ fontSize: 40 }}>
                    {star <= rating ? '⭐' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row justify-between">
              <CustomButton
                title="إرسال"
                onPress={handleRateDriver}
                className="flex-1 mr-2 bg-green-500"
              />
              <CustomButton
                title="إلغاء"
                onPress={() => setShowRatingModal(false)}
                className="flex-1 ml-2 bg-gray-500"
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
    </RideLayout>
  );
};

export default RideDetails;