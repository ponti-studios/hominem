export type UploadedBuffer = {
  filename: string;
  buffer: Buffer;
  mimetype: string;
};

export async function handleFileUploadBuffer(request: Request): Promise<UploadedBuffer | null> {
  const formData = await request.formData().catch(() => null);
  if (!formData) return null;

  for (const value of formData.values()) {
    if (value instanceof File) {
      const buffer = Buffer.from(await value.arrayBuffer());
      return {
        filename: value.name,
        buffer,
        mimetype: value.type || 'application/octet-stream',
      };
    }
  }

  return null;
}
