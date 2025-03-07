import fs from "fs/promises";
import path from "path";

export async function fileExistsAtPath(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function normalizePath(p: string): string {
  // normalize resolve ./.. segments, removes duplicate slashes, and standardizes path separators
  let normalized = path.normalize(p)
  // however it doesn't remove trailing slashes
  // remove trailing slash, except for root paths
  if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

// Safe path comparison that works across different platforms
export function arePathsEqual(path1?: string, path2?: string): boolean {
  if (!path1 && !path2) {
    return true
  }
  if (!path1 || !path2) {
    return false
  }

  path1 = normalizePath(path1)
  path2 = normalizePath(path2)

  if (process.platform === "win32") {
    return path1.toLowerCase() === path2.toLowerCase()
  }
  return path1 === path2
}
