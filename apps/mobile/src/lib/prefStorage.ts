import { Platform } from "react-native";

type PrefStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let storage: PrefStorage;

if (Platform.OS !== "web") {
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  storage = {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  };
} else {
  storage = {
    getItem: async (key) => globalThis.localStorage?.getItem(key) ?? null,
    setItem: async (key, value) => globalThis.localStorage?.setItem(key, value),
    removeItem: async (key) => globalThis.localStorage?.removeItem(key),
  };
}

export async function getPref(key: string): Promise<string | null> {
  return storage.getItem(key);
}

export async function setPref(key: string, value: string): Promise<void> {
  await storage.setItem(key, value);
}

export async function removePref(key: string): Promise<void> {
  await storage.removeItem(key);
}

export async function getPrefBool(key: string, defaultValue = true): Promise<boolean> {
  const val = await getPref(key);
  return val === null ? defaultValue : val === "true";
}

export async function setPrefBool(key: string, value: boolean): Promise<void> {
  await setPref(key, value ? "true" : "false");
}
