import { Platform } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Setup notifications and request permissions
export const setupNotifications = async (userId: string | null) => {
  try {
    if (!Device.isDevice) {
      alert('Must use physical device for Push Notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Please grant notification permissions to receive chat messages');
      return false;
    }

    // Set up notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chat-messages', {
        name: 'Chat Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Get and store push token in Firestore
    if (userId) {
      const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
      if (!projectId) {
        throw new Error('Missing EXPO_PUBLIC_PROJECT_ID in environment variables');
      }
      
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      
      await setDoc(doc(db, 'users', userId), { 
        pushToken: token.data,
        deviceType: Platform.OS,
      }, { merge: true });
      
      console.log('Push token saved for user:', userId);
    }

    return true;
  } catch (error) {
    console.error('Error setting up notifications:', error);
    return false;
  }
};

// Send chat notification to a specific user
export const sendChatNotification = async (
  recipientId: string,
  senderName: string,
  message: string,
  chatId: string
) => {
  try {
    // Get recipient's push token from Firestore
    const userDoc = await getDoc(doc(db, 'users', recipientId));
    if (!userDoc.exists() || !userDoc.data().pushToken) {
      console.warn(`No push token found for user: ${recipientId}`);
      return;
    }

    const pushToken = userDoc.data().pushToken;

    // Send notification via Expo server
    const notificationMessage = {
      to: pushToken,
      sound: 'default',
      title: `New message from ${senderName}`,
      body: message,
      data: { chatId, type: 'chat' },
      priority: 'high',
      channelId: 'chat-messages',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationMessage),
    });

    if (!response.ok) {
      console.warn('Failed to send chat notification:', await response.text());
      return;
    }

    console.log(`Chat notification sent to user: ${recipientId}`);
  } catch (error) {
    console.error('Error sending chat notification:', error);
  }
};

// Handle notification tap
export const handleNotificationResponse = (
  response: Notifications.NotificationResponse
) => {
  const { notification } = response;
  const chatId = notification.request.content.data?.chatId;
  const type = notification.request.content.data?.type;

  console.log('Notification clicked:', { chatId, type });

  // Navigate to chat screen when notification is clicked
  if (type === 'chat' && chatId) {
    // Use require instead of dynamic import for better compatibility
    const router = require('expo-router').router;
    router.push({
      pathname: "/(root)/chat/[id]",
      params: { id: chatId }
    });
  }
};

// Setup notification handler
export const setupNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });

  Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};