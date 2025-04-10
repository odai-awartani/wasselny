import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const originalChats = [
  {
    id: 1,
    name: 'George Alan',
    message: 'Lorem ipsum dolor sit amet consect...',
    time: '4:30 PM',
    avatar: require('@/assets/images/Hamza.jpg'),
    unread: 4,
    icon: null,
    subtitle: null,
    status: 'online'
  },
  {
    id: 2,
    name: 'Uber Cars',
    message: '',
    time: '4:30 PM',
    avatar: require('@/assets/images/Hamza.jpg'),
    unread: 1,
    icon: 'form-select',
    subtitle: 'Form',
    status: null
  },
  {
    id: 3,
    name: 'Safiya Fareena',
    message: '',
    time: '4:30 PM',
    avatar: 'https://randomuser.me/api/portraits/women/3.jpg',
    unread: 1,
    icon: 'calendar-month',
    subtitle: 'Scheduler',
    status: 'online'
  },
  {
    id: 4,
    name: 'Robert Allen',
    message: 'You unblocked this user',
    time: '4:30 PM',
    avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
    unread: 0,
    icon: null,
    subtitle: null,
    status: 'online'
  },
  {
    id: 5,
    name: 'Epic Game',
    message: 'John Paul: @Robert Lorem ips...',
    time: '4:30 PM',
    avatar: 'https://cdn-icons-png.flaticon.com/512/5969/5969368.png',
    unread: 24,
    icon: null,
    subtitle: null,
    status: 'mention'
  },
  {
    id: 6,
    name: 'Scott Franklin',
    message: 'Audio',
    time: 'Yesterday',
    avatar: null,
    unread: 0,
    icon: 'microphone-outline',
    subtitle: 'Audio',
    status: 'error'
  },
  {
    id: 7,
    name: 'Muhammed',
    message: 'Poll',
    time: 'Yesterday',
    avatar: 'https://randomuser.me/api/portraits/men/7.jpg',
    unread: 0,
    icon: 'poll',
    subtitle: 'Poll',
    status: null
  },
];

export default function ChatListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState(originalChats);

  // Filter chats based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(originalChats);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = originalChats.filter(chat => {
      const nameMatch = chat.name.toLowerCase().includes(query);
      const messageMatch = chat.message && chat.message.toLowerCase().includes(query);
      const subtitleMatch = chat.subtitle && chat.subtitle.toLowerCase().includes(query);
      
      return nameMatch || messageMatch || subtitleMatch;
    });
    
    setFilteredChats(filtered);
  }, [searchQuery]);

  const handleChatPress = (chat) => {
    // Handle both string URLs and local image requires
    let avatarUri = '';
    if (chat.avatar) {
      if (typeof chat.avatar === 'string') {
        avatarUri = chat.avatar;
      }
    }

    router.push({
      pathname: '/[id]',
      params: {
        id: chat.id.toString(),
        name: chat.name,
        avatar: avatarUri,
      },
    });
  };

  // Handle search input changes
  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  // Clear search query
  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <View className="flex-1 bg-white px-4 pt-10">
      <Text className="text-xl font-bold mb-4">Recent chats</Text>

      {/* Search */}
      <View className="mb-4 rounded-xl bg-gray-100 px-4 py-2 flex-row items-center">
        <Ionicons name="search" size={20} color="gray" />
        <TextInput 
          placeholder="Search"
          className="flex-1 text-base px-2" 
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <Ionicons name="close-circle" size={20} color="gray" />
          </TouchableOpacity>
        )}
      </View>

      {/* No results message */}
      {filteredChats.length === 0 && searchQuery.length > 0 && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 text-lg">No chats found</Text>
          <Text className="text-gray-400 text-base mt-2">Try a different search term</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {filteredChats.map((chat) => (
          <TouchableOpacity 
            key={chat.id} 
            className="flex-row items-center py-3 border-b border-gray-100"
            onPress={() => handleChatPress(chat)}
          >
            {/* Avatar */}
            {chat.avatar ? (
              typeof chat.avatar === 'string' ? (
                <Image source={{ uri: chat.avatar }} className="w-12 h-12 rounded-full" />
              ) : (
                <Image source={chat.avatar} className="w-12 h-12 rounded-full" />
              )
            ) : (
              <View className="w-12 h-12 rounded-full bg-purple-200 items-center justify-center">
                <Text className="text-lg font-semibold text-orange-800">{chat.name[0]}</Text>
              </View>
            )}

            <View className="flex-1 ml-3">
              <View className="flex-row justify-between items-center">
                <Text className="font-medium text-base">{chat.name}</Text>
              </View>
              <View className="flex-row items-center">
                {chat.icon && (
                  <MaterialCommunityIcons
                    name={chat.icon}
                    size={16}
                    color={chat.status === 'error' ? 'red' : 'gray'}
                    className="mr-1"
                  />
                )}
                <Text className="text-sm text-gray-500 truncate">
                  {chat.subtitle ? `${chat.subtitle}` : chat.message}
                </Text>
              </View>
            </View>

            {/* Right side: unread count, time, and status indicators */}
            <View className="flex-row items-center">
              {chat.unread > 0 && (
                <View className="mr-2 bg-orange-500 px-2 py-1 rounded-full">
                  <Text className="text-xs text-white font-semibold">{chat.unread}</Text>
                </View>
              )}
              <Text className="text-xs text-gray-400 mr-2">{chat.time}</Text>
              {chat.status === 'online' && <View className="w-3 h-3 rounded-full bg-green-500" />}
              {chat.status === 'mention' && <View className="w-3 h-3 rounded-full bg-orange-500" />}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
