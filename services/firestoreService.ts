import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GeneratedFile, Package, ChatMessage } from '../types';

// Firestore collection references
const packagesCollection = collection(db, 'packages');
const getChatHistoryCollection = (packageId: string) => collection(db, `packages/${packageId}/chatHistory`);

// Helper to convert Firestore Timestamps to Dates
const convertPackageTimestamps = (docData: any): Omit<Package, 'id'> => {
    return {
        ...docData,
        createdAt: (docData.createdAt as Timestamp)?.toDate(),
        updatedAt: (docData.updatedAt as Timestamp)?.toDate(),
    } as Omit<Package, 'id'>;
}

export const createPackage = async (
  userId: string,
  initialRequirements: string,
  files: GeneratedFile[]
): Promise<Package> => {
  const docRef = await addDoc(packagesCollection, {
    userId,
    name: `New Project - ${new Date().toLocaleDateString()}`, // Simple default name
    initialRequirements,
    files,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { 
      id: docRef.id, 
      userId,
      initialRequirements,
      files,
      name: `New Project - ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
  };
};

export const updatePackage = async (
  packageId: string,
  files: GeneratedFile[]
): Promise<void> => {
  const packageDoc = doc(db, 'packages', packageId);
  await updateDoc(packageDoc, {
    files,
    updatedAt: serverTimestamp(),
  });
};

export const getUserPackages = async (userId: string): Promise<Package[]> => {
  const q = query(packagesCollection, where('userId', '==', userId), orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...convertPackageTimestamps(doc.data()),
  } as Package));
};

export const addChatMessage = async (
  packageId: string,
  message: ChatMessage
): Promise<void> => {
    const chatHistoryCollection = getChatHistoryCollection(packageId);
    await addDoc(chatHistoryCollection, {
        ...message,
        timestamp: serverTimestamp(),
    });
};

export const getPackageChatHistory = async (packageId: string): Promise<ChatMessage[]> => {
    const chatHistoryCollection = getChatHistoryCollection(packageId);
    const q = query(chatHistoryCollection, orderBy('timestamp', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            role: data.role,
            content: data.content,
            timestamp: (data.timestamp as Timestamp)?.toDate(),
        } as ChatMessage;
    });
};
