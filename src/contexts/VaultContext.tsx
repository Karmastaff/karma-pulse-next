"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

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

interface VaultContextType {
    folders: VaultFolder[];
    setFolders: React.Dispatch<React.SetStateAction<VaultFolder[]>>;
    activeFolderId: string | null;
    setActiveFolderId: React.Dispatch<React.SetStateAction<string | null>>;
    files: VaultFile[];
    setFiles: React.Dispatch<React.SetStateAction<VaultFile[]>>;
    isChatbotOpen: boolean;
    setIsChatbotOpen: React.Dispatch<React.SetStateAction<boolean>>;
    // New persistent sync methods
    createFolder: (name: string, type: DocumentType, company?: string) => Promise<string>;
    updateFolder: (id: string, updates: Partial<VaultFolder>) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;
    addFiles: (newFiles: VaultFile[]) => Promise<void>;
    updateFile: (id: string, updates: Partial<VaultFile>) => Promise<void>;
    deleteFile: (id: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
    const [folders, setFolders] = useState<VaultFolder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [files, setFiles] = useState<VaultFile[]>([]);
    const [isChatbotOpen, setIsChatbotOpen] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize files and folders from Supabase + Migration
    useEffect(() => {
        const init = async () => {
            console.log("[VAULT] Initializing from Supabase...");
            
            // 1. Fetch Folders
            const { data: dbFolders, error: folderError } = await supabase
                .from('vault_folders')
                .select('*')
                .order('created_at', { ascending: true });

            if (folderError) {
                console.error("[VAULT] CRITICAL: Error loading folders:", folderError.message || folderError);
            } else if (dbFolders) {
                setFolders(dbFolders.map(f => ({
                    id: f.id,
                    name: f.name,
                    createdAt: new Date(f.created_at).getTime(),
                    color: f.color,
                    company: f.company,
                    documentType: f.document_type as DocumentType
                })));
            }

            // 2. Fetch Files
            const { data: dbFiles, error: fileError } = await supabase
                .from('vault_files')
                .select('*')
                .order('uploaded_at', { ascending: false });

            if (fileError) {
                console.error("[VAULT] CRITICAL: Error loading files:", fileError.message || fileError);
            } else if (dbFiles) {
                const rehydratedFiles: VaultFile[] = await Promise.all(dbFiles.map(async (f) => {
                    const base: Omit<VaultFile, 'file'> = {
                        id: f.id,
                        folderId: f.folder_id,
                        uploadedAt: new Date(f.uploaded_at).getTime(),
                        company: f.company,
                        documentType: f.document_type as DocumentType,
                        dataUrl: f.data_url,
                    };
                    
                    if (f.data_url && f.data_url.startsWith('data:')) {
                        try {
                            const res = await fetch(f.data_url);
                            const blob = await res.blob();
                            const file = new File([blob], f.name, { type: f.type, lastModified: parseInt(f.last_modified) });
                            return { ...base, file };
                        } catch (e) {
                            console.error(`[VAULT] Failed to rehydrate file ${f.name}:`, e);
                        }
                    }
                    
                    return { ...base, file: new File([], f.name, { type: f.type, lastModified: parseInt(f.last_modified) }) };
                }));
                setFiles(rehydratedFiles);
            }

            // 3. One-time Migration from localStorage
            try {
                const localFolders = localStorage.getItem('karma_vault_folders');
                const localFiles = localStorage.getItem('karma_vault_files');
                
                if (localFolders || localFiles) {
                    console.log("[VAULT] Found legacy local data. Migrating to Supabase...");
                    const foldersToMigrate: VaultFolder[] = localFolders ? JSON.parse(localFolders) : [];
                    const filesToMigrate: any[] = localFiles ? JSON.parse(localFiles) : [];
                    
                    // Filter out folders that already exist in DB
                    const existingIds = new Set((dbFolders || []).map(f => f.id));
                    const newFolders = foldersToMigrate.filter(f => !existingIds.has(f.id));
                    
                    if (newFolders.length > 0) {
                        await supabase.from('vault_folders').upsert(newFolders.map(f => ({
                            id: f.id,
                            name: f.name,
                            color: f.color,
                            company: f.company,
                            document_type: f.documentType,
                            created_at: new Date(f.createdAt).toISOString()
                        })));
                    }
                    
                    if (filesToMigrate.length > 0) {
                        const existingFileIds = new Set((dbFiles || []).map(f => f.id));
                        const newFiles = filesToMigrate.filter(f => !existingFileIds.has(f.id));
                        if (newFiles.length > 0) {
                            await supabase.from('vault_files').upsert(newFiles.map(f => ({
                                id: f.id,
                                name: f.name || f.file?.name,
                                type: f.type || f.file?.type,
                                size: f.size || f.file?.size,
                                last_modified: f.last_modified || f.file?.lastModified,
                                folder_id: f.folder_id || f.folderId,
                                data_url: f.data_url || f.dataUrl,
                                company: f.company,
                                document_type: f.document_type || f.documentType || 'sla',
                                uploaded_at: new Date(f.uploaded_at || f.uploadedAt).toISOString()
                            })));
                        }
                    }
                    
                    // Clear local storage after migration
                    localStorage.removeItem('karma_vault_folders');
                    localStorage.removeItem('karma_vault_files');
                    console.log("[VAULT] Migration complete.");
                    
                    // Re-init if we migrated
                    if (newFolders.length > 0 || (filesToMigrate.length > 0)) {
                        window.location.reload(); 
                        return;
                    }
                }
            } catch (e) {
                console.error("[VAULT] Migration error:", e);
            }

            setIsInitialized(true);
        };
        init();
    }, []);

    // Subscribe to real-time changes
    useEffect(() => {
        if (!isInitialized) return;

        console.log("[VAULT] Setting up real-time subscriptions...");

        const folderSub = supabase
            .channel('vault_folders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_folders' }, (payload: any) => {
                const f = payload.new;
                if (payload.eventType === 'INSERT') {
                    setFolders(prev => {
                        if (prev.find(x => x.id === f.id)) return prev;
                        return [...prev, {
                            id: f.id,
                            name: f.name,
                            createdAt: new Date(f.created_at).getTime(),
                            color: f.color,
                            company: f.company,
                            documentType: f.document_type as DocumentType
                        }];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    setFolders(prev => prev.map(old => old.id === f.id ? {
                        ...old,
                        name: f.name,
                        color: f.color,
                        company: f.company,
                        documentType: f.document_type as DocumentType
                    } : old));
                } else if (payload.eventType === 'DELETE') {
                    setFolders(prev => prev.filter(old => old.id === payload.old.id));
                }
            })
            .subscribe();

        const fileSub = supabase
            .channel('vault_files_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_files' }, async (payload: any) => {
                const f = payload.new;
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    // Optimistic check: if we already have this file with a dataUrl/File object, don't overwrite with skeleton
                    setFiles(prev => {
                        const exists = prev.find(x => x.id === f.id);
                        if (exists && exists.dataUrl === f.data_url && exists.folderId === f.folder_id && exists.company === f.company) return prev;
                        
                        // Otherwise, rehydrate/update
                        const base: Omit<VaultFile, 'file'> = {
                            id: f.id,
                            folderId: f.folder_id,
                            uploadedAt: new Date(f.uploaded_at).getTime(),
                            company: f.company,
                            documentType: f.document_type as DocumentType,
                            dataUrl: f.data_url,
                        };
                        
                        if (exists) return prev.map(x => x.id === f.id ? { ...base, file: x.file } : x);
                        return [{ ...base, file: new File([], f.name, { type: f.type, lastModified: parseInt(f.last_modified) }) }, ...prev];
                    });
                } else if (payload.eventType === 'DELETE') {
                    setFiles(prev => prev.filter(old => old.id === payload.old.id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(folderSub);
            supabase.removeChannel(fileSub);
        };
    }, [isInitialized]);

    // ── Direct Database Action Methods ──────────────────────────────────────────

    const createFolder = async (name: string, type: DocumentType, company?: string) => {
        const id = crypto.randomUUID();
        const newFolder: VaultFolder = {
            id,
            name,
            createdAt: Date.now(),
            color: '#f59e0b',
            company,
            documentType: type
        };

        // Optimistic update
        setFolders(prev => [...prev, newFolder]);

        const { error } = await supabase.from('vault_folders').insert({
            id,
            name,
            document_type: type,
            company: company || null,
            color: '#f59e0b',
            created_at: new Date(newFolder.createdAt).toISOString()
        });
        if (error) {
            setFolders(prev => prev.filter(f => f.id !== id)); // rollback
            throw error;
        }
        return id;
    };

    const updateFolder = async (id: string, updates: Partial<VaultFolder>) => {
        // Optimistic update
        setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

        const dbUpdates: any = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        if (updates.company !== undefined) dbUpdates.company = updates.company || null;
        if (updates.documentType !== undefined) dbUpdates.document_type = updates.documentType;

        const { error } = await supabase.from('vault_folders').update(dbUpdates).match({ id });
        if (error) {
            // Hard refresh on error to revert state
            console.error(error);
            window.location.reload();
        }
    };

    const deleteFolder = async (id: string) => {
        // Optimistic
        setFolders(prev => prev.filter(f => f.id !== id));
        setFiles(prev => prev.filter(f => f.folderId !== id));

        const { error } = await supabase.from('vault_folders').delete().match({ id });
        if (error) {
            console.error(error);
            window.location.reload();
        }
    };

    const addFiles = async (newFiles: VaultFile[]) => {
        // Optimistic
        setFiles(prev => [...newFiles, ...prev]);

        const payload = newFiles.map(vf => ({
            id: vf.id,
            name: vf.file.name,
            type: vf.file.type,
            size: vf.file.size,
            last_modified: vf.file.lastModified,
            folder_id: vf.folderId,
            data_url: vf.dataUrl,
            company: vf.company || null,
            document_type: vf.documentType,
            uploaded_at: new Date(vf.uploadedAt).toISOString()
        }));
        const { error } = await supabase.from('vault_files').insert(payload);
        if (error) {
            setFiles(prev => prev.filter(f => !newFiles.find(nf => nf.id === f.id)));
            throw error;
        }
    };

    const updateFile = async (id: string, updates: Partial<VaultFile>) => {
        // Optimistic
        setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

        const dbUpdates: any = {};
        if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId;
        if (updates.company !== undefined) dbUpdates.company = updates.company || null;
        if (updates.file?.name !== undefined) dbUpdates.name = updates.file.name;
        
        const { error } = await supabase.from('vault_files').update(dbUpdates).match({ id });
        if (error) {
            console.error(error);
        }
    };

    const deleteFile = async (id: string) => {
        // Optimistic
        setFiles(prev => prev.filter(f => f.id !== id));

        const { error } = await supabase.from('vault_files').delete().match({ id });
        if (error) {
            console.error(error);
        }
    };


    if (!isInitialized) {
        return null; // or a loading spinner if preferred, to prevent hydration mismatch
    }

    return (
        <VaultContext.Provider value={{ 
            folders, setFolders, 
            activeFolderId, setActiveFolderId, 
            files, setFiles, 
            isChatbotOpen, setIsChatbotOpen,
            createFolder, updateFolder, deleteFolder,
            addFiles, updateFile, deleteFile
        }}>
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
