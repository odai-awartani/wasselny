import { Stack } from 'expo-router'
import React from 'react'

const RootLayout = () => {
  return (
     <Stack>
       <Stack.Screen 
         name="[id]" 
         options={{ 
           headerShown: false,
           title: ''
         }} 
       />
     </Stack>
  )
}

export default RootLayout