'use client';

import { useState, useRef, useEffect as useScrollEffect, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Bot, UploadCloud, Folder, FileKey, Layers, FileSignature, CheckCircle2, ChevronRight, BarChart3, Clock, AlertCircle, Plus, Edit2, FolderOpen, ArrowRight, X, Trash2, Search, Copy, ThumbsUp, ThumbsDown, Pin, Share2, RefreshCcw, MoreHorizontal, Shield, Mic, MicOff, Palette, Eye, BookOpen } from 'lucide-react';
import { useVault, VaultFile, DocumentType } from "@/contexts/VaultContext";
import { supabase } from '@/lib/supabaseClient';
import ReactMarkdown from 'react-markdown';


export default function SLAVault() {
    const [isDragging, setIsDragging] = useState(false);
    const { 
        folders, setFolders, activeFolderId, setActiveFolderId, 
        files, isChatbotOpen, setIsChatbotOpen,
        createFolder, updateFolder, deleteFolder,
        addFiles, updateFile, deleteFile
    } = useVault();

    // Current logged-in user (for company scoping)
    const [currentUser, setCurrentUser] = useState<{ name: string; company: string; role: string } | null>(null);
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);

    useEffect(() => {
        // Fetch current user
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : null)
            .then(data => { 
                if (data?.user) {
                    setCurrentUser(data.user);
                    // If super admin, fetch all users to get unique companies
                    if (data.user.role === 'superadmin') {
                        fetch('/api/admin/users')
                            .then(r => r.ok ? r.json() : null)
                            .then(res => {
                                if (res?.users) {
                                    const companies = Array.from(new Set(res.users.map((u: any) => u.company))).filter(Boolean) as string[];
                                    setAvailableCompanies(companies);
                                    if (companies.length > 0) setNewFolderCompany(companies[0]);
                                }
                            })
                            .catch(() => {});
                    }
                }
            })
            .catch(() => {});
    }, []);

    // Company-scoped folder + file filter
    // Super admins see everything. Admins see their company + all IICRC docs.
    const visibleFolders = folders.filter(folder => {
        if (!currentUser || currentUser.role === 'superadmin') return true;
        if (folder.documentType === 'iicrc_standard') return true;
        
        const userCompany = currentUser.company?.trim().toLowerCase();
        const folderCompany = folder.company?.trim().toLowerCase();
        return folderCompany === userCompany;
    });

    // Derived state — scoped to visible folders only
    const displayedFiles = (() => {
        const scopedFolderIds = new Set(visibleFolders.map(f => f.id));
        const allVisible = files.filter(f => {
            if (!currentUser || currentUser.role === 'superadmin') return true;
            if (f.documentType === 'iicrc_standard') return true;
            
            // If the file belongs to a folder, inherit visibility from the folder
            if (f.folderId && scopedFolderIds.has(f.folderId)) return true;
            
            // Otherwise, rely on the file's explicit company tag
            const userCompany = currentUser.company?.trim().toLowerCase();
            const fileCompany = f.company?.trim().toLowerCase();
            return fileCompany === userCompany;
        });
        if (activeFolderId) return allVisible.filter(f => f.folderId === activeFolderId);
        return allVisible;
    })();

    const [activeVaultFileId, setActiveVaultFileId] = useState<string | null>(displayedFiles.length > 0 ? displayedFiles[0].id : null);
    const [processingState, setProcessingState] = useState<'idle' | 'uploading' | 'processing' | 'complete'>(files.length > 0 ? 'complete' : 'idle');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Chat history — each entry is one Q&A exchange
    type ChatMessage = {
        id: string;
        query: string;
        result: string;
        judgeStatus: string | null;
        validationResult: { status: string; correction: string; sourceQuote: string; confidenceScore: number } | null;
        actionState: { copied: boolean; liked: boolean; disliked: boolean; pinned: boolean; shared: boolean };
    };
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    // Auto-scroll to bottom of chat on new messages
    const chatScrollRef = useRef<HTMLDivElement>(null);
    useScrollEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, isSearching]);

    const handleClearChat = () => setChatMessages([]);

    // Per-message action handler
    const handleMessageAction = (msgId: string, action: 'copied' | 'liked' | 'disliked' | 'pinned' | 'shared') => {
        setChatMessages(prev => prev.map(m => {
            if (m.id !== msgId) return m;
            if (action === 'copied') navigator.clipboard.writeText(m.result);
            const next = { ...m.actionState, [action]: !m.actionState[action] };
            if (action === 'liked' && next.liked) next.disliked = false;
            if (action === 'disliked' && next.disliked) next.liked = false;
            if (action === 'copied' || action === 'shared') {
                setTimeout(() => setChatMessages(p => p.map(x => x.id === msgId ? { ...x, actionState: { ...x.actionState, [action]: false } } : x)), 2000);
            }
            return { ...m, actionState: next };
        }));
    };

    // File viewer state
    const [viewingFileId, setViewingFileId] = useState<string | null>(null);
    const [viewingFileUrl, setViewingFileUrl] = useState<string | null>(null);
    const [viewingFileName, setViewingFileName] = useState<string>('');

    const openFileViewer = (e: React.MouseEvent, vf: VaultFile) => {
        e.stopPropagation();
        let url: string | null = null;
        if (vf.file && vf.file.size > 0) {
            // Fresh session: use live File object
            url = URL.createObjectURL(vf.file);
        } else if (vf.dataUrl) {
            // After page refresh: use stored base64 dataUrl
            url = vf.dataUrl;
        }
        setViewingFileUrl(url);
        setViewingFileId(vf.id);
        setViewingFileName(vf.file.name);
    };

    const closeFileViewer = () => {
        // Only revoke object:// blob URLs, not data: URLs
        if (viewingFileUrl && viewingFileUrl.startsWith('blob:')) {
            URL.revokeObjectURL(viewingFileUrl);
        }
        setViewingFileUrl(null);
        setViewingFileId(null);
        setViewingFileName('');
    };

    // Folder creation state
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderType, setNewFolderType] = useState<DocumentType>('sla');
    const [newFolderCompany, setNewFolderCompany] = useState<string>('');

    // Folder renaming state
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingFolderName, setEditingFolderName] = useState('');

    // Folder company assignment state (for Super Admins)
    const [sharingFolderId, setSharingFolderId] = useState<string | null>(null);
    const [sharingFileId, setSharingFileId] = useState<string | null>(null);

    // Folder color picker state
    const [colorPickerFolderId, setColorPickerFolderId] = useState<string | null>(null);

    // File renaming state
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editingFileName, setEditingFileName] = useState('');

    // Drag and drop state for files specifically to folders
    const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
    const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    // Curated folder color palette
    const FOLDER_COLORS = [
        { hex: '#f59e0b', label: 'Amber' },
        { hex: '#3b82f6', label: 'Blue' },
        { hex: '#10b981', label: 'Emerald' },
        { hex: '#8b5cf6', label: 'Violet' },
        { hex: '#ef4444', label: 'Red' },
        { hex: '#ec4899', label: 'Pink' },
        { hex: '#14b8a6', label: 'Teal' },
        { hex: '#f97316', label: 'Orange' },
        { hex: '#6366f1', label: 'Indigo' },
        { hex: '#e11d48', label: 'Rose' },
        { hex: '#06b6d4', label: 'Cyan' },
        { hex: '#84cc16', label: 'Lime' },
    ];

    const setFolderColor = async (id: string, color: string) => {
        await updateFolder(id, { color });
        setColorPickerFolderId(null);
    };

    const handleDragStartFile = (e: React.DragEvent, fileId: string) => {
        setDraggedFileId(fileId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', `file:${fileId}`);
    };

    const handleDragEndFile = () => {
        setDraggedFileId(null);
        setDragOverFolderId(null);
    };

    const handleDragStartFolder = (e: React.DragEvent, folderId: string) => {
        setDraggedFolderId(folderId);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', `folder:${folderId}`);
    };

    const handleDragEndFolder = () => {
        setDraggedFolderId(null);
        setDragOverFolderId(null);
    };

    const handleDragOverFolderTab = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverFolderId !== folderId) {
            setDragOverFolderId(folderId);
        }
    };

    const handleDragLeaveFolderTab = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOverFolderId(null);
    };

    const handleDropOnFolderTab = (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        setDragOverFolderId(null);

        const data = e.dataTransfer.getData('text/plain');

        // Handle Folder Reordering
        if (data.startsWith('folder:')) {
            const sourceFolderId = data.replace('folder:', '');
            if (targetFolderId && sourceFolderId !== targetFolderId) {
                setFolders(prev => {
                    const newFolders = [...prev];
                    const sourceIndex = newFolders.findIndex(f => f.id === sourceFolderId);
                    const targetIndex = newFolders.findIndex(f => f.id === targetFolderId);
                    if (sourceIndex === -1 || targetIndex === -1) return prev;
                    
                    const [draggedFolder] = newFolders.splice(sourceIndex, 1);
                    newFolders.splice(targetIndex, 0, draggedFolder);
                    return newFolders;
                });
            }
            setDraggedFolderId(null);
            return;
        }

        // Handle File Drop onto Folder
        if (!draggedFileId) return;

        updateFile(draggedFileId, { folderId: targetFolderId });
        setDraggedFileId(null);
    };

    // Global dragover for upload dropzone
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const simulateProcessing = () => {
        setProcessingState('uploading');
        setTimeout(() => {
            setProcessingState('processing');
            setTimeout(() => {
                setProcessingState('complete');
            }, 2000);
        }, 1500);
    };

    const handleNewFiles = async (newFiles: File[]) => {
        const getDataUrl = (file: File): Promise<string | undefined> =>
            new Promise(resolve => {
                if (file.size > 4 * 1024 * 1024) { resolve(undefined); return; } // skip >4MB
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => resolve(undefined);
                reader.readAsDataURL(file);
            });

        const newVaultFiles = await Promise.all(newFiles.map(async f => ({
            id: crypto.randomUUID(),
            file: f,
            folderId: activeFolderId,
            uploadedAt: Date.now(),
            dataUrl: await getDataUrl(f),
            // Tag with current user's company and infer documentType from active folder
            company: currentUser?.company,
            documentType: (folders.find(folder => folder.id === activeFolderId)?.documentType ?? 'sla') as DocumentType,
        })));

        await addFiles(newVaultFiles);
        setActiveVaultFileId(newVaultFiles[0].id);
        simulateProcessing();
    };

    const handleFolderSwitch = (newFolderId: string | null) => {
        setActiveFolderId(newFolderId);
        const newDisplayed = newFolderId ? files.filter(f => f.folderId === newFolderId) : files;
        setActiveVaultFileId(newDisplayed.length > 0 ? newDisplayed[0].id : null);

        // Auto-close any open edit states when switching views
        setEditingFolderId(null);
        setEditingFileId(null);
        setSharingFolderId(null);
        setSharingFileId(null);
        setColorPickerFolderId(null);
    };

    const onDeleteFile = async (e: React.MouseEvent, idToDelete: string) => {
        e.stopPropagation();
        await deleteFile(idToDelete);
        if (activeVaultFileId === idToDelete) setActiveVaultFileId(null);
    };

    const onDeleteFolder = async (e: React.MouseEvent, idToDelete: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this folder and all its SLAs?")) return;
        await deleteFolder(idToDelete);
        if (activeFolderId === idToDelete) setActiveFolderId(null);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) {
            setIsCreatingFolder(false);
            return;
        }
        // Auto-detect IICRC by name if user didn't explicitly pick
        const nameUpper = newFolderName.trim().toUpperCase();
        const detectedType: DocumentType = nameUpper.includes('IICRC') ? 'iicrc_standard' : newFolderType;
        const company = detectedType === 'iicrc_standard' ? undefined : (currentUser?.role === 'superadmin' && newFolderCompany ? newFolderCompany : currentUser?.company);
        
        const folderId = await createFolder(newFolderName.trim(), detectedType, company);
        setActiveFolderId(folderId);
        setIsCreatingFolder(false);
        setNewFolderName('');
        setNewFolderType('sla');
        if (availableCompanies.length > 0) setNewFolderCompany(availableCompanies[0]);
    };

    const handleKeyDownFolder = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCreateFolder();
        if (e.key === 'Escape') {
            setIsCreatingFolder(false);
            setNewFolderName('');
        }
    };

    const handleUpdateFolder = async () => {
        if (!editingFolderName.trim() || !editingFolderId) {
            setEditingFolderId(null);
            return;
        }
        await updateFolder(editingFolderId, { name: editingFolderName.trim() });
        setEditingFolderId(null);
        setEditingFolderName('');
    };

    const handleKeyDownEdit = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleUpdateFolder();
        if (e.key === 'Escape') setEditingFolderId(null);
    };

    const startEditingFolder = (folder: { id: string, name: string }) => {
        setEditingFolderId(folder.id);
        setEditingFolderName(folder.name);
    };

    const handleUpdateFile = async () => {
        if (!editingFileName.trim() || !editingFileId) {
            setEditingFileId(null);
            return;
        }
        const vf = files.find(f => f.id === editingFileId);
        if (vf) {
            const renamedFile = new File([vf.file], editingFileName.trim(), { type: vf.file.type, lastModified: vf.file.lastModified });
            await updateFile(editingFileId, { file: renamedFile });
        }
        setEditingFileId(null);
        setEditingFileName('');
    };

    const handleKeyDownFileEdit = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleUpdateFile();
        if (e.key === 'Escape') setEditingFileId(null);
    };

    const startEditingFile = (vf: VaultFile) => {
        setEditingFileId(vf.id);
        setEditingFileName(vf.file.name);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleNewFiles(Array.from(e.dataTransfer.files));
        }
    };

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleNewFiles(Array.from(e.target.files));
        }
    };

    const startListening = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();

            recognition.continuous = false;
            recognition.interimResults = true;

            recognition.onstart = () => setIsListening(true);

            recognition.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0])
                    .map((result: any) => result.transcript)
                    .join('');
                setSearchQuery(transcript);
            };

            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognition.onend = () => setIsListening(false);

            recognition.start();
        } else {
            alert("Speech recognition is not supported in your browser.");
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        const capturedQuery = searchQuery.trim();
        setSearchQuery('');
        setIsSearching(true);

        try {
            let documentContext = "";
            let documentBase64 = "";
            let documentType = "";
            let fileName = "";

            if (activeVaultFileId !== null) {
                const activeVaultFile = files.find(f => f.id === activeVaultFileId);
                if (activeVaultFile) {
                    const activeFile = activeVaultFile.file;
                    fileName = activeFile.name;
                    documentType = activeFile.type || "application/pdf";

                    const getBase64 = (file: File): Promise<string> => {
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = error => reject(error);
                        });
                    };

                    const dataUrl = await getBase64(activeFile);
                    documentBase64 = dataUrl.split(',')[1] || "";
                    documentContext = `The user is asking a question about the attached document named: "${fileName}". Please read the attached document carefully and answer the user's question based ONLY on it.`;
                }
            }

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: capturedQuery,
                    documentContext,
                    documentBase64,
                    documentType
                }),
            });

            if (!response.ok) throw new Error('Failed to fetch response from AI');

            const data = await response.json();
            const newMsg: ChatMessage = {
                id: crypto.randomUUID(),
                query: capturedQuery,
                result: data.error ? `Error: ${data.error}` : data.result,
                judgeStatus: data.judgeStatus ?? null,
                validationResult: data.validation ?? null,
                actionState: { copied: false, liked: false, disliked: false, pinned: false, shared: false },
            };
            setChatMessages(prev => [...prev, newMsg]);
        } catch (error) {
            console.error("AI Extractor Error:", error);
            const errorMsg: ChatMessage = {
                id: crypto.randomUUID(),
                query: capturedQuery,
                result: "I apologize, but I was unable to connect to the intelligence core right now. Please try again later.",
                judgeStatus: null,
                validationResult: null,
                actionState: { copied: false, liked: false, disliked: false, pinned: false, shared: false },
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">

            {/* ── File Preview Modal ── */}
            {viewingFileId && (
                <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                    {/* Modal header */}
                    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Document Preview</p>
                                <h3 className="font-bold text-slate-800 truncate max-w-[60vw]">{viewingFileName}</h3>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 italic hidden sm:block">Viewing only — downloading is disabled</span>
                            <button
                                onClick={closeFileViewer}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                                title="Close preview"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Viewer body */}
                    <div
                        className="flex-1 relative overflow-hidden"
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        {viewingFileUrl ? (
                            <iframe
                                src={currentUser?.role === 'superadmin' ? viewingFileUrl : `${viewingFileUrl}#toolbar=0`}
                                className="w-full h-full border-0"
                                title={viewingFileName}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-50">
                                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                                    <FileText className="w-8 h-8 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-700 mb-1">File content unavailable</h3>
                                    <p className="text-sm text-slate-500 max-w-sm">This file’s binary was not retained across the page refresh. Re-upload the file to preview it here, or use the AI chatbot to query it after re-uploading.</p>
                                </div>
                                <button onClick={closeFileViewer} className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors">
                                    Close
                                </button>
                            </div>
                        )}
                        {/* Overlay to suppress right-click save on PDF toolbar */}
                        <div className="absolute inset-0 pointer-events-none" style={{ userSelect: 'none' }} />
                    </div>
                </div>
            )}
            {/* AI Chatbot Toggle Button */}
            <button
                onClick={() => setIsChatbotOpen(!isChatbotOpen)}
                className={`fixed top-6 right-6 z-50 p-3 border rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2
                    ${isChatbotOpen
                        ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                        : 'bg-white border-amber-200 hover:bg-amber-50 group'
                    }`}
            >
                {isChatbotOpen ? <X className="w-5 h-5" /> : <Bot className="w-6 h-6 text-amber-500 group-hover:animate-pulse" />}
                {!isChatbotOpen && <span className="font-bold text-transparent bg-clip-text bg-gradient-primary pr-2">Karma AI Chatbot</span>}
            </button>

            {/* Chatbot Fixed Sidebar */}
            <div className={`fixed top-0 right-0 h-screen w-[450px] bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col transform transition-transform duration-500 ease-in-out ${isChatbotOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Chat Header */}
                <div className="p-6 pt-24 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shadow-inner shrink-0">
                        <Bot className="w-7 h-7 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-slate-800 leading-tight">Karma AI Assistant</h2>
                        <p className="text-sm text-muted-foreground">
                            {activeVaultFileId ? 'Ask specifically about this document.' : 'Select a document first.'}
                        </p>
                    </div>
                    {chatMessages.length > 0 && (
                        <button
                            onClick={handleClearChat}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700 transition-all shrink-0"
                            title="Clear chat history"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>

                {/* Chat Body (Scrollable) */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 pb-28">
                    {!activeVaultFileId ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                            <FileText className="w-12 h-12 text-slate-300 mb-3" />
                            <h3 className="font-semibold text-slate-600 mb-1">No Document Selected</h3>
                            <p className="text-sm text-slate-400">Please choose a file from the vault to ask questions about.</p>
                        </div>
                    ) : (
                        <>
                            {/* Empty State / Welcome Screen */}
                            {chatMessages.length === 0 && !isSearching && (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                                    <Bot className="w-12 h-12 text-slate-300 mb-3" />
                                    <h3 className="font-semibold text-slate-600 mb-1">How can I help you extract data?</h3>
                                    <p className="text-sm text-slate-400">Try asking a specific question like &quot;What is the timeline for uploading photos?&quot;</p>
                                </div>
                            )}

                            {/* Rendered message history */}
                            {chatMessages.map((msg) => (
                                <div key={msg.id} className="space-y-2 animate-in slide-in-from-bottom-2 fade-in duration-400">
                                    {/* User question bubble */}
                                    <div className="flex justify-end">
                                        <div className="max-w-[85%] px-4 py-2.5 bg-slate-800 text-white text-sm rounded-2xl rounded-br-sm shadow-sm">
                                            {msg.query}
                                        </div>
                                    </div>

                                    {/* AI answer bubble */}
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-1">
                                            <Bot className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div className="p-5 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm relative overflow-hidden flex-1 min-w-0">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-amber-500" />

                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-semibold text-xs text-amber-600 uppercase tracking-wider">Karma AI Extraction</h4>
                                                {msg.judgeStatus && (
                                                    <Badge variant="outline" className={`text-[10px] font-bold shadow-sm ${
                                                        msg.judgeStatus === 'Verified by AI' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        msg.judgeStatus === 'AI Corrected' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        msg.judgeStatus === 'Needs Human Review' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {msg.judgeStatus}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="text-slate-700 leading-relaxed text-sm max-w-none prose-p:my-2 prose-p:first:mt-0 prose-ul:my-2 prose-li:my-1 prose-strong:text-slate-900 prose-ul:list-disc prose-ul:pl-5 pl-1 mb-4">
                                                <ReactMarkdown>{msg.result}</ReactMarkdown>
                                            </div>

                                            {/* Validation block */}
                                            {msg.validationResult && (
                                                <div className="mt-4 mb-4 p-3 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden">
                                                    <div className={`absolute top-0 left-0 w-1 h-full ${
                                                        msg.validationResult.status === 'MATCH' ? 'bg-green-500' :
                                                        msg.validationResult.status === 'MISMATCH' ? 'bg-red-500' : 'bg-amber-500'
                                                    }`} />
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Shield className={`w-4 h-4 ${
                                                                msg.validationResult.status === 'MATCH' ? 'text-green-600' :
                                                                msg.validationResult.status === 'MISMATCH' ? 'text-red-600' : 'text-amber-600'
                                                            }`} />
                                                            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">Karma Auditor Status</span>
                                                        </div>
                                                        <Badge variant="outline" className={`text-[10px] font-bold ${
                                                            msg.validationResult.status === 'MATCH' ? 'bg-green-50 text-green-700 border-green-200' :
                                                            msg.validationResult.status === 'MISMATCH' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {msg.validationResult.status} {msg.validationResult.confidenceScore && `• ${msg.validationResult.confidenceScore}%`}
                                                        </Badge>
                                                    </div>
                                                    <div className="space-y-2 mt-2">
                                                        {msg.validationResult.status !== 'MATCH' && msg.validationResult.correction && (
                                                            <div className="text-xs">
                                                                <span className="font-semibold text-slate-700 block mb-0.5">Correction:</span>
                                                                <span className="text-slate-600">{msg.validationResult.correction}</span>
                                                            </div>
                                                        )}
                                                        {msg.validationResult.sourceQuote && (
                                                            <div className="text-xs">
                                                                <span className="font-semibold text-slate-700 block mb-0.5">Source Quote:</span>
                                                                <span className="text-slate-500 italic">&quot;{msg.validationResult.sourceQuote}&quot;</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Per-message action bar */}
                                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 text-slate-400">
                                                <button onClick={() => handleMessageAction(msg.id, 'copied')} className={`p-1.5 rounded-md transition-colors ${msg.actionState.copied ? 'text-green-600 bg-green-50' : 'hover:bg-slate-100 hover:text-slate-600'}`} title="Copy">
                                                    {msg.actionState.copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                                <button onClick={() => handleMessageAction(msg.id, 'liked')} className={`p-1.5 rounded-md transition-colors ${msg.actionState.liked ? 'text-blue-600 bg-blue-50' : 'hover:bg-slate-100 hover:text-slate-600'}`} title="Helpful">
                                                    <ThumbsUp className={`w-4 h-4 ${msg.actionState.liked ? 'fill-blue-600' : ''}`} />
                                                </button>
                                                <button onClick={() => handleMessageAction(msg.id, 'disliked')} className={`p-1.5 rounded-md transition-colors ${msg.actionState.disliked ? 'text-red-500 bg-red-50' : 'hover:bg-slate-100 hover:text-slate-600'}`} title="Not Helpful">
                                                    <ThumbsDown className={`w-4 h-4 ${msg.actionState.disliked ? 'fill-red-500' : ''}`} />
                                                </button>
                                                <button onClick={() => handleMessageAction(msg.id, 'pinned')} className={`p-1.5 rounded-md transition-colors ${msg.actionState.pinned ? 'text-amber-600 bg-amber-50' : 'hover:bg-slate-100 hover:text-slate-600'}`} title="Pin Message">
                                                    <Pin className={`w-4 h-4 ${msg.actionState.pinned ? 'fill-amber-600' : ''}`} />
                                                </button>
                                                <button onClick={() => handleMessageAction(msg.id, 'shared')} className={`p-1.5 rounded-md transition-colors ${msg.actionState.shared ? 'text-indigo-600 bg-indigo-50' : 'hover:bg-slate-100 hover:text-slate-600'}`} title="Share Response">
                                                    <Share2 className="w-4 h-4" />
                                                </button>
                                                <button className="p-1.5 hover:bg-slate-100 hover:text-slate-600 rounded-md transition-colors ml-auto" title="More Options" onClick={() => alert('More options coming soon!')}>
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Loading bubble at bottom of history */}
                            {isSearching && (
                                <div className="flex gap-3 animate-in fade-in duration-300">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 shrink-0 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div className="p-4 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                                        <p className="text-sm text-slate-600 font-medium">Scanning SLA guidelines for answer...</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Chat Input (Sticky Bottom) */}
                <div className="p-4 bg-white border-t border-slate-100 flex gap-2 items-center absolute bottom-0 w-full left-0 z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                    <div className="relative flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-full focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all shadow-inner px-2 py-1.5">
                        <button
                            onClick={startListening}
                            disabled={!activeVaultFileId}
                            className={`p-2 rounded-full transition-colors mr-1 ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-slate-200 text-slate-500'} disabled:opacity-50`}
                            title={isListening ? "Listening..." : "Talk to AI"}
                        >
                            {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder={activeVaultFileId ? "Ask a question or tap mic to speak..." : "Select a document first"}
                            disabled={!activeVaultFileId}
                            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm py-2 disabled:opacity-50"
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={isSearching || !searchQuery.trim() || !activeVaultFileId}
                        size="icon"
                        className="w-12 h-12 rounded-full bg-gradient-primary text-white shadow-md hover:shadow-lg hover:bg-primary transition-all shrink-0"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Main Page Content (Shifts left when chat opens) */}
            <div className={`transition-transform duration-500 ease-in-out w-full max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in ${isChatbotOpen ? '-translate-x-12 sm:-translate-x-24 md:-translate-x-40 lg:-translate-x-60 xl:-translate-x-52' : 'translate-x-0'}`}>

                <div className="flex items-start gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center shrink-0 overflow-hidden mt-1">
                        <img
                            src="/playbook-icon.png"
                            alt="Playbook"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <div className="border-l-4 border-primary/70 pl-4">
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground leading-tight">The Playbook</h1>
                        <p className="mt-1.5 text-base">
                            <span className="italic text-slate-400 font-medium">Amateurs guess; professionals know.</span>
                            <span className="mx-2 text-slate-300">·</span>
                            <span className="font-semibold text-primary">This is your source of truth!</span>
                        </p>
                    </div>
                </div>

                <Card className="glass-card">
                    <CardContent className="p-0">
                        {processingState !== 'uploading' && processingState !== 'processing' && (
                            <label
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                className={`flex justify-center border-dashed rounded-xl cursor-pointer transition-all duration-300
                                ${isDragging ? 'border-primary bg-primary/5 shadow-inner' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}
                                ${files.length > 0 ? 'flex-row items-center gap-4 py-6 px-4 m-8 border-2' : 'flex-col items-center p-12 m-8 border-2'}
                            `}
                            >
                                <input type="file" multiple className="hidden" onChange={onFileInput} accept=".pdf,.txt,.docx" />

                                {files.length > 0 ? (
                                    <>
                                        <UploadCloud className={`w-8 h-8 shrink-0 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <div className="flex-1 max-w-sm">
                                            <h3 className="text-base font-semibold text-foreground">Upload Additional Documents</h3>
                                            <p className="text-xs text-muted-foreground">Drag & drop or browse for more guidelines</p>
                                        </div>
                                        <span className="shrink-0 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 pointer-events-none">Browse</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-4 bg-slate-100 rounded-full mb-4 shadow-sm border border-slate-200">
                                            <UploadCloud className={`w-10 h-10 ${isDragging ? 'text-primary' : 'text-slate-400'}`} />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2 text-foreground">Drag & Drop SLA Document</h3>
                                        <p className="text-muted-foreground text-center max-w-sm mb-6">
                                            Supports PDF, DOCX, or text files. The Antigravity Guardian will extract milestones automatically.
                                        </p>
                                        <span className="px-6 py-2.5 bg-gradient-primary text-white rounded-md text-sm font-semibold shadow-md hover:shadow-lg hover:opacity-90 transition-all pointer-events-none">Browse Files</span>
                                    </>
                                )}
                            </label>
                        )}

                        {(processingState === 'uploading' || processingState === 'processing') && (
                            <div className="flex flex-col items-center justify-center p-16 py-24">
                                <div className="relative w-20 h-20 mb-6">
                                    <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin" />
                                    <FileText className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-primary" />
                                </div>
                                <h2 className="text-2xl font-semibold mb-2">
                                    {processingState === 'uploading' ? 'Uploading Document...' : 'Extracting Rules using AI...'}
                                </h2>
                                <p className="text-muted-foreground">
                                    {processingState === 'uploading'
                                        ? `Securely transmitting document(s) to Vault`
                                        : 'Analyzing Contact Times, Photo Requirements, and assigning Gravity scores.'}
                                </p>
                            </div>
                        )}

                        {files.length > 0 && (
                            <div className="p-8 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">

                                {/* Folders Section */}
                                <div className="mb-8">
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Workspace Folders</h2>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            onClick={() => handleFolderSwitch(null)}
                                            onDragOver={(e) => handleDragOverFolderTab(e, null)}
                                            onDragLeave={handleDragLeaveFolderTab}
                                            onDrop={(e) => handleDropOnFolderTab(e, null)}
                                            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-base font-medium transition-all ${dragOverFolderId === null
                                                ? 'bg-slate-700 text-white shadow-lg ring-2 ring-slate-400 transform scale-105'
                                                : activeFolderId === null
                                                    ? 'bg-slate-800 text-white shadow-md'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <FolderOpen className="w-5 h-5 shrink-0" /> All SLAs
                                        </button>

                                        {visibleFolders.map(folder => (
                                            editingFolderId === folder.id ? (
                                                <div key={folder.id} className="flex items-center gap-2 bg-white border border-amber-400 rounded-lg p-1 shadow-sm ring-1 ring-amber-100 h-10">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        value={editingFolderName}
                                                        onChange={(e) => setEditingFolderName(e.target.value)}
                                                        onKeyDown={handleKeyDownEdit}
                                                        placeholder="Rename folder..."
                                                        className="w-32 px-3 py-1 text-sm outline-none bg-transparent"
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50 hover:text-green-700 rounded" onClick={handleUpdateFolder}>
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded" onClick={() => setEditingFolderId(null)}>
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div 
                                                    key={folder.id} 
                                                    className={`relative group flex items-center transition-all ${draggedFolderId === folder.id ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}
                                                    draggable
                                                    onDragStart={(e) => handleDragStartFolder(e, folder.id)}
                                                    onDragEnd={handleDragEndFolder}
                                                >
                                                    {/* Color Picker Popover */}
                                                    {colorPickerFolderId === folder.id && (
                                                        <>
                                                            {/* Backdrop to close picker */}
                                                            <div
                                                                className="fixed inset-0 z-20"
                                                                onClick={() => setColorPickerFolderId(null)}
                                                            />
                                                            <div className="absolute top-full left-0 mt-2 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-[176px] animate-in fade-in zoom-in-95 duration-150">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Folder Color</p>
                                                                <div className="grid grid-cols-4 gap-1.5 mb-3">
                                                                    {FOLDER_COLORS.map(({ hex, label }) => (
                                                                        <button
                                                                            key={hex}
                                                                            title={label}
                                                                            onClick={(e) => { e.stopPropagation(); setFolderColor(folder.id, hex); }}
                                                                            className="w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 hover:shadow-md"
                                                                            style={{
                                                                                backgroundColor: hex,
                                                                                borderColor: folder.color === hex ? hex : 'transparent',
                                                                                boxShadow: folder.color === hex ? `0 0 0 2px white, 0 0 0 4px ${hex}` : undefined
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </div>
                                                        </div>
                                                    </>
                                                )}

                                                {currentUser?.role === 'superadmin' && folder.documentType !== 'iicrc_standard' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSharingFolderId(sharingFolderId === folder.id ? null : folder.id); setSharingFileId(null); }}
                                                        className="absolute right-14 p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600/70 hover:text-emerald-700 transition-all"
                                                        title="Share / Assign Company"
                                                    >
                                                        <Share2 className="w-4 h-4" />
                                                    </button>
                                                )}

                                                    <button
                                                        onClick={() => handleFolderSwitch(folder.id)}
                                                        onDragOver={(e) => handleDragOverFolderTab(e, folder.id)}
                                                        onDragLeave={handleDragLeaveFolderTab}
                                                        onDrop={(e) => handleDropOnFolderTab(e, folder.id)}
                                                        className={`flex items-center gap-2.5 pl-5 pr-28 py-2.5 rounded-xl text-base font-medium transition-all border ${
                                                            dragOverFolderId === folder.id
                                                                ? 'shadow-lg ring-2 transform scale-105 z-10 text-white'
                                                                : activeFolderId === folder.id
                                                                    ? 'shadow-sm'
                                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                        style={dragOverFolderId === folder.id ? {
                                                            backgroundColor: folder.color ?? '#f59e0b',
                                                            borderColor: folder.color ?? '#f59e0b',
                                                        } : activeFolderId === folder.id ? {
                                                            backgroundColor: `${folder.color ?? '#f59e0b'}18`,
                                                            borderColor: `${folder.color ?? '#f59e0b'}60`,
                                                            color: folder.color ?? '#d97706',
                                                        } : {
                                                            borderColor: undefined,
                                                        }}
                                                    >
                                                        <Folder
                                                            className="w-5 h-5 shrink-0 pointer-events-none"
                                                            style={{ color: folder.color ?? '#f59e0b', fill: folder.color ?? '#f59e0b' }}
                                                        />
                                                        {folder.name}
                                                    </button>

                                                    {/* Palette (color picker) button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setColorPickerFolderId(colorPickerFolderId === folder.id ? null : folder.id); }}
                                                        className="absolute right-8 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                                                        title="Folder Settings & Color"
                                                    >
                                                        <Palette className="w-4 h-4" />
                                                    </button>

                                                    {/* Rename button */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); startEditingFolder(folder); }}
                                                        className="absolute right-1.5 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                                                        title="Rename Folder"
                                                    >
                                                        <Edit2 className="w-4 h-4" strokeWidth={2.5} />
                                                    </button>

                                                    {/* Delete button (Super Admins only) */}
                                                    {currentUser?.role === 'superadmin' && (
                                                        <button
                                                            onClick={(e) => onDeleteFolder(e, folder.id)}
                                                            className="absolute right-[-2.5rem] p-1.5 rounded-lg hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                            title="Delete Folder"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        ))}

                                        {isCreatingFolder && (
                                            <div className="flex items-center gap-2 bg-white border border-amber-400 rounded-lg p-1 shadow-sm ring-1 ring-amber-100 h-10">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={newFolderName}
                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                    onKeyDown={handleKeyDownFolder}
                                                    placeholder="Folder name..."
                                                    className="w-32 px-3 py-1 text-sm outline-none bg-transparent"
                                                />
                                                {currentUser?.role === 'superadmin' && (
                                                    <div className="flex items-center gap-1">
                                                        <select
                                                            value={newFolderType}
                                                            onChange={(e) => setNewFolderType(e.target.value as DocumentType)}
                                                            className="px-2 py-1 text-xs outline-none bg-slate-50 border border-slate-200 rounded"
                                                        >
                                                            <option value="sla">Company SLA</option>
                                                            <option value="iicrc_standard">IICRC Universal</option>
                                                        </select>

                                                        {newFolderType === 'sla' && availableCompanies.length > 0 && (
                                                            <select
                                                                value={newFolderCompany}
                                                                onChange={(e) => setNewFolderCompany(e.target.value)}
                                                                className="px-2 py-1 text-xs outline-none bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-medium"
                                                            >
                                                                {availableCompanies.map(c => (
                                                                    <option key={c} value={c}>Assign: {c}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                )}
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50 hover:text-green-700 rounded" onClick={handleCreateFolder}>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded" onClick={() => setIsCreatingFolder(false)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setIsCreatingFolder(true)}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-base font-medium text-slate-500 hover:text-amber-600 hover:bg-amber-50/50 transition-colors border border-dashed border-slate-300 hover:border-amber-300"
                                        >
                                            <Plus className="w-5 h-5" /> Add Folder
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold">Processed SLAs ({displayedFiles.length})</h2>
                                </div>

                                <div className="space-y-4 mb-10 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {displayedFiles.length === 0 ? (
                                        <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
                                            <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                            <p>No SLAs uploaded to this folder yet.</p>
                                        </div>
                                    ) : (
                                        displayedFiles.map((vf) => (
                                            <div
                                                key={vf.id}
                                                draggable={editingFileId !== vf.id}
                                                onDragStart={(e) => handleDragStartFile(e, vf.id)}
                                                onDragEnd={handleDragEndFile}
                                                onClick={() => {
                                                    setActiveVaultFileId(vf.id);
                                                    // If we were editing a different file and clicked this one, auto-close the edit
                                                    if (editingFileId && editingFileId !== vf.id) {
                                                        setEditingFileId(null);
                                                    }
                                                }}
                                                className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-all border shadow-sm ${draggedFileId === vf.id ? 'opacity-50 border-dashed border-slate-400 scale-[0.98]' :
                                                    activeVaultFileId === vf.id
                                                        ? 'bg-blue-50/50 border-primary ring-1 ring-primary/20 shadow-md'
                                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md'
                                                    }`}
                                            >
                                                {activeVaultFileId === vf.id ? (
                                                    <CheckCircle2 className="w-6 h-6 shrink-0 text-primary" />
                                                ) : (
                                                    <FileText className="w-6 h-6 shrink-0 text-slate-400" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    {editingFileId === vf.id ? (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                draggable={false}
                                                                onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                                value={editingFileName}
                                                                onChange={(e) => setEditingFileName(e.target.value)}
                                                                onKeyDown={handleKeyDownFileEdit}
                                                                className="flex-1 px-2 py-0.5 text-base font-semibold border border-amber-400 rounded outline-none ring-1 ring-amber-100 bg-white/80"
                                                                onClick={(e) => e.stopPropagation()}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                            />
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50 rounded" onClick={(e) => { e.stopPropagation(); handleUpdateFile(); }}>
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:bg-slate-100 rounded" onClick={(e) => { e.stopPropagation(); setEditingFileId(null); }}>
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center group/file">
                                                            <h3 className={`font-semibold truncate pr-2 ${activeVaultFileId === vf.id ? 'text-primary text-lg' : 'text-foreground'}`} title={vf.file.name}>
                                                                {vf.file.name}
                                                            </h3>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); startEditingFile(vf); }}
                                                                className={`p-2 rounded-lg opacity-0 group-hover/file:opacity-100 focus:opacity-100 hover:bg-blue-100/50 text-slate-400 hover:text-primary transition-all flex-shrink-0 ml-2`}
                                                                title="Rename File"
                                                            >
                                                                <Edit2 className="w-5 h-5" strokeWidth={2.5} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-muted-foreground mt-0.5">Rules mapped and ready for extraction.</p>
                                                </div>
                                                {activeVaultFileId === vf.id && (
                                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Active View</Badge>
                                                )}
                                                {currentUser?.role === 'superadmin' && vf.documentType !== 'iicrc_standard' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                                                        onClick={(e) => { e.stopPropagation(); setSharingFileId(sharingFileId === vf.id ? null : vf.id); setSharingFolderId(null); }}
                                                        title="Share / Assign Company"
                                                    >
                                                        <Share2 className="w-5 h-5" />
                                                    </Button>
                                                )}

                                                {/* View button */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-slate-400 hover:text-primary hover:bg-primary/10 shrink-0"
                                                    onClick={(e) => openFileViewer(e, vf)}
                                                    title="Preview file"
                                                >
                                                    <Eye className="w-5 h-5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                    onClick={(e) => onDeleteFile(e, vf.id)}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {activeVaultFileId !== null && displayedFiles.find(f => f.id === activeVaultFileId) && (() => {
                                    const activeFileContext = displayedFiles.find(f => f.id === activeVaultFileId)!;
                                    return (
                                        <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 mt-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <h3 className="text-xl font-bold text-slate-700">Active Document: <span className="text-primary">{activeFileContext.file.name}</span></h3>
                                            </div>
                                            <div className="flex items-start gap-4 p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl shadow-sm">
                                                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Bot className="w-5 h-5 text-amber-600" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-slate-800 mb-1">Use Karma AI to extract rules from this document</h4>
                                                    <p className="text-sm text-slate-600 mb-3">Ask the AI specific questions like <em>&quot;What are the contact time requirements?&quot;</em> or <em>&quot;What photos are required upon arrival?&quot;</em> to get accurate, source-cited answers directly from this SLA.</p>
                                                    <button
                                                        onClick={() => setIsChatbotOpen(true)}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg shadow-sm transition-all hover:shadow-md"
                                                    >
                                                        <Bot className="w-4 h-4" />
                                                        Open Karma AI Chatbot
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Share / Assign Modal (Floating overlay) */}
            {(sharingFolderId || sharingFileId) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm" onClick={() => { setSharingFolderId(null); setSharingFileId(null); }}>
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold flex items-center gap-2 text-slate-800 text-lg">
                                <Share2 className="w-5 h-5 text-emerald-600" /> 
                                Assign to Company
                            </h3>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => { setSharingFolderId(null); setSharingFileId(null); }}>
                                <X className="w-4 h-4 text-slate-400 outline-none" />
                            </Button>
                        </div>
                        
                        <p className="text-sm text-slate-500 mb-6">
                            Choose which company should have access to this {sharingFolderId ? 'entire folder and all its SLAs' : 'specific SLA document'}.
                        </p>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            <button
                                onClick={async () => {
                                    if (sharingFolderId) {
                                        await updateFolder(sharingFolderId, { company: undefined });
                                        const folderFiles = files.filter(f => f.folderId === sharingFolderId);
                                        await Promise.all(folderFiles.map(f => updateFile(f.id, { company: undefined })));
                                    } else if (sharingFileId) {
                                        await updateFile(sharingFileId, { company: undefined });
                                    }
                                    setSharingFolderId(null);
                                    setSharingFileId(null);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-xl border transition-all font-medium flex justify-between items-center ${
                                    (sharingFolderId ? !folders.find(f => f.id === sharingFolderId)?.company : !files.find(f => f.id === sharingFileId)?.company)
                                        ? 'bg-slate-100 border-slate-300 text-slate-800 ring-1 ring-slate-400'
                                        : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-500'
                                }`}
                            >
                                Unassigned (Hidden)
                                {(sharingFolderId ? !folders.find(f => f.id === sharingFolderId)?.company : !files.find(f => f.id === sharingFileId)?.company) && <CheckCircle2 className="w-4 h-4 text-slate-600" />}
                            </button>

                            {availableCompanies.map(c => {
                                const isSelected = sharingFolderId 
                                    ? folders.find(f => f.id === sharingFolderId)?.company === c
                                    : files.find(f => f.id === sharingFileId)?.company === c;

                                return (
                                    <button
                                        key={c}
                                        onClick={async () => {
                                            if (sharingFolderId) {
                                                await updateFolder(sharingFolderId, { company: c });
                                                const folderFiles = files.filter(f => f.folderId === sharingFolderId);
                                                await Promise.all(folderFiles.map(f => updateFile(f.id, { company: c })));
                                            } else if (sharingFileId) {
                                                await updateFile(sharingFileId, { company: c });
                                            }
                                            setSharingFolderId(null);
                                            setSharingFileId(null);
                                        }}
                                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all font-medium flex justify-between items-center ${
                                            isSelected 
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 ring-1 ring-emerald-500' 
                                                : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                                        }`}
                                    >
                                        {c}
                                        {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
