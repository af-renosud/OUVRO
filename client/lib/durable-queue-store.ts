import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

type EventListener = (event: string, data?: any) => void;

export class DurableQueueStore<T extends { localId: string }> {
  private listeners: Set<EventListener> = new Set();
  private storageKey: string;
  private durableSubdir: string;
  private logPrefix: string;

  constructor(storageKey: string, durableSubdir: string, logPrefix: string) {
    this.storageKey = storageKey;
    this.durableSubdir = durableSubdir;
    this.logPrefix = logPrefix;
  }

  async load(): Promise<T[]> {
    try {
      const data = await AsyncStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data) as T[];
      }
      return [];
    } catch (error) {
      console.error(`[${this.logPrefix}] Load error:`, error);
      return [];
    }
  }

  async save(items: T[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (error) {
      console.error(`[${this.logPrefix}] Persist error:`, error);
    }
  }

  async copyToDurableStorage(uri: string, fileName: string): Promise<string> {
    try {
      if (uri.startsWith("mock://") || uri.includes(`/${this.durableSubdir}/`)) {
        return uri;
      }

      const durableDir = `${FileSystem.documentDirectory}${this.durableSubdir}/`;
      const dirInfo = await FileSystem.getInfoAsync(durableDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(durableDir, { intermediates: true });
      }

      const uniqueFileName = `${Date.now()}_${fileName}`;
      const durableUri = `${durableDir}${uniqueFileName}`;

      await FileSystem.copyAsync({ from: uri, to: durableUri });

      if (__DEV__) console.log(`[${this.logPrefix}] Copied to durable storage:`, durableUri);
      return durableUri;
    } catch (error) {
      console.error(`[${this.logPrefix}] Failed to copy to durable storage:`, error);
      return uri;
    }
  }

  async deleteFile(uri: string): Promise<void> {
    if (!uri || uri.startsWith("mock://")) return;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (e) {
      if (__DEV__) console.warn(`[${this.logPrefix}] Failed to delete file:`, uri);
    }
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: string, data?: any): void {
    this.listeners.forEach((listener) => listener(event, data));
  }
}
