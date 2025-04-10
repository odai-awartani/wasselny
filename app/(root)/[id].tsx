import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Image,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
  } from 'react-native';
  import { useLocalSearchParams, useNavigation } from 'expo-router';
  import { useState, useRef, useEffect } from 'react';
  import { Ionicons, MaterialIcons, Entypo } from '@expo/vector-icons';
  
  export default function ConversationScreen() {
    const { name, avatar } = useLocalSearchParams();
    const navigation = useNavigation();
    const scrollRef = useRef(null);
    const [messages, setMessages] = useState([
      { id: 1, text: 'Sure! Sending them over now.', sent: false, time: '4:56 pm' },
      { id: 2, text: 'Thanks! Looks good.', sent: true, time: '4:56 pm' },
      { id: 3, text: "I'll take it. Can you ship it?", sent: true, time: '4:56 pm' },
      { id: 4, text: 'Absolutely. Just send your address.', sent: false, time: '4:56 pm' },
      { id: 5, text: "Great, I'll send it now. Thanks!", sent: true, time: '4:56 pm' },
      { id: 6, text: 'Thank you!', sent: false, time: '4:56 pm' },
    ]);
    const [newMessage, setNewMessage] = useState('');
  
    useEffect(() => {
      const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
      return () => {
        showSubscription.remove();
      };
    }, []);
  
    const handleSend = () => {
      if (newMessage.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            text: newMessage,
            sent: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setNewMessage('');
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    };
  
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} // Padding for iOS, undefined for Android
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0} // Reduced offset for iOS
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-10 pb-3 border-b border-gray-200 bg-white">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="black" />
            </TouchableOpacity>
            {avatar ? (
              <Image
                source={{ uri: typeof avatar === 'string' ? avatar : '' }}
                className="w-10 h-10 rounded-full mx-3"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-purple-200 items-center justify-center mx-3">
                <Text className="text-lg font-semibold text-orange-800">{name ? String(name)[0] : '?'}</Text>
              </View>
            )}
            <View>
              <Text className="text-base font-semibold text-black">{name}</Text>
              <Text className="text-xs text-gray-400">Typing...</Text>
            </View>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity>
              <Ionicons name="call-outline" size={20} color="black" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Ionicons name="videocam-outline" size={20} color="black" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Entypo name="dots-three-vertical" size={16} color="black" />
            </TouchableOpacity>
          </View>
        </View>
  
        {/* Main Content */}
        <View className="flex-1">
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-4 py-2"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                className={`mb-3 ${message.sent ? 'items-end' : 'items-start'}`}
              >
                <View
                  className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                    message.sent ? 'bg-orange-600 rounded-br-none' : 'bg-gray-200 rounded-bl-none'
                  }`}
                >
                  <Text className={`${message.sent ? 'text-white' : 'text-black'} text-sm`}>
                    {message.text}
                  </Text>
                </View>
                <Text className="text-xs text-gray-400 mt-1">{message.time}</Text>
              </View>
            ))}
          </ScrollView>
  
          {/* Input Bar */}
          <View className="p-2 bg-white border-t border-gray-200">
            <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-2">
              <TouchableOpacity>
                <Entypo name="plus" size={20} color="gray" />
              </TouchableOpacity>
              <TextInput
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                multiline
                className="flex-1 text-sm px-2 max-h-20"
              />
              <TouchableOpacity>
                <MaterialIcons name="emoji-emotions" size={20} color="gray" />
              </TouchableOpacity>
              <TouchableOpacity className="ml-2" onPress={handleSend}>
                <Ionicons name="send" size={22} color="#7c3aed" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }