import { createHash, randomUUID } from "node:crypto";

type StoredFile = {
  url: string;
  publicId: string;
};

export type PrivateSourceUploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: string;
  publicId: string;
  type: "authenticated";
  signature: string;
};

export type StoredImage = StoredFile & {
  format: string;
};

export function createPrivateSourceUploadSignature():
  | PrivateSourceUploadSignature
  | null;
export function createPrivateSourceUploadSignature(
  filename: string,
): PrivateSourceUploadSignature | null;
export function createPrivateSourceUploadSignature(
  filename = "",
): PrivateSourceUploadSignature | null {
  return createPrivateUploadSignature(filename, "semobicn/croquis");
}

export function createPrivateTestUploadSignature(
  filename = "",
): PrivateSourceUploadSignature | null {
  return createPrivateUploadSignature(filename, "semobicn/tests");
}

function createPrivateUploadSignature(
  filename: string,
  folder: string,
): PrivateSourceUploadSignature | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const extension =
    filename.toLowerCase().match(/\.(pdf|jpe?g|png|webp)$/)?.[0] ?? "";
  const publicId = `${folder}/${randomUUID()}${extension}`;
  const type = "authenticated" as const;
  const signatureBase = `public_id=${publicId}&timestamp=${timestamp}&type=${type}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");

  return {
    cloudName,
    apiKey,
    timestamp,
    publicId,
    type,
    signature,
  };
}

export async function deletePrivateSource(publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret || !publicId) return false;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const type = "authenticated";
  const signatureBase = `public_id=${publicId}&timestamp=${timestamp}&type=${type}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("type", type);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/destroy`,
    { method: "POST", body: form },
  );
  return response.ok;
}

export async function deletePrivateImage(publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret || !publicId) return false;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const type = "authenticated";
  const signatureBase = `public_id=${publicId}&timestamp=${timestamp}&type=${type}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("type", type);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: "POST", body: form },
  );
  return response.ok;
}

export async function storePrivateSource(
  file: File,
  bytes: Uint8Array,
): Promise<StoredFile | null> {
  const upload = createPrivateSourceUploadSignature(file.name);
  if (!upload) return null;

  const form = new FormData();
  const uploadBytes = Uint8Array.from(bytes);
  form.append(
    "file",
    new Blob([uploadBytes.buffer], { type: file.type }),
    file.name,
  );
  form.append("api_key", upload.apiKey);
  form.append("timestamp", upload.timestamp);
  form.append("public_id", upload.publicId);
  form.append("type", upload.type);
  form.append("signature", upload.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${upload.cloudName}/raw/upload`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    throw new Error("Falha ao armazenar o croqui.");
  }

  const result = (await response.json()) as {
    secure_url: string;
    public_id: string;
  };
  return { url: result.secure_url, publicId: result.public_id };
}

export const storePrivatePdf = storePrivateSource;

export async function storePrivateImage(
  file: File,
  bytes: Uint8Array,
): Promise<StoredImage | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "semobicn/localizacoes";
  const type = "authenticated";
  const signatureBase = `folder=${folder}&timestamp=${timestamp}&type=${type}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");
  const form = new FormData();
  const uploadBytes = Uint8Array.from(bytes);
  form.append(
    "file",
    new Blob([uploadBytes.buffer], { type: file.type }),
    file.name,
  );
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("type", type);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    throw new Error("Falha ao armazenar a imagem de localização.");
  }

  const result = (await response.json()) as {
    secure_url: string;
    public_id: string;
    format: string;
  };
  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
  };
}

export async function storeInstitutionalLogo(
  file: File,
  bytes: Uint8Array,
): Promise<StoredImage | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "semobicn/institucional";
  const type = "authenticated";
  const signatureBase = `folder=${folder}&timestamp=${timestamp}&type=${type}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");
  const form = new FormData();
  const uploadBytes = Uint8Array.from(bytes);
  form.append(
    "file",
    new Blob([uploadBytes.buffer], { type: file.type }),
    file.name,
  );
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("type", type);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    const details = await response.text();
    console.error("Falha no upload da logo institucional:", {
      status: response.status,
      details: details.slice(0, 500),
    });
    throw new Error("Falha ao armazenar a logo institucional.");
  }

  const result = (await response.json()) as {
    secure_url: string;
    public_id: string;
    format: string;
  };
  if (!result.public_id || !result.format || !result.secure_url) {
    throw new Error("O Cloudinary não confirmou o armazenamento da logo.");
  }
  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
  };
}

function encodePublicId(publicId: string) {
  return publicId
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function getSignedPrivateSourceUrl(publicId: string): string | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiSecret || !publicId) return null;

  const signature = createHash("sha1")
    .update(`${publicId}${apiSecret}`)
    .digest("base64url")
    .slice(0, 8);
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/raw/authenticated/s--${signature}--/${encodePublicId(publicId)}`;
}

export const getSignedPrivatePdfUrl = getSignedPrivateSourceUrl;

export function getSignedPrivateImageUrl(
  publicId: string,
  format: string,
): string | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiSecret || !publicId || !format) return null;

  const deliveryId = `${publicId}.${format}`;
  const signature = createHash("sha1")
    .update(`${deliveryId}${apiSecret}`)
    .digest("base64url")
    .slice(0, 8);
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/authenticated/s--${signature}--/${encodePublicId(publicId)}.${encodeURIComponent(format)}`;
}
