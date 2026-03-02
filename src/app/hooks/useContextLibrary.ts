import { useEffect, useMemo, useState } from "react";

import type { ContextLibraryFile, ContextLibraryViewModel } from "@/app/page.types";

export function useContextLibrary(): ContextLibraryViewModel {
  const [files, setFiles] = useState<ContextLibraryFile[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const dirty = useMemo(() => content !== originalContent, [content, originalContent]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/context");
        const body = (await response.json()) as { files?: ContextLibraryFile[]; error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? "Failed to load context library.");
        }
        setFiles(body.files ?? []);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Failed to load context library.";
        setError(message);
      }
    })();
  }, []);

  function updateContent(value: string) {
    setContent(value);
    setStatus(null);
  }

  function togglePanel() {
    setPanelOpen((prev) => !prev);
  }

  async function selectPath(path: string) {
    if (dirty && selectedPath && selectedPath !== path) {
      const proceed = window.confirm("You have unsaved context changes. Discard them?");
      if (!proceed) {
        return;
      }
    }

    setLoading(true);
    setError(null);
    setStatus(null);
    setLastSavedAt(null);
    setSelectedPath(path);

    try {
      const response = await fetch(`/api/context?path=${encodeURIComponent(path)}`);
      const body = (await response.json()) as { content?: string; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load context file.");
      }

      const nextContent = body.content ?? "";
      setContent(nextContent);
      setOriginalContent(nextContent);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load context file.";
      setError(message);
      setContent("");
      setOriginalContent("");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!selectedPath) {
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: selectedPath, content }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save context file.");
      }

      setOriginalContent(content);
      setStatus(`Saved ${selectedPath}`);
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to save context file.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return {
    files,
    panelOpen,
    selectedPath,
    content,
    loading,
    saving,
    dirty,
    error,
    status,
    lastSavedAt,
    togglePanel,
    selectPath: (path) => {
      void selectPath(path);
    },
    updateContent,
    save: () => {
      void save();
    },
  };
}
