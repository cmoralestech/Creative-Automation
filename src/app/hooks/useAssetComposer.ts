import { useEffect, useMemo, useState } from "react";

import { DEFAULT_ASSET_METADATA, MAX_CHAT_ASSETS } from "@/app/page.constants";
import { getFileFingerprint } from "@/app/page.helpers";
import type { AssetMetadata } from "@/app/page.types";

export function useAssetComposer() {
  const [files, setFiles] = useState<File[]>([]);
  const [assetMetadataByKey, setAssetMetadataByKey] = useState<Record<string, AssetMetadata>>({});
  const [assetNotice, setAssetNotice] = useState<string | null>(null);

  const fileNames = useMemo(() => files.map((file) => file.name).join(", "), [files]);

  const assetPreviewUrls = useMemo(
    () =>
      files.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      assetPreviewUrls.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [assetPreviewUrls]);

  function appendSelectedAssets(incomingFiles: File[]) {
    if (incomingFiles.length === 0) {
      return;
    }

    setFiles((previousFiles) => {
      const combined = [...previousFiles, ...incomingFiles];
      const uniqueFiles: File[] = [];
      const seen = new Set<string>();

      for (const file of combined) {
        const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          uniqueFiles.push(file);
        }
      }

      const limited = uniqueFiles.slice(0, MAX_CHAT_ASSETS);
      setAssetMetadataByKey((prev) => {
        const next: Record<string, AssetMetadata> = {};
        for (const file of limited) {
          const key = getFileFingerprint(file);
          next[key] = prev[key] ?? { ...DEFAULT_ASSET_METADATA };
        }
        return next;
      });

      if (uniqueFiles.length > MAX_CHAT_ASSETS) {
        setAssetNotice(`You can attach up to ${MAX_CHAT_ASSETS} images.`);
      } else {
        setAssetNotice(null);
      }

      return limited;
    });
  }

  function removeAssetAt(indexToRemove: number) {
    setFiles((prev) => {
      const removed = prev[indexToRemove];
      const next = prev.filter((_, index) => index !== indexToRemove);

      if (removed) {
        const removedKey = getFileFingerprint(removed);
        setAssetMetadataByKey((metadata) => {
          const clone = { ...metadata };
          delete clone[removedKey];
          return clone;
        });
      }

      return next;
    });

    setAssetNotice(null);
  }

  function clearAssets() {
    setFiles([]);
    setAssetMetadataByKey({});
    setAssetNotice(null);
  }

  function updateAssetMetadata(index: number, next: Partial<AssetMetadata>) {
    const file = files[index];
    if (!file) {
      return;
    }

    const key = getFileFingerprint(file);
    setAssetMetadataByKey((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? DEFAULT_ASSET_METADATA),
        ...next,
      },
    }));
  }

  return {
    files,
    fileNames,
    assetMetadataByKey,
    assetNotice,
    assetPreviewUrls,
    appendSelectedAssets,
    removeAssetAt,
    clearAssets,
    updateAssetMetadata,
  };
}
