import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, query, where, Query, setDoc, getDocs, Timestamp } from 'firebase/firestore';
import { format, parse } from 'date-fns';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import { icons } from '@/constants';
import RideMap from '@/components/RideMap';
import CustomButton from '@/components/CustomButton';
import { useAuth } from '@clerk/clerk-expo';
import { scheduleNotification, setupNotifications, cancelNotification, sendRideStatusNotification, sendRideRequestNotification, startRideNotificationService, schedulePassengerRideReminder, sendCheckOutNotificationForDriver, sendRideCancellationNotification, scheduleDriverRideReminder, scheduleRideNotification } from '@/lib/notifications';
import BottomSheet from '@gorhom/bottom-sheet';

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
  notification_id?: string;
}

const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/40';
const DEFAULT_CAR_IMAGE = 'https://via.placeholder.com/120x80';
const DATE_FORMAT = 'dd/MM/yyyy HH:mm';

const RideDetails = () => {
  const [pendingRequests, setPendingRequests] = useState<RideRequest[]>([]);
  const [allPassengers, setAllPassengers] = useState<RideRequest[]>([]);
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>({});
  const [passengerGenders, setPassengerGenders] = useState<Record<string, string>>({});
  const router = useRouter();
  const { id, notificationId, scrollToRequests } = useLocalSearchParams();
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
  const isPassenger = rideRequest && rideRequest.status === 'accepted';
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Setup notifications
  useEffect(() => {
    if (userId) {
      setupNotifications(userId);
      startRideNotificationService(userId, true);
    }
  }, [userId]);

  // Handle notification when page loads
  useEffect(() => {
    if (notificationId && typeof notificationId === 'string') {
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

  // Fetch ride details
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

      let formattedDateTime = rideData.ride_datetime;
      if (rideData.ride_datetime instanceof Timestamp) {
        formattedDateTime = format(rideData.ride_datetime.toDate(), DATE_FORMAT);
      } else {
        try {
          const parsedDate = parse(rideData.ride_datetime, DATE_FORMAT, new Date());
          if (!isNaN(parsedDate.getTime())) {
            formattedDateTime = format(parsedDate, DATE_FORMAT);
          }
        } catch {
          console.warn('Invalid ride_datetime format');
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
        ride_datetime: formattedDateTime,
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
          gender: driverInfo.driver?.gender || 'غير محدد',
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

  // Fetch all passengers for the ride
  useEffect(() => {
    if (!ride?.id) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, 
      where('ride_id', '==', ride.id),
      where('status', 'in', ['accepted', 'checked_in', 'checked_out'])
    );
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const passengers: RideRequest[] = [];
        snapshot.forEach((doc) => {
          passengers.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setAllPassengers(passengers);
      },
      (error) => {
        console.error('Error fetching passengers:', error);
      }
    );

    return () => unsubscribe();
  }, [ride?.id]);

  // Fetch passenger names and genders when passengers change
  useEffect(() => {
    const fetchPassengerDetails = async () => {
      const names: Record<string, string> = {};
      const genders: Record<string, string> = {};
      for (const passenger of allPassengers) {
        try {
          const userDoc = await getDoc(doc(db, 'users', passenger.user_id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            names[passenger.user_id] = userData?.name || 'الراكب';
            genders[passenger.user_id] = userData?.gender || 'غير محدد';
          }
        } catch (error) {
          console.error('Error fetching passenger details:', error);
          names[passenger.user_id] = 'الراكب';
          genders[passenger.user_id] = 'غير محدد';
        }
      }
      setPassengerNames(names);
      setPassengerGenders(genders);
    };

    if (allPassengers.length > 0) {
      fetchPassengerDetails();
    }
  }, [allPassengers]);

  // Handle driver accepting ride request
  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      // Get passenger's name
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      if (!ride) {
        throw new Error('بيانات الرحلة غير متوفرة');
      }

      if (!ride.driver_id) {
        throw new Error('معرف السائق غير موجود');
      }

      // Schedule notification for passenger
      const passengerNotificationId = await scheduleRideNotification(ride.id, userId, false);

      // Schedule notification for driver
      const driverNotificationId = await scheduleRideNotification(ride.id, ride.driver_id, true);

      // Update ride request status to "accepted"
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'accepted',
        updated_at: serverTimestamp(),
        passenger_name: passengerName,
        passenger_id: userId,
        notification_id: passengerNotificationId || null,
      });

      // Send instant notification to passenger
      await sendRideStatusNotification(
        userId,
        'تم قبول طلب الحجز!',
        `تم قبول طلب حجزك للرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
        ride.id
      );

      // Update previous notifications related to the request
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', userId),
        where('data.rideId', '==', ride.id),
        where('type', '==', 'ride_request')
      );

      const querySnapshot = await getDocs(q);
      for (const doc of querySnapshot.docs) {
        await updateDoc(doc.ref, {
          read: true,
          data: {
            status: 'accepted',
            rideId: ride.id,
            type: 'ride_status',
            passenger_name: passengerName,
          },
        });
      }

      Alert.alert('✅ تم قبول طلب الحجز بنجاح', `تم قبول طلب ${passengerName}`);
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('حدث خطأ أثناء قبول الطلب.');
    }
  };

  // Handle driver rejecting ride request
  const handleRejectRequest = async (requestId: string, userId: string) => {
    try {
      // Get passenger's name
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      // Update ride request status
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

      // Find and update all related notifications
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', userId),
        where('data.rideId', '==', ride?.id),
        where('type', '==', 'ride_request')
      );

      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, {
          read: true,
          data: {
            status: 'rejected',
            rideId: ride?.id,
            type: 'ride_status',
            passenger_name: passengerName
          }
        });
      });

      Alert.alert('✅ تم رفض طلب الحجز', `تم رفض طلب ${passengerName}`);
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('حدث خطأ أثناء رفض الطلب.');
    }
  };

  const handleBookRide = async () => {
    try {
      if (!ride || !ride.id || !ride.driver_id || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      // Get user's data (name and gender)
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      const userName = userData?.name || 'الراكب';
      const userGender = userData?.gender || 'غير محدد';

      // Check if the user's gender matches the ride's required gender
      if (ride.required_gender !== 'كلاهما') {
        if (ride.required_gender === 'ذكر' && userGender !== 'Male') {
          Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الذكور فقط.');
          return;
        }
        if (ride.required_gender === 'أنثى' && userGender !== 'Female') {
          Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الإناث فقط.');
          return;
        }
      }

      // Create the ride request document
      const rideRequestRef = await addDoc(collection(db, 'ride_requests'), {
        ride_id: ride.id,
        user_id: userId,
        driver_id: ride.driver_id,
        status: 'waiting',
        created_at: serverTimestamp(),
        passenger_name: userName,
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
      if (!rideRequest || !ride || !userId) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_in',
        updated_at: serverTimestamp(),
      });

      // Update available seats
      await updateDoc(doc(db, 'rides', ride.id), {
        available_seats: ride.available_seats - 1,
      });

      // Send notification to the driver that passenger has checked in
      await sendRideStatusNotification(
        ride?.driver_id || '',
        'الراكب وصل',
        `الراكب قد وصل وبدأ الرحلة من ${ride?.origin_address} إلى ${ride?.destination_address}`,
        ride?.id || ''
      );
    } catch (error) {
      console.error('Error during check-in:', error);
    }
  };

  const handleCheckOut = async () => {
    try {
      if (!rideRequest || !ride || !userId) {
        console.error('Missing required data: rideRequest, ride, or userId');
        return;
      }

      // Cancel scheduled notification if exists
      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }

      // Update ride request status to checked_out
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_out',
        updated_at: serverTimestamp(),
      });

      // Send notification to driver
      const notificationSent = await sendCheckOutNotificationForDriver(
        ride.driver_id || '',
        passengerNames[userId] || 'الراكب',
        ride.id
      );

      if (!notificationSent) {
        console.warn('Failed to send check-out notification to driver');
      }

      // Show rating modal
      setShowRatingModal(true);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };

  // Handle ride cancellation
  const handleCancelRide = async () => {
    try {
      if (!rideRequest || !ride || !userId) {
        console.error('Missing required data: rideRequest, ride, or userId');
        return;
      }

      // Cancel scheduled notification if exists
      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }

      // Update ride request status to cancelled
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });

      // Update available seats if request was accepted or checked in
      if (rideRequest.status === 'accepted' || rideRequest.status === 'checked_in') {
        await updateDoc(doc(db, 'rides', ride.id), {
          available_seats: ride.available_seats + 1,
        });
        console.log(`Increased available_seats for ride ${ride.id}`);
      }

      // Send notification to driver
      if (ride.driver_id) {
        const passengerName = passengerNames[userId] || 'الراكب';
        const notificationSent = await sendRideStatusNotification(
          ride.driver_id,
          'تم إلغاء الحجز',
          `قام ${passengerName} بإلغاء حجز الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
          ride.id
        );
        if (!notificationSent) {
          console.warn('Failed to send cancellation notification to driver');
        }
      }

      Alert.alert('✅ تم إلغاء الحجز بنجاح');
    } catch (error) {
      console.error('Cancellation error:', error);
      Alert.alert('حدث خطأ أثناء إلغاء الحجز.');
    }
  };

  // Handle rating submission
  const handleRateDriver = async () => {
    try {
      if (!rideRequest || !ride) return;

      // Update the ride request with the rating
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        rating: rating,
        updated_at: serverTimestamp(),
      });

      // Send notification to the driver
      if (ride.driver_id) {
        await sendRideStatusNotification(
          ride.driver_id,
          'تقييم جديد!',
          `قام الراكب بتقييم رحلتك بـ ${rating} نجوم`,
          ride.id
        );
      }

      // Close the rating modal and show success alert
      setShowRatingModal(false);
      Alert.alert('✅ شكراً على تقييمك!');
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('حدث خطأ أثناء إرسال التقييم.');
    }
  };

  // Function to handle target icon press
  const handleTargetPress = () => {
    if (!ride) return;
    
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
              {allPassengers.length > 0 && (
                <View>
                  <Text className="text-black font-CairoRegular mb-1">Passengers:</Text>
                  {allPassengers.map((passenger) => (
                    <Text key={passenger.id} className="text-black font-CairoRegular ml-2">
                      • {passengerNames[passenger.user_id] || 'Passenger'}
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
            pendingRequests.length > 0 ? (
              <View className="space-y-4">
                <Text className="text-lg text-center font-CairoBold mb-2">Pending Booking Requests</Text>
                {pendingRequests.map((request) => (
                  <View key={request.id} className="flex-row justify-between items-center bg-gray-100 p-4 rounded-xl">
                    <View className="flex-row space-x-2">
                      <CustomButton
                        title="Accept"
                        onPress={() => handleAcceptRequest(request.id, request.user_id)}
                        className="bg-green-500 px-4"
                      />
                      <CustomButton
                        title="Reject"
                        onPress={() => handleRejectRequest(request.id, request.user_id)}
                        className="bg-red-500 px-4"
                      />
                    </View>
                    <Text className="font-CairoBold">New booking request</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-red-500 text-center">
                You cannot book your own ride.
              </Text>
            )
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
                title="Cancel Request"
                onPress={handleCancelRide}
                className="bg-red-500"
              />
              <Text className="text-gray-600">Waiting for driver approval...</Text>
            </View>
          ) : rideRequest.status === 'accepted' ? (
            <View className="flex-row justify-between mt-4">
              <CustomButton
                title="Check In"
                onPress={handleCheckIn}
                className="flex-1 mr-2 bg-green-500"
              />
              <CustomButton
                title="Cancel Ride"
                onPress={handleCancelRide}
                className="flex-1 ml-2 bg-red-500"
              />
            </View>
          ) : rideRequest.status === 'checked_in' ? (
            <View className="flex-row justify-between mt-4">
              <CustomButton
                title="Check Out"
                onPress={handleCheckOut}
                className="flex-1 mr-2 bg-blue-500"
              />
              <CustomButton
                title="Cancel Ride"
                onPress={handleCancelRide}
                className="flex-1 ml-2 bg-red-500"
              />
            </View>
          ) : rideRequest.status === 'rejected' ? (
            <Text className="text-red-500 text-center mt-4 font-CairoBold">
              Booking request was rejected.
            </Text>
          ) : rideRequest.status === 'checked_out' ? (
            <Text className="text-green-500 text-center mt-4 font-CairoBold">
              You have checked out of the ride!
            </Text>
          ) : rideRequest.status === 'cancelled' ? (
            <Text className="text-red-500 text-center mt-4 font-CairoBold">
              Ride was cancelled.
            </Text>
          ) : (
            <CustomButton title="Book Ride" onPress={handleBookRide} />
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
            <Text className="text-xl font-CairoBold mb-4 text-center">Rate Your Ride</Text>
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
                title="Submit"
                onPress={handleRateDriver}
                className="flex-1 mr-2 bg-green-500"
              />
              <CustomButton
                title="Cancel"
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
          <Text className="text-white mt-4 font-CairoBold">Press anywhere to close</Text>
        </Pressable>
      </Modal>
    </RideLayout>
  );
};

export default RideDetails;