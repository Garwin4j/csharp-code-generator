import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
  onSnapshot,
  Unsubscribe,
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
        files: docData.files || null,
        createdAt: (docData.createdAt as Timestamp)?.toDate(),
        updatedAt: (docData.updatedAt as Timestamp)?.toDate(),
    } as Omit<Package, 'id'>;
}

export const createPackageForGeneration = async (
  initialRequirements: string,
  userId?: string,
): Promise<Package> => {
  const newPackageData: any = {
    name: `New Project - ${new Date().toLocaleDateString()}`,
    initialRequirements,
    files: null,
    status: 'generating' as const,
    generationLog: 'Initializing...',
    error: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (userId) {
    newPackageData.userId = userId;
  }

  const docRef = await addDoc(packagesCollection, newPackageData);
  return { 
      id: docRef.id, 
      ...newPackageData,
      createdAt: new Date(),
      updatedAt: new Date(),
  };
};

export const updatePackageGenerationProgress = async (
  packageId: string,
  progressLog: string
): Promise<void> => {
  const packageDoc = doc(db, 'packages', packageId);
  await updateDoc(packageDoc, {
    generationLog: progressLog,
    updatedAt: serverTimestamp(),
  });
};

export const finalizePackageGeneration = async (
  packageId: string,
  files: GeneratedFile[]
): Promise<void> => {
  const packageDoc = doc(db, 'packages', packageId);
  await updateDoc(packageDoc, {
    files,
    status: 'completed',
    generationLog: 'Generation complete.',
    updatedAt: serverTimestamp(),
  });
};

export const failPackageGeneration = async (
  packageId: string,
  errorMessage: string
): Promise<void> => {
  const packageDoc = doc(db, 'packages', packageId);
  await updateDoc(packageDoc, {
    status: 'failed',
    error: errorMessage,
    updatedAt: serverTimestamp(),
  });
};

export const getPackage = async (packageId: string): Promise<Package | null> => {
    const packageDocRef = doc(db, 'packages', packageId);
    const docSnap = await getDoc(packageDocRef);

    if (docSnap.exists()) {
        return {
            id: docSnap.id,
            ...convertPackageTimestamps(docSnap.data()),
        } as Package;
    } else {
        return null;
    }
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

export const onUserPackagesSnapshot = (
    userId: string,
    callback: (packages: Package[]) => void
): Unsubscribe => {
    const q = query(packagesCollection, where('userId', '==', userId), orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const packages = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertPackageTimestamps(doc.data()),
        } as Package));
        callback(packages);
    }, (error) => {
        console.error("Error listening to package updates:", error);
        callback([]);
    });

    return unsubscribe;
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