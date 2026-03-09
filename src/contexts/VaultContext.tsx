'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DocumentType = 'sla' | 'iicrc_standard';

export interface VaultFolder {
    id: string;
    name: string;
    createdAt: number;
    color?: string;
    company?: string;          // owning company — null/undefined = universal
    documentType?: DocumentType; // 'sla' | 'iicrc_standard'
}

export interface VaultFile {
    id: string;
    file: File;
    folderId: string | null;
    uploadedAt: number;
    dataUrl?: string;          // base64 for preview (persisted for files ≤ 4MB)
    company?: string;          // owning company
    documentType?: DocumentType;
}

interface SerializedVaultFile {
    id: string;
    name: string;
    type: string;
    size: number;
    lastModified: number;
    folderId: string | null;
    uploadedAt: number;
    dataUrl?: string;
    company?: string;
    documentType?: DocumentType;
}

interface VaultContextType {
    folders: VaultFolder[];
    setFolders: React.Dispatch<React.SetStateAction<VaultFolder[]>>;
    activeFolderId: string | null;
    setActiveFolderId: React.Dispatch<React.SetStateAction<string | null>>;
    files: VaultFile[];
    setFiles: React.Dispatch<React.SetStateAction<VaultFile[]>>;
    isChatbotOpen: boolean;
    setIsChatbotOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
    const [folders, setFolders] = useState<VaultFolder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [files, setFiles] = useState<VaultFile[]>([]);
    const [isChatbotOpen, setIsChatbotOpen] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize files and folders from localStorage
    useEffect(() => {
        const init = async () => {
            const storedFiles = localStorage.getItem('karmaPulse_SLA_Files_V2');
            const storedFolders = localStorage.getItem('karmaPulse_SLA_Folders');

            if (storedFolders) {
                try {
                    setFolders(JSON.parse(storedFolders));
                } catch (error) {
                    console.error("Error loading folders from local storage:", error);
                }
            }

            if (storedFiles) {
                try {
                    const parsedFiles: SerializedVaultFile[] = JSON.parse(storedFiles);

                    const rehydratedFiles: VaultFile[] = await Promise.all(parsedFiles.map(async (f) => {
                        const base: Omit<VaultFile, 'file'> = {
                            id: f.id,
                            folderId: f.folderId,
                            uploadedAt: f.uploadedAt,
                            company: f.company,
                            documentType: f.documentType,
                            dataUrl: f.dataUrl,
                        };
                        if (f.dataUrl) {
                            const res = await fetch(f.dataUrl);
                            const blob = await res.blob();
                            const file = new File([blob], f.name, { type: f.type, lastModified: f.lastModified });
                            return { ...base, file };
                        }
                        return { ...base, file: new File([], f.name, { type: f.type, lastModified: f.lastModified }) };
                    }));

                    setFiles(rehydratedFiles);
                    setIsInitialized(true);
                } catch (error) {
                    console.error("Error loading SLA metadata from localStorage:", error);
                    localStorage.removeItem('karmaPulse_SLA_Files_V2');
                    setIsInitialized(true);
                }
            } else {
                setIsInitialized(true);
            }
        };
        init();
    }, []);

    // Save files and folders to localStorage whenever they change
    useEffect(() => {
        if (!isInitialized) return; // Don't wipe localStorage on initial render before load

        // Save Folders
        localStorage.setItem('karmaPulse_SLA_Folders', JSON.stringify(folders));

        // Save Files — metadata only (no base64) to avoid QuotaExceededError.
        // Binary PDF content lives in-memory during the session; folder/name info persists across reloads.
        const saveFiles = () => {
            try {
                const serializedFiles: SerializedVaultFile[] = files.map(vf => ({
                    id: vf.id,
                    name: vf.file.name,
                    type: vf.file.type,
                    size: vf.file.size,
                    lastModified: vf.file.lastModified,
                    folderId: vf.folderId,
                    uploadedAt: vf.uploadedAt,
                    dataUrl: vf.dataUrl,
                    company: vf.company,
                    documentType: vf.documentType,
                }));
                localStorage.setItem('karmaPulse_SLA_Files_V2', JSON.stringify(serializedFiles));
            } catch (error) {
                console.error("Error saving SLA metadata to localStorage:", error);
                // Last resort: clear the key so the app stays functional
                try { localStorage.removeItem('karmaPulse_SLA_Files_V2'); } catch (_) { /* ignore */ }
            }
        };

        saveFiles();

    }, [files, folders, isInitialized]);

    if (!isInitialized) {
        return null; // or a loading spinner if preferred, to prevent hydration mismatch
    }

    return (
        <VaultContext.Provider value={{ folders, setFolders, activeFolderId, setActiveFolderId, files, setFiles, isChatbotOpen, setIsChatbotOpen }}>
            {children}
        </VaultContext.Provider>
    );
}

export function useVault() {
    const context = useContext(VaultContext);
    if (context === undefined) {
        throw new Error('useVault must be used within a VaultProvider');
    }
    return context;
}
