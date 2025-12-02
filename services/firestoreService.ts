
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
  deleteField,
  DocumentReference,
  setDoc,
  DocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { GeneratedFile, Package, ChatMessage, Checkpoint } from '../types';

// Firestore collection references
const packagesCollection = collection(db, 'packages');
const getChatHistoryCollection = (packageId: string) => collection(db, `packages/${packageId}/chatHistory`);
const getCheckpointsCollection = (packageId: string) => collection(db, `packages/${packageId}/checkpoints`);

// Constants for chunking
const CHUNK_SIZE = 800000; // ~800KB, well within 1MB limit

// --- Helper Functions for Chunking ---

/**
 * Saves data to a document, utilizing subcollection chunks if the data exceeds the limit.
 */
const saveLargeDoc = async (
    docRef: DocumentReference,
    baseData: any,
    largeData: { [key: string]: any }
) => {
    const largeDataJson = JSON.stringify(largeData);

    if (largeDataJson.length < CHUNK_SIZE) {
        // Small enough: save directly in the main document
        // We set isChunked: false to indicate data is local
        const batch = writeBatch(db);
        batch.set(docRef, { ...baseData, ...largeData, isChunked: false }, { merge: true });
        await batch.commit();
    } else {
        // Too large: chunk it
        const chunks: string[] = [];
        for (let i = 0; i < largeDataJson.length; i += CHUNK_SIZE) {
            chunks.push(largeDataJson.substring(i, i + CHUNK_SIZE));
        }

        // We need to write the main doc and the chunks.
        // Firestore batch limit is 500 writes or 10MB payload.
        // 800KB * 12 = 9.6MB. Let's start a new batch every 10 chunks to be safe.
        const BATCH_CHUNK_LIMIT = 10;
        
        let batch = writeBatch(db);
        let operationCount = 0;

        const chunksCol = collection(docRef, 'data_chunks');

        for (let i = 0; i < chunks.length; i++) {
            const chunkDoc = doc(chunksCol, i.toString());
            batch.set(chunkDoc, { content: chunks[i], index: i });
            operationCount++;

            if (operationCount >= BATCH_CHUNK_LIMIT) {
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        // Final batch includes the main document update
        // We explicitly delete the large fields from the main doc to free space.
        const deleteFieldsUpdate: any = {};
        Object.keys(largeData).forEach(key => {
            deleteFieldsUpdate[key] = deleteField();
        });

        batch.set(docRef, { 
            ...baseData, 
            ...deleteFieldsUpdate,
            isChunked: true, 
            chunkCount: chunks.length 
        }, { merge: true });
        
        await batch.commit();
    }
};

/**
 * Loads data from a document, reassembling chunks if necessary.
 */
const loadLargeDoc = async (docSnap: DocumentSnapshot): Promise<any> => {
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    
    if (!data.isChunked) {
        // Data is in the main document
        return data;
    }

    // Data is chunked, fetch from subcollection
    const chunksCol = collection(docSnap.ref, 'data_chunks');
    const q = query(chunksCol, orderBy('index'));
    const chunkSnaps = await getDocs(q);
    
    let combinedJson = '';
    chunkSnaps.forEach(snap => {
        combinedJson += snap.data().content;
    });

    if (!combinedJson) {
        console.error(`Failed to load chunks for document ${docSnap.id}`);
        return data; // Fallback, though likely missing data
    }

    try {
        const parsedLargeData = JSON.parse(combinedJson);
        return { ...data, ...parsedLargeData };
    } catch (e) {
        console.error("Error parsing chunked JSON:", e);
        return data;
    }
};


// Helper to convert Firestore Timestamps and sanitize nested objects
const convertPackageTimestamps = (docData: any): Omit<Package, 'id'> => {
    // Sanitize the 'files' array to ensure they are plain objects,
    // preventing circular reference errors with JSON.stringify.
    const files = docData.files ? docData.files.map((file: GeneratedFile) => ({
        path: file.path,
        content: file.content
    })) : null;

    const originalFiles = docData.originalFiles ? docData.originalFiles.map((file: GeneratedFile) => ({
      path: file.path,
      content: file.content
    })) : null;

    return {
        userId: docData.userId,
        name: docData.name,
        initialRequirements: docData.initialRequirements,
        files: files,
        originalFiles: originalFiles, // Include originalFiles
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
  baseFiles: GeneratedFile[] | null = null // Add baseFiles parameter
): Promise<Package> => {
  const packageDocRef = doc(packagesCollection); // Auto-generate ID

  const newPackageData: any = {
    name: `New Project - ${new Date().toLocaleDateString()}`,
    initialRequirements,
    status: 'generating' as const,
    generationLog: 'Initializing...',
    error: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (userId) {
    newPackageData.userId = userId;
  }

  // Use saveLargeDoc to handle potentially large baseFiles (from ZIP)
  await saveLargeDoc(packageDocRef, newPackageData, { 
      files: null, 
      originalFiles: baseFiles 
  });

  return { 
      id: packageDocRef.id, 
      ...newPackageData,
      files: null,
      originalFiles: baseFiles,
      createdAt: new Date(),
      updatedAt: new Date(),
  };
};

export const createPackageFromJson = async (
  data: { projectName: string, initialRequirements?: string, files: GeneratedFile[] },
  userId?: string
): Promise<Package> => {
  const packageDocRef = doc(packagesCollection); // auto-generate id

  const newPackageData: any = {
    name: data.projectName,
    initialRequirements: data.initialRequirements || 'Project created from JSON file.',
    status: 'completed' as const,
    error: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (userId) {
    newPackageData.userId = userId;
  }
  
  // 1. Save Package with potential chunking
  await saveLargeDoc(packageDocRef, newPackageData, {
      files: data.files,
      originalFiles: data.files
  });
  
  // 2. Save Initial Checkpoint with potential chunking
  const checkpointsCollectionRef = getCheckpointsCollection(packageDocRef.id);
  const checkpointDocRef = doc(checkpointsCollectionRef);
  
  await saveLargeDoc(checkpointDocRef, {
      message: 'Initial Version from JSON',
      createdAt: serverTimestamp(),
  }, {
      files: data.files
  });

  const now = new Date();
  const createdPackage: Package = {
      id: packageDocRef.id,
      userId: userId,
      name: data.projectName,
      initialRequirements: data.initialRequirements || 'Project created from JSON file.',
      files: data.files,
      originalFiles: data.files,
      createdAt: now,
      updatedAt: now,
      status: 'completed',
  };

  return createdPackage;
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
    const packageDocRef = doc(db, 'packages', packageId);

    // Get current package to preserve originalFiles if we need to re-save them
    const currentPkg = await getPackage(packageId); 
    const originalFiles = currentPkg?.originalFiles || files; 

    await saveLargeDoc(packageDocRef, {
        status: 'completed',
        generationLog: 'Generation complete.',
        updatedAt: serverTimestamp(),
    }, {
        files: files,
        originalFiles: originalFiles
    });

    // Create the initial checkpoint
    const checkpointsCollectionRef = getCheckpointsCollection(packageId);
    const checkpointDocRef = doc(checkpointsCollectionRef); 
    
    await saveLargeDoc(checkpointDocRef, {
        message: 'Initial Version',
        createdAt: serverTimestamp(),
    }, {
        files: files
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
        const fullData = await loadLargeDoc(docSnap);
        return {
            id: docSnap.id,
            ...convertPackageTimestamps(fullData),
        } as Package;
    } else {
        return null;
    }
};

export const updatePackage = async (
  packageId: string,
  files: GeneratedFile[]
): Promise<void> => {
  const packageDocRef = doc(db, 'packages', packageId);
  
  // We need to preserve originalFiles when updating
  const currentPkg = await getPackage(packageId);
  const originalFiles = currentPkg?.originalFiles || null;

  await saveLargeDoc(packageDocRef, {
    updatedAt: serverTimestamp(),
  }, {
      files,
      originalFiles
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
    for (const cpDoc of checkpointsSnapshot.docs) {
        batch.delete(cpDoc.ref);
        
        // Also try to delete chunks for checkpoints if they exist
        const chunksCol = collection(cpDoc.ref, 'data_chunks');
        const chunksSnapshot = await getDocs(chunksCol);
        chunksSnapshot.forEach(c => batch.delete(c.ref));
    }
    
    // 3. Delete the main package document (and its chunks subcollection items)
    const packageDocRef = doc(db, 'packages', packageId);
    
    // Cleanup for package chunks
    const packageChunksCol = collection(packageDocRef, 'data_chunks');
    const chunksSnapshot = await getDocs(packageChunksCol);
    chunksSnapshot.forEach(c => batch.delete(c.ref));

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
        const packages = querySnapshot.docs.map((doc) => {
             const data = doc.data();
             // If isChunked is true, 'files' and 'originalFiles' will likely be missing/null in 'data'.
             // We do NOT fetch chunks here to keep list loading fast.
             // The App component must handle lazy loading when a package is selected.
             return {
                id: doc.id,
                ...convertPackageTimestamps(data),
             } as Package;
        });
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
            images: data.images || [],
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
    const checkpointDocRef = doc(checkpointsCollection);

    await saveLargeDoc(checkpointDocRef, {
        message,
        createdAt: serverTimestamp(),
    }, {
        files
    });
};

export const getCheckpoints = async (packageId: string): Promise<Checkpoint[]> => {
    const checkpointsCollection = getCheckpointsCollection(packageId);
    const q = query(checkpointsCollection, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    // We need to load chunks for each checkpoint if they are chunked.
    const checkpoints = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
        const fullData = await loadLargeDoc(docSnap);
        
        // Sanitize
        const files = fullData.files ? fullData.files.map((file: GeneratedFile) => ({
            path: file.path,
            content: file.content
        })) : [];

        return {
            id: docSnap.id,
            message: fullData.message,
            files: files,
            createdAt: (fullData.createdAt as Timestamp).toDate(),
        } as Checkpoint;
    }));

    return checkpoints;
};
