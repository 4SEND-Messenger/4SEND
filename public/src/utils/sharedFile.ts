let file: File | null = null;

export function setSharedFile(f: File) {
  file = f;
}

export function getSharedFile(): File | null {
  const f = file;
  file = null;
  return f;
}
