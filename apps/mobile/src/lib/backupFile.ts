import { Platform, Share } from "react-native";
import type { JarvisBackupV1 } from "@bhmt3wp/shared";

function backupFilename(exportedAt: string): string {
  const day = exportedAt.slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `jarvis-backup-${day}.json`;
}

/** Download (web) or share (native) the backup JSON. */
export async function deliverBackupFile(backup: JarvisBackupV1): Promise<"downloaded" | "shared"> {
  const json = JSON.stringify(backup, null, 2);
  const filename = backupFilename(backup.exportedAt);

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return "downloaded";
  }

  await Share.share({
    title: filename,
    message: json,
  });
  return "shared";
}

/** Opens a file picker (web) and returns file text. Native: throws with guidance. */
export function pickBackupJsonFile(): Promise<string> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return Promise.reject(
      new Error("Import pliku JSON działa na web. Na telefonie otwórz wersję webową albo wklej później."),
    );
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";

    const cleanup = () => {
      input.removeEventListener("change", onChange);
      input.remove();
    };

    const onChange = () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        reject(new Error("Nie wybrano pliku."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Nie udało się odczytać pliku."));
      };
      reader.onerror = () => reject(new Error("Błąd odczytu pliku."));
      reader.readAsText(file);
    };

    input.addEventListener("change", onChange);
    document.body.appendChild(input);
    input.click();
  });
}
