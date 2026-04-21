import * as Application from "expo-application";

export const CLIENT_VERSION_HEADER = "X-OUVRO-Client-Version";

export function getClientVersion(): string {
  return Application.nativeApplicationVersion || "1.0.0";
}

export function clientVersionHeaders(): Record<string, string> {
  return { [CLIENT_VERSION_HEADER]: getClientVersion() };
}
