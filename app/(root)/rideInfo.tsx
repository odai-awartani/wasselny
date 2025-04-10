import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { icons } from "@/constants";
import CustomButton from "@/components/CustomButton";
import { router } from "expo-router";
import RideLayout from "@/components/RideLayout";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useAuth } from "@clerk/clerk-expo";

const AddRideDetails = () => {
  const { userId } = useAuth();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [tripDate, setTripDate] = useState<string>("");
  const [tripTime, setTripTime] = useState<string>("");
  const [availableSeats, setAvailableSeats] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const params = useLocalSearchParams();
  const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const genders = ["ذكر", "أنثى", "كلاهما"];

  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
  
    try {
      if (!validateForm()) {
        return; // إذا لم يتم التحقق من النموذج بنجاح، توقف هنا
      }
  
      const rideData = {
        ...params,
        ride_datetime: `${tripDate} ${tripTime}`,
        ride_days: selectedDays.join(","),
        required_gender: selectedGender,
        available_seats: parseInt(availableSeats),
        driver_id: "1",
        user_id: userId,
      };
  
      router.push({
        pathname: "/(root)/carInfo",
        params: rideData,
      });
    } catch (error: any) {
      console.error("Booking error:", error);
      Alert.alert(
        "Booking Failed",
        error.message || "Could not complete booking. Please try again."
      );
    } finally {
      setIsLoading(false); // يتم تنفيذ هذا دائمًا بغض النظر عن النجاح أو الفشل
    }
  }, [params, tripDate, tripTime, selectedDays, selectedGender, availableSeats, userId]);
  
  const toggleDaySelection = useCallback((day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);
  
  const getDayOfWeek = (date: Date) => {
    const dayIndex = date.getDay();
    const arabicDaysMap = [1, 2, 3, 4, 5, 6, 0];
    return days[arabicDaysMap[dayIndex]];
  };
  
  const handleDateConfirm = useCallback((date: Date) => {
    const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
    setTripDate(formattedDate);
    const dayOfWeek = getDayOfWeek(date);
    if (!selectedDays.includes(dayOfWeek)) {
      setSelectedDays((prev) => [...prev, dayOfWeek]);
    }
    setDatePickerVisible(false);
  }, [selectedDays]);
  
  const handleTimeConfirm = useCallback((time: Date) => {
    setTripTime(time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setTimePickerVisible(false);
  }, []);
  
  const handleSeatsChange = useCallback((text: string) => {
    const numericValue = text.replace(/[^0-9]/g, "");
    setAvailableSeats(numericValue);
  }, []);
  
  const validateForm = useCallback(() => {
    if (selectedDays.length === 0) {
      Alert.alert("الرجاء اختيار أيام الرحلة");
      return false;
    }
    if (!tripDate) {
      Alert.alert("الرجاء اختيار تاريخ الرحلة");
      return false;
    }
    if (!tripTime) {
      Alert.alert("الرجاء اختيار وقت الرحلة");
      return false;
    }
    if (!availableSeats || isNaN(parseInt(availableSeats))) {
      Alert.alert("الرجاء إدخال عدد صحيح للمقاعد المتاحة");
      return false;
    }
    if (!selectedGender) {
      Alert.alert("الرجاء اختيار الجنس المطلوب");
      return false;
    }
    return true;
  }, [selectedDays, tripDate, tripTime, availableSeats, selectedGender]);

  return (
    <RideLayout title="Ride Information" snapPoints={["40%", "70%", "88%"]}>
      <ScrollView className="px-4">
        <View className="mb-4">
          <Text className="text-lg font-JakartaMedium text-right mb-2">تاريخ الرحلة</Text>
          <TouchableOpacity onPress={() => setDatePickerVisible(true)}>
            <View className="flex-row items-center border border-gray-300 rounded-lg p-3">
              <Text className="flex-1 text-right">{tripDate || "اختر التاريخ"}</Text>
              <Image source={icons.calendar} className="w-5 h-5" />
            </View>
          </TouchableOpacity>
        </View>

        <View className="mb-4">
          <Text className="text-lg font-JakartaMedium text-right mb-2">وقت الرحلة</Text>
          <TouchableOpacity onPress={() => setTimePickerVisible(true)}>
            <View className="flex-row items-center border border-gray-300 rounded-lg p-3">
              <Text className="flex-1 text-right">{tripTime || "اختر الوقت"}</Text>
              <Image source={icons.clock} className="w-5 h-5" />
            </View>
          </TouchableOpacity>
        </View>

        <View className="mb-2">
          <Text className="text-lg font-JakartaMedium text-right mb-2">حدد أيام الرحلة</Text>
          <View className="flex-row flex-wrap justify-between">
            {days.map((day) => (
              <TouchableOpacity
                key={day}
                className={`p-3 mb-2 rounded-lg border ${
                  selectedDays.includes(day) ? "bg-orange-500 border-orange-500" : "border-gray-300"
                }`}
                style={{ width: "30%" }}
                onPress={() => toggleDaySelection(day)}
              >
                <Text
                  className={`text-center ${
                    selectedDays.includes(day) ? "text-white" : "text-gray-800"
                  }`}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-lg font-JakartaMedium text-right mb-2">عدد المقاعد المتاحة</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 text-right"
            value={availableSeats}
            onChangeText={handleSeatsChange}
            placeholder="حدد عدد المقاعد"
            keyboardType="numeric"
          />
        </View>

        <View className="mb-6">
          <Text className="text-lg font-JakartaMedium text-right mb-2">الجنس المطلوب</Text>
          <View className="flex-row flex-wrap justify-between">
            {genders.map((gender) => (
              <TouchableOpacity
                key={gender}
                className={`p-3 mb-1 rounded-lg border ${
                  selectedGender === gender ? "bg-orange-500 border-orange-500" : "border-gray-300"
                }`}
                style={{ width: "30%" }}
                onPress={() => setSelectedGender(gender)}
              >
                <Text
                  className={`text-center ${
                    selectedGender === gender ? "text-white" : "text-gray-800"
                  }`}
                >
                  {gender}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <CustomButton
            title={isLoading ? "Processing..." : "Find Now"}
            className="my-10"
            onPress={handleSubmit}
            disabled={isLoading}
          />
      </ScrollView>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={new Date()}
        minimumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
      />

      <DateTimePickerModal
        isVisible={isTimePickerVisible}
        mode="time"
        date={new Date()}
        onConfirm={handleTimeConfirm}
        onCancel={() => setTimePickerVisible(false)}
      />
    </RideLayout>
  );
};

export default AddRideDetails;