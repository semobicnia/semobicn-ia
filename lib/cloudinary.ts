import { createHash } from "node:crypto";

type StoredFile = {
  url: string;
  publicId: string;
};

export async function storePrivatePdf(
  file: File,
  bytes: Uint8Array,
): Promise<StoredFile | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "semobicn/croquis";
  const type = "authenticated";
  const signatureBase = `folder=${folder}&timestamp=${timestamp}&type=${type}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");
  const form = new FormData();
  const uploadBytes = Uint8Array.from(bytes);
  form.append(
    "file",
    new Blob([uploadBytes.buffer], { type: "application/pdf" }),
    file.name,
  );
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("type", type);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
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
