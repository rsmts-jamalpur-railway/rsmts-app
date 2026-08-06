import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './axios'; // Existing authenticated Axios instance

const PENDING_PHOTOS_KEY = '@pending_photos';

interface PendingUpload {
  assetNumber: string;
  uris: string[];
}

export const queuePhotosForUpload = async (assetNumber: string, uris: string[]) => {
  if (!uris || uris.length === 0) return;
  
  try {
    const existingStr = await AsyncStorage.getItem(PENDING_PHOTOS_KEY);
    const existing: PendingUpload[] = existingStr ? JSON.parse(existingStr) : [];
    
    existing.push({ assetNumber, uris });
    await AsyncStorage.setItem(PENDING_PHOTOS_KEY, JSON.stringify(existing));
    
    // Try to upload immediately
    processPhotoQueue();
  } catch (e) {
    console.error('Failed to queue photos', e);
  }
};

export const processPhotoQueue = async () => {
  try {
    const existingStr = await AsyncStorage.getItem(PENDING_PHOTOS_KEY);
    if (!existingStr) return;
    
    let queue: PendingUpload[] = JSON.parse(existingStr);
    let newQueue: PendingUpload[] = [];
    
    for (const item of queue) {
      try {
        const formData = new FormData();
        formData.append('asset_number', item.assetNumber);
        
        item.uris.forEach((uri, index) => {
          formData.append('photos', {
            uri: uri,
            name: `photo_${index}.jpg`,
            type: 'image/jpeg'
          } as any);
        });

        await api.post('/sync/photos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        console.log(`Successfully uploaded ${item.uris.length} photos for ${item.assetNumber}`);
      } catch (err: any) {
        console.error('Photo upload failed, keeping in queue', err?.message || err);
        newQueue.push(item);
      }
    }
    
    if (newQueue.length !== queue.length) {
      await AsyncStorage.setItem(PENDING_PHOTOS_KEY, JSON.stringify(newQueue));
    }
  } catch (e) {
    console.error('Error processing photo queue', e);
  }
};
