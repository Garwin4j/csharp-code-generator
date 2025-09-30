
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GeneratedFile, Package, ChatMessage, Checkpoint } from '../types';

// Firestore collection references
const packagesCollection = collection(db, 'packages');
const getChatHistoryCollection = (packageId: string) => collection(db, `packages/${packageId}/chatHistory`);
const getCheckpointsCollection = (packageId: string) => collection(db, `packages/${packageId}/checkpoints`);


// Helper to convert Firestore Timestamps and sanitize nested objects
const convertPackageTimestamps = (docData: any): Omit<Package, 'id'> => {
    // Sanitize the 'files' array to ensure they are plain objects,
    // preventing circular reference errors with JSON.stringify.
    const files = docData.files ? docData.files.map((file: GeneratedFile) => ({
        path: file.path,
        content: file.content
    })) : null;

    return {
        userId: docData.userId,
        name: docData.name,
        initialRequirements: docData.initialRequirements,
        files: files,
        createdAt: (docData.createdAt as Timestamp)?.toDate(),
        updatedAt: (docData.updatedAt as Timestamp)?.toDate(),
        status: docData.status,
        generationLog: docData.generationLog,
        error: docData.error,
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
    const batch = writeBatch(db);

    const packageDocRef = doc(db, 'packages', packageId);
    batch.update(packageDocRef, {
        files,
        status: 'completed',
        generationLog: 'Generation complete.',
        updatedAt: serverTimestamp(),
    });

    // Create the initial checkpoint
    const checkpointsCollectionRef = getCheckpointsCollection(packageId);
    const checkpointDocRef = doc(checkpointsCollectionRef); // Auto-generate ID
    batch.set(checkpointDocRef, {
        message: 'Initial Version',
        files: files,
        createdAt: serverTimestamp(),
    });

    await batch.commit();
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

export const renamePackage = async (
  packageId: string,
  newName: string
): Promise<void> => {
  const packageDoc = doc(db, 'packages', packageId);
  await updateDoc(packageDoc, {
    name: newName,
    updatedAt: serverTimestamp(),
  });
};

export const deletePackage = async (packageId: string): Promise<void> => {
    const batch = writeBatch(db);

    // 1. Get all chat history documents to delete
    const chatHistoryCollection = getChatHistoryCollection(packageId);
    const chatHistorySnapshot = await getDocs(chatHistoryCollection);
    chatHistorySnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    // 2. Get all checkpoint documents to delete
    const checkpointsCollection = getCheckpointsCollection(packageId);
    const checkpointsSnapshot = await getDocs(checkpointsCollection);
    checkpointsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    // 3. Delete the main package document
    const packageDocRef = doc(db, 'packages', packageId);
    batch.delete(packageDocRef);

    // 4. Commit all delete operations
    await batch.commit();
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

export const createCheckpoint = async (
    packageId: string,
    message: string,
    files: GeneratedFile[]
): Promise<void> => {
    const checkpointsCollection = getCheckpointsCollection(packageId);
    await addDoc(checkpointsCollection, {
        message,
        files,
        createdAt: serverTimestamp(),
    });
};

export const getCheckpoints = async (packageId: string): Promise<Checkpoint[]> => {
    const checkpointsCollection = getCheckpointsCollection(packageId);
    const q = query(checkpointsCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Sanitize the 'files' array to ensure they are plain objects,
        // preventing circular reference errors when this data is used later.
        const files = data.files ? data.files.map((file: GeneratedFile) => ({
            path: file.path,
            content: file.content
        })) : [];

        return {
            id: doc.id,
            message: data.message,
            files: files,
            createdAt: (data.createdAt as Timestamp).toDate(),
        } as Checkpoint;
    });
};
