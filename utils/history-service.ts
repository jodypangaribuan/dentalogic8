
import AsyncStorage from '@react-native-async-storage/async-storage';
// Use legacy API to avoid deprecation errors in newer Expo SDKs
import * as FileSystem from 'expo-file-system/legacy';

// Fallback if legacy doesn't export constants, but usually it does.
// If this fails, we will import constants from main package.
const DOC_DIR = FileSystem.documentDirectory || FileSystem.cacheDirectory;

// Simple ID generator to avoid extra dependencies
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export interface HistoryItem {
    id: string;
    timestamp: number;
    dateStr: string;
    timeStr: string;
    label: string; // Main classification (e.g., D3)
    confidence: number;
    detections: any[]; // Array of detection objects
    imageUri: string; // Local persistent URI
    imageWidth: number;
    imageHeight: number;
    inferenceTime: number;
    source: 'local' | 'api';
}

const HISTORY_KEY = 'dentalogic_scan_history_v1';
// Use the detected directory
const IMAGE_DIR = (DOC_DIR || '') + 'scan_images/';

// Ensure image directory exists
async function ensureDirExists() {
    try {
        await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
    } catch (e) {
        // Ignore error if directory already exists or cannot be created
        console.warn('Error checking/creating directory:', e);
    }
}

export const HistoryService = {
    // Save a new scan result
    async saveScan(scanData: Omit<HistoryItem, 'id' | 'timestamp' | 'dateStr' | 'timeStr' | 'imageUri'> & { tempImageUri: string }): Promise<HistoryItem> {
        try {
            await ensureDirExists();

            // Copy image to permanent storage
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const newImageUri = IMAGE_DIR + fileName;

            await FileSystem.copyAsync({
                from: scanData.tempImageUri,
                to: newImageUri
            });

            const now = new Date();

            const newScan: HistoryItem = {
                id: generateId(),
                timestamp: now.getTime(),
                dateStr: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
                timeStr: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                label: scanData.label,
                confidence: scanData.confidence,
                detections: scanData.detections,
                imageUri: newImageUri,
                imageWidth: scanData.imageWidth,
                imageHeight: scanData.imageHeight,
                inferenceTime: scanData.inferenceTime,
                source: scanData.source
            };

            // Get existing history
            const existingHistory = await this.getHistory();
            const updatedHistory = [newScan, ...existingHistory];

            // Save to storage
            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

            return newScan;

        } catch (error) {
            console.error('Error saving scan history:', error);
            throw error;
        }
    },

    // Get all history
    async getHistory(): Promise<HistoryItem[]> {
        try {
            const json = await AsyncStorage.getItem(HISTORY_KEY);
            return json ? JSON.parse(json) : [];
        } catch (error) {
            console.error('Error getting history:', error);
            return [];
        }
    },

    // Delete a specific history item
    async deleteItem(id: string): Promise<void> {
        try {
            const history = await this.getHistory();
            const itemToDelete = history.find(item => item.id === id);

            // Filter out the item
            const newHistory = history.filter(item => item.id !== id);
            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));

            // Delete image file if it exists
            if (itemToDelete?.imageUri) {
                try {
                    await FileSystem.deleteAsync(itemToDelete.imageUri, { idempotent: true });
                } catch (e) {
                    console.warn('Could not delete image file', e);
                }
            }
        } catch (error) {
            console.error('Error deleting history item:', error);
        }
    },

    // Clear all history
    async clearAll(): Promise<void> {
        try {
            const history = await this.getHistory();
            // Delete all image files
            for (const item of history) {
                if (item.imageUri) {
                    try {
                        await FileSystem.deleteAsync(item.imageUri, { idempotent: true });
                    } catch (e) {
                        // ignore
                    }
                }
            }
            await AsyncStorage.removeItem(HISTORY_KEY);
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }
};
