import { collection, doc, setDoc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export interface Driver {
  id: string;
  name: string;
  email: string;
  profile_image_url?: string;
  phone?: string;
  rating?: number;
  totalRides?: number;
  status?: 'active' | 'inactive' | 'busy';
  vehicle?: {
    type: string;
    model: string;
    year: number;
    plateNumber: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const createDriver = async (driverData: Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const driversRef = collection(db, 'drivers');
    const newDriverRef = doc(driversRef);
    const now = new Date().toISOString();

    const driver: Driver = {
      id: newDriverRef.id,
      ...driverData,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(newDriverRef, driver);
    return driver;
  } catch (error) {
    console.error('Error creating driver:', error);
    return null;
  }
};

export const getDriver = async (driverId: string) => {
  try {
    const driverRef = doc(db, 'drivers', driverId);
    const driverSnap = await getDoc(driverRef);

    if (driverSnap.exists()) {
      return { id: driverSnap.id, ...driverSnap.data() } as Driver;
    }
    return null;
  } catch (error) {
    console.error('Error getting driver:', error);
    return null;
  }
};

export const searchDrivers = async (query: string) => {
  try {
    const driversRef = collection(db, 'drivers');
    const q = query.toLowerCase();
    const snapshot = await getDocs(driversRef);
    
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Driver))
      .filter(driver => 
        driver.name.toLowerCase().includes(q) || 
        driver.email.toLowerCase().includes(q)
      );
  } catch (error) {
    console.error('Error searching drivers:', error);
    return [];
  }
};
