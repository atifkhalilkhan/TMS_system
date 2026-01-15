import { useParams } from "react-router";
import { useEffect, useState, useCallback } from "react";
import supabase from "../dbconfig/db";
import { message, Dropdown, DatePicker, Select, Modal } from "antd";
import {
    Plus, Hash, Search, Trash2, Edit2,
    Calendar as CalendarIcon, Flag, CircleDashed, ChevronDown, ChevronRight, MoreHorizontal
} from "lucide-react";
import { BABox, BAButton, BAModal, BAInput } from "basuite";
import dayjs from "dayjs";

export default function ProjectScreen() {
    const { projectId } = useParams();
    const [tickets, setTickets] = useState<any[]>([]);
    const [project, setProject] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    // bulk checkbox selection (for Select All & delete)
    const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
    // tracks which sections are in "bulk-mode" (after Select All)
    const [sectionBulkMode, setSectionBulkMode] = useState<Record<string, boolean>>({});

    // inline add inputs for sections
    const [newInlineTitles, setNewInlineTitles] = useState<Record<string, string>>({});

    // Modal-local editable ticket (staged); modalTicket.isNew == create mode
    const [modalTicket, setModalTicket] = useState<any>(null);

    const priorityConfig: any = {
        "Urgent": { color: "text-red-600", icon: <Flag size={13} className="fill-red-600 text-red-600" /> },
        "High": { color: "text-amber-600", icon: <Flag size={13} className="fill-amber-600 text-amber-600" /> },
        "Normal": { color: "text-blue-600", icon: <Flag size={13} className="fill-blue-600 text-blue-600" /> },
        "Low": { color: "text-gray-500", icon: <Flag size={13} className="fill-gray-500 text-gray-500" /> },
    };

    const statusConfig: any = {
        "Set Status": { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
        "Pending": { bg: "bg-red-50", text: "text-red-700", border: "border-red-100" },
        "TO DO": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
        "IN PROGRESS": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
        "COMPLETE": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    };

    const fetchData = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const { data: proj } = await supabase.from("Project").select("*, Space(spaceName)").eq("id", projectId).single();
            setProject(proj);

            const { data: tix } = await supabase.from("Tickets").select("*").eq("projectId", projectId).order('created_at', { ascending: true });

            const sectionsExist = tix?.some(t => t.is_section);
            if (tix && !sectionsExist && proj) {
                const defaultSection = { title: "TO DO", projectId, is_section: true, spaceId: proj.spaceId, Status: "TO DO" };
                const { data: newSec, error: newSecErr } = await supabase.from("Tickets").insert([defaultSection]).select();
                if (newSec && newSec[0]) {
                    try {
                        await supabase.from("Tickets")
                            .update({ parentId: newSec[0].id })
                            .eq("projectId", projectId)
                            .is("parentId", null)
                            .eq("is_section", false);
                    } catch (err) { console.warn(err); }
                    const { data: refreshed } = await supabase.from("Tickets").select("*").eq("projectId", projectId).order('created_at', { ascending: true });
                    setTickets(refreshed || []);
                    setLoading(false);
                    return;
                } else if (newSecErr) {
                    console.error(newSecErr);
                }
            }

            setTickets(tix || []);
        } catch (err) {
            console.error(err);
            message.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const isVisible = (task: any): boolean => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        if (task.title?.toLowerCase().includes(query) || task.priority?.toLowerCase().includes(query)) return true;
        const subTasks = tickets.filter(t => t.parentId === task.id);
        return subTasks.some(st => isVisible(st));
    };

    const updateField = async (id: string | undefined, field: string, value: any) => {
        if (!id) return;
        setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
        if (selectedTicket?.id === id) {
            setSelectedTicket((prev: any) => ({ ...prev, [field]: value }));
            setModalTicket((prev: any) => ({ ...prev, [field]: value }));
        }
        const { error } = await supabase.from("Tickets").update({ [field]: value }).eq("id", id);
        if (error) {
            message.error("Update Failed");
            console.error(error);
            fetchData();
        }
    };

    const deleteTask = async (id: string) => {
        const { error } = await supabase.from("Tickets").delete().eq("id", id);
        if (!error) {
            setTickets(prev => prev.filter(t => t.id !== id && t.parentId !== id));
            setBulkSelectedIds(prev => prev.filter(x => x !== id));
            message.success("Deleted");
        } else {
            message.error("Delete failed");
        }
    };

    const deleteSelected = async () => {
        if (bulkSelectedIds.length === 0) return;
        const confirmed = await new Promise<boolean>((resolve) => {
            Modal.confirm({
                title: "Delete selected tasks?",
                content: "This will delete the selected tasks and their immediate children.",
                okText: "Delete",
                okType: "danger",
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
            });
        });
        if (!confirmed) return;

        try {
            const { error: childErr } = await supabase.from("Tickets").delete().in("parentId", bulkSelectedIds);
            if (childErr) console.warn("child delete error", childErr);
            const { error } = await supabase.from("Tickets").delete().in("id", bulkSelectedIds);
            if (!error) {
                setTickets(prev => prev.filter(t => !bulkSelectedIds.includes(t.id) && !bulkSelectedIds.includes(t.parentId)));
                setBulkSelectedIds([]);
                setSectionBulkMode({});
                message.success("Deleted selected");
            } else {
                console.error(error);
                message.error("Bulk delete failed");
            }
        } catch (err) {
            console.error(err);
            message.error("Bulk delete failed");
        }
    };

    const handleCreateInlineFromSection = async (sectionId: string) => {
        const title = (newInlineTitles[sectionId] || "").trim();
        if (!title) return;
        const payload = {
            title,
            projectId,
            spaceId: project?.spaceId,
            parentId: sectionId,
            is_section: false,
            Status: "Set Status"
        };
        try {
            const { data, error } = await supabase.from("Tickets").insert([payload]).select();
            if (!error && data?.[0]) {
                setTickets(prev => [...prev, data[0]]);
                setNewInlineTitles(prev => ({ ...prev, [sectionId]: "" }));
                message.success("Task added");
            } else {
                console.error(error);
                message.error("Failed to add task");
            }
        } catch (err) {
            console.error(err);
            message.error("Failed to add task");
        }
    };

    const handleCreateGlobalFromModal = async () => {
        if (!modalTicket) return;
        if (!modalTicket.title) return message.warning("Title is required");
        try {
            // Use user-selected Status from modalTicket (not hardcoded)
            const payload = {
                title: modalTicket.title,
                description: modalTicket.description || null,
                priority: modalTicket.priority || null,
                Status: modalTicket.Status || "Set Status",
                due_date: modalTicket.due_date || null,
                projectId,
                spaceId: project?.spaceId || null,
                parentId: modalTicket.parentId || null,
                is_section: false
            };
            const { data, error } = await supabase.from("Tickets").insert([payload]).select();
            if (!error && data?.[0]) {
                setTickets(prev => [...prev, data[0]]);
                setIsDetailModalOpen(false);
                setModalTicket(null);
                message.success("Task created");
            } else {
                console.error(error);
                message.error("Create failed");
            }
        } catch (err) {
            console.error(err);
            message.error("Create failed");
        }
    };

    const addInlineTask = async (parentId: string) => {
        const payload = {
            title: "",
            projectId,
            spaceId: project?.spaceId,
            parentId,
            is_section: false,
            Status: "Set Status"
        };
        const { data, error } = await supabase.from("Tickets").insert([payload]).select();
        if (!error && data) {
            setTickets(prev => [...prev, data[0]]);
            setEditingId(data[0].id);
            setTempTitle("");
        } else {
            message.error("Add inline failed");
        }
    };

    const toggleSelectAllSection = (sectionId: string) => {
        const sectionTasks = tickets.filter(t => t.parentId === sectionId && !t.is_section).map(t => t.id);
        const allSelected = sectionTasks.length > 0 && sectionTasks.every(id => bulkSelectedIds.includes(id));
        if (allSelected) {
            setBulkSelectedIds(prev => prev.filter(id => !sectionTasks.includes(id)));
            setSectionBulkMode(prev => {
                const cp = { ...prev };
                delete cp[sectionId];
                return cp;
            });
        } else {
            setBulkSelectedIds(prev => Array.from(new Set([...prev, ...sectionTasks])));
            setSectionBulkMode(prev => ({ ...prev, [sectionId]: true }));
        }
    };

    const toggleCheckboxSelection = (taskId: string, parentSectionId?: string) => {
        setBulkSelectedIds(prev => {
            const next = prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId];
            if (parentSectionId) {
                const tasksInSection = tickets.filter(t => t.parentId === parentSectionId && !t.is_section).map(t => t.id);
                const stillChecked = tasksInSection.some(id => next.includes(id));
                if (!stillChecked) {
                    setSectionBulkMode(prevSec => {
                        const cp = { ...prevSec };
                        delete cp[parentSectionId];
                        return cp;
                    });
                }
            }
            return next;
        });
    };

    const TaskRow = ({ task, level = 0 }: { task: any, level: number }) => {
        const subTasks = tickets.filter(t => t.parentId === task.id && !t.is_section);
        const [isExpanded, setIsExpanded] = useState(true);
        const currentStatus = statusConfig[task.Status] || statusConfig["Set Status"];

        if (!isVisible(task)) return null;

        const parentSectionId = task.parentId;
        const checkboxAlwaysVisible = sectionBulkMode[parentSectionId] || bulkSelectedIds.includes(task.id);

        return (
            <div className="w-full min-w-[800px] lg:min-w-full">
                <div className="group flex items-center border-b border-gray-100 py-3 hover:bg-gray-50/80 transition-all px-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0" style={{ paddingLeft: `${level * 20}px` }}>
                        <div className="w-5 flex items-center justify-center cursor-pointer text-gray-500 hover:text-blue-600 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                            {subTasks.length > 0 ? (
                                isExpanded ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronRight size={16} strokeWidth={2.5} />
                            ) : (
                                <div className="w-[16px] h-[16px] flex items-center justify-center" />
                            )}
                        </div>

                        {/* Checkbox: visible if bulk mode for section OR task is checked, otherwise visible on hover */}
                        <div className="flex items-center">
                            {checkboxAlwaysVisible ? (
                                <input
                                    type="checkbox"
                                    checked={bulkSelectedIds.includes(task.id)}
                                    onChange={() => toggleCheckboxSelection(task.id, parentSectionId)}
                                    className="mr-2 w-4 h-4 cursor-pointer"
                                    aria-label="Select task"
                                />
                            ) : (
                                <input
                                    type="checkbox"
                                    checked={bulkSelectedIds.includes(task.id)}
                                    onChange={() => toggleCheckboxSelection(task.id, parentSectionId)}
                                    className="mr-2 w-4 h-4 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Select task"
                                />
                            )}

                            {/* Dotted circle - inert (always dotted, never toggles/filled) */}
                            <div className="flex items-center justify-center mr-2">
                                <CircleDashed size={16} className="text-gray-300" />
                            </div>
                        </div>

                        {editingId === task.id ? (
                            <input
                                autoFocus
                                className="bg-white px-3 py-2 text-gray-900 text-[14px] font-semibold outline-none border-2 border-blue-400 rounded-md w-full shadow-sm"
                                value={tempTitle}
                                onChange={(e) => setTempTitle(e.target.value)}
                                onBlur={() => { updateField(task.id, 'title', tempTitle); setEditingId(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && updateField(task.id, 'title', tempTitle).then(() => setEditingId(null))}
                            />
                        ) : (
                            <span className={`text-[13px] font-semibold truncate cursor-pointer hover:text-blue-600 ${task.title ? 'text-gray-800' : 'text-gray-400'}`}
                                onClick={() => { setSelectedTicket(task); setModalTicket({ ...task }); setIsDetailModalOpen(true); }}>
                                {task.title || "Add Task Title"}
                            </span>
                        )}

                        <div className="flex items-center gap-2.5 ml-4 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <div title="Add subtask" onClick={() => addInlineTask(task.id)} className="cursor-pointer">
                                <Plus size={14} strokeWidth={2.5} className="text-gray-500 hover:text-blue-600" />
                            </div>
                            <div title="Edit" onClick={() => { setEditingId(task.id); setTempTitle(task.title || ""); }} className="cursor-pointer">
                                <Edit2 size={14} className="text-gray-400 hover:text-gray-700" />
                            </div>
                            <div title="Delete" onClick={() => deleteTask(task.id)} className="cursor-pointer">
                                <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                            </div>
                        </div>
                    </div>

                    {/* Columns: Due date | Priority | Status */}
                    <div className="flex items-center gap-4 lg:gap-8">
                        <div className="w-[100px] flex justify-center items-center cursor-pointer hover:bg-gray-100 rounded py-1.5 relative">
                            <DatePicker suffixIcon={null} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onChange={(date) => updateField(task.id, 'due_date', date ? date.format('YYYY-MM-DD') : null)} value={task.due_date ? dayjs(task.due_date) : undefined} />
                            <div className="flex items-center gap-2 pointer-events-none">
                                {task.due_date ? (
                                    <span className="text-[10px] text-gray-700 font-bold bg-gray-100 px-2 py-1 rounded">
                                        {dayjs(task.due_date).format('M/D/YY')}
                                    </span>
                                ) : (
                                    <CalendarIcon size={14} className="text-gray-400" />
                                )}
                            </div>
                        </div>

                        <div className="w-[110px] flex justify-center items-center">
                            <Dropdown trigger={['click']} menu={{ items: [...Object.keys(priorityConfig).map(k => ({ key: k, label: <div className="flex items-center gap-2">{priorityConfig[k].icon} <span className="text-xs font-medium">{k}</span></div> })), { key: 'clear', label: 'Clear' }], onClick: ({ key }) => updateField(task.id, 'priority', key === 'clear' ? null : key) }}>
                                <div className="cursor-pointer px-2 py-1.5 hover:bg-gray-100 rounded flex items-center gap-2 min-w-[90px] justify-start">
                                    {task.priority ? (
                                        <div className="flex items-center gap-2">
                                            {priorityConfig[task.priority].icon}
                                            <span className={`text-[10px] font-bold ${priorityConfig[task.priority].color}`}>{task.priority}</span>
                                        </div>
                                    ) : (
                                        <Flag size={14} className="text-gray-300" />
                                    )}
                                </div>
                            </Dropdown>
                        </div>

                        <div className="w-[140px] flex justify-center pr-2">
                            <Dropdown trigger={['click']} menu={{ items: Object.keys(statusConfig).map(k => ({ key: k, label: k })), onClick: ({ key }) => updateField(task.id, 'Status', key) }}>
                                <div className={`flex items-center gap-2 ${currentStatus.bg} ${currentStatus.border} px-3 py-1.5 rounded-md border cursor-pointer hover:brightness-95 shadow-sm`}>
                                    <CircleDashed size={10} strokeWidth={3} className={currentStatus.text} />
                                    <span className={`text-[9px] font-bold uppercase tracking-wide ${currentStatus.text}`}>{task.Status || "Set Status"}</span>
                                </div>
                            </Dropdown>
                        </div>
                    </div>
                </div>

                {isExpanded && subTasks.map(st => <TaskRow key={st.id} task={st} level={level + 1} />)}
            </div>
        );
    };

    const sections = tickets.filter(t => t.is_section);

    const openCreateModalFromHeader = () => {
        const todoSection = tickets.find(t => t.is_section && t.title === "TO DO") || sections[0];
        const parentId = todoSection?.id || null;
        const base = {
            isNew: true,
            parentId,
            projectId,
            title: "",
            description: "",
            priority: "Normal",
            Status: "Set Status",
            due_date: null
        };
        setModalTicket(base);
        setIsDetailModalOpen(true);
    };

    const handleSectionRenameSubmit = async (sectionId: string) => {
        const newTitle = tempTitle?.toString()?.trim();
        if (!newTitle) {
            setEditingId(null);
            return;
        }
        await updateField(sectionId, 'title', newTitle);
        setEditingId(null);
    };

    return (
        <BABox className="min-h-screen bg-[#fcfcfc] text-[#292d34] font-sans pb-20">
            <div className="h-auto lg:h-14 border-b border-gray-200 flex flex-col lg:flex-row items-start lg:items-center px-4 lg:px-6 py-3 lg:py-0 bg-white sticky top-0 z-50 shadow-sm gap-4">
                <div className="flex items-center gap-2 text-[11px] lg:text-[12px] w-full lg:flex-1">
                    <span className="text-gray-400 font-medium truncate max-w-[80px] lg:max-w-none">{project?.Space?.spaceName}</span>
                    <ChevronRight size={14} className="text-gray-300" />
                    <div className="flex items-center gap-1.5 font-bold text-gray-800 bg-gray-50 px-2 lg:px-3 py-1 rounded-md border border-gray-100 truncate">
                        <Hash size={14} className="text-blue-500 flex-shrink-0" /> {project?.name}
                    </div>
                </div>

                <div className="relative w-full lg:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input type="text" placeholder="Search tasks..." className="w-full bg-gray-100 border border-transparent rounded-lg px-10 py-2 text-sm outline-none focus:bg-white focus:border-blue-200 transition-all"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="hidden lg:flex flex-1 justify-end items-center gap-3">
                    {bulkSelectedIds.length > 0 && (
                        <BAButton label={`Delete Selected (${bulkSelectedIds.length})`} onClick={deleteSelected} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-2 rounded-lg font-bold shadow-md" />
                    )}
                    <BAButton label="Add Task" onClick={openCreateModalFromHeader} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md" />
                </div>
            </div>

            <div className="p-4 lg:p-8 max-w-[1400px] mx-auto overflow-x-auto">
                <div className="min-w-[800px] lg:min-w-full flex items-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200">
                    <div className="flex-1">Name</div>
                    <div className="w-[100px] text-center">Due date</div>
                    <div className="w-[110px] text-center">Priority</div>
                    <div className="w-[140px] text-center">Status</div>
                </div>

                {sections.length === 0 ? (
                    <div className="mt-6 lg:mt-8 min-w-[800px] lg:min-w-full">
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 flex items-center border-b border-gray-100">
                                <div className="w-5 flex items-center justify-center">
                                    <CircleDashed size={16} className="text-gray-300" />
                                </div>
                                <div className="flex-1 px-4">
                                    <div className="text-[13px] font-semibold text-gray-400">Add Task</div>
                                </div>
                                <div className="pr-2">
                                    <div className="p-2 rounded cursor-pointer bg-gray-50 border border-gray-100">
                                        <Plus size={16} />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 flex items-center gap-3">
                                <div className="w-5 flex items-center justify-center">
                                    <CircleDashed size={16} className="text-gray-300" />
                                </div>
                                <div className="flex-1">
                                    <input
                                        placeholder="Add Task"
                                        className="w-full bg-transparent px-2 py-2 text-[13px] font-semibold outline-none text-gray-500 placeholder:text-gray-300"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                (async () => {
                                                    if (!projectId) return;
                                                    const defaultSection = { title: "TO DO", projectId, is_section: true, spaceId: project?.spaceId, Status: "TO DO" };
                                                    const { data: newSec } = await supabase.from("Tickets").insert([defaultSection]).select();
                                                    if (!newSec?.[0]) {
                                                        message.error("Failed to create section");
                                                        return;
                                                    }
                                                    const payload = {
                                                        title: (e.target as HTMLInputElement).value || "New Task",
                                                        projectId,
                                                        spaceId: project?.spaceId,
                                                        parentId: newSec[0].id,
                                                        is_section: false,
                                                        Status: "Set Status"
                                                    };
                                                    const { data, error } = await supabase.from("Tickets").insert([payload]).select();
                                                    if (!error && data?.[0]) {
                                                        setTickets(prev => [...prev, newSec[0], data[0]]);
                                                        message.success("Task added");
                                                    } else {
                                                        message.error("Failed to add task");
                                                    }
                                                })();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="pr-2">
                                    <div className="p-2 rounded cursor-pointer bg-gray-50 border border-gray-100">
                                        <Plus size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    sections.map(section => {
                        const sectionTasks = tickets.filter(t => t.parentId === section.id && !t.is_section);
                        if (searchQuery && !section.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !sectionTasks.some(st => isVisible(st))) return null;

                        const sectionSelectedCount = sectionTasks.filter(t => bulkSelectedIds.includes(t.id)).length;
                        const allSelected = sectionTasks.length > 0 && sectionSelectedCount === sectionTasks.length;

                        return (
                            <div key={section.id} className="mt-6 lg:mt-8 first:mt-2 min-w-[800px] lg:min-w-full">
                                <div className="flex items-center justify-between mb-3 group/sec">
                                    <div className="flex items-center gap-2">
                                        <div className="cursor-pointer text-gray-500 p-1" onClick={() => setCollapsedSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}>
                                            {collapsedSections[section.id] ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                                        </div>

                                        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">
                                            {editingId === section.id ? (
                                                <input autoFocus className="bg-transparent text-[11px] font-bold uppercase outline-none border-b-2 border-blue-500"
                                                    value={tempTitle} onChange={(e) => setTempTitle(e.target.value.toUpperCase())}
                                                    onBlur={() => handleSectionRenameSubmit(section.id)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSectionRenameSubmit(section.id)}
                                                />
                                            ) : (
                                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-800" onClick={() => { setEditingId(section.id); setTempTitle(section.title || ""); }}>
                                                    {section.title}
                                                </span>
                                            )}
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">{sectionTasks.length}</span>
                                        </div>

                                        <Dropdown trigger={['click']} menu={{
                                            items: [
                                                {
                                                    key: 'edit',
                                                    label: 'Rename',
                                                    icon: <Edit2 size={12} />,
                                                    onClick: () => { setEditingId(section.id); setTempTitle(section.title || ""); }
                                                },
                                                {
                                                    key: 'select_all',
                                                    label: allSelected ? 'Unselect All' : 'Select All',
                                                    onClick: () => toggleSelectAllSection(section.id)
                                                },
                                            ]
                                        }}>
                                            <div className="cursor-pointer p-1.5 hover:bg-gray-200 rounded text-gray-400 ml-2">
                                                <MoreHorizontal size={16} />
                                            </div>
                                        </Dropdown>

                                        <div onClick={() => addInlineTask(section.id)} className="p-1.5 bg-gray-50 border border-gray-100 rounded-md text-blue-500 hover:bg-blue-50 cursor-pointer ml-2">
                                            <Plus size={14} strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>

                                {!collapsedSections[section.id] && (
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        {sectionTasks.map(task => <TaskRow key={task.id} task={task} level={0} />)}

                                        <div className="p-4 flex items-center gap-3 border-t border-gray-100">
                                            <div className="w-5 flex items-center justify-center">
                                                <CircleDashed size={16} className="text-gray-300" />
                                            </div>
                                            <div className="flex-1">
                                                <input
                                                    value={newInlineTitles[section.id] || ""}
                                                    onChange={(e) => setNewInlineTitles(prev => ({ ...prev, [section.id]: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleCreateInlineFromSection(section.id);
                                                        }
                                                    }}
                                                    placeholder="Add Task"
                                                    className="w-full bg-transparent px-2 py-2 text-[13px] font-semibold outline-none text-gray-500 placeholder:text-gray-300"
                                                />
                                            </div>
                                            <div className="pr-2">
                                                <div className="p-2 rounded cursor-pointer bg-gray-50 border border-gray-100">
                                                    <Plus size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <button
                onClick={() => { setModalTicket({ isNew: true, title: "", description: "", priority: "Normal", Status: "Set Status", due_date: null, parentId: null, projectId }); setIsDetailModalOpen(true); }}
                className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40"
            >
                <Plus size={28} />
            </button>

            <BAModal title={modalTicket?.isNew ? "Create Task" : "Task Overview"} open={isDetailModalOpen} close={() => { setIsDetailModalOpen(false); setModalTicket(null); }}
                content={
                    <div className="p-6 space-y-5 max-w-2xl">
                        <div className="space-y-2">
                            <input
                                autoFocus
                                className="w-full text-2xl font-extrabold text-gray-900 border-none outline-none p-0"
                                placeholder="Task Name"
                                value={modalTicket?.title || ""}
                                onChange={(e) => setModalTicket((prev: any) => ({ ...prev, title: e.target.value }))}
                                onBlur={() => { if (!modalTicket?.isNew && modalTicket?.id) updateField(modalTicket.id, 'title', modalTicket.title); }}
                                onKeyDown={(e) => { if (!modalTicket?.isNew && e.key === 'Enter') e.currentTarget.blur(); }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="text-[13px] font-bold mb-2">Status</div>
                                <Select value={modalTicket?.Status} onChange={(val) => { setModalTicket((prev: any) => ({ ...prev, Status: val })); if (!modalTicket?.isNew && modalTicket?.id) updateField(modalTicket.id, 'Status', val); }} className="w-full">
                                    {Object.keys(statusConfig).map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
                                </Select>
                            </div>
                            <div>
                                <div className="text-[13px] font-bold mb-2">Priority</div>
                                <Select value={modalTicket?.priority} onChange={(val) => { setModalTicket((prev: any) => ({ ...prev, priority: val })); if (!modalTicket?.isNew && modalTicket?.id) updateField(modalTicket.id, 'priority', val); }} className="w-full">
                                    {Object.keys(priorityConfig).map(p => <Select.Option key={p} value={p}>{p}</Select.Option>)}
                                </Select>
                            </div>
                        </div>

                        <div>
                            <div className="text-[13px] font-bold mb-2">Due Date</div>
                            <DatePicker className="w-full" value={modalTicket?.due_date ? dayjs(modalTicket.due_date) : undefined} onChange={(date) => {
                                const val = date ? date.format("YYYY-MM-DD") : null;
                                setModalTicket((prev: any) => ({ ...prev, due_date: val }));
                                if (!modalTicket?.isNew && modalTicket?.id) updateField(modalTicket.id, 'due_date', val);
                            }} />
                        </div>

                        <div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Description</div>
                            <textarea className="w-full p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm min-h-[120px] outline-none" placeholder="Add description..."
                                value={modalTicket?.description || ""} onChange={(e) => setModalTicket((prev: any) => ({ ...prev, description: e.target.value }))} onBlur={() => { if (!modalTicket?.isNew && modalTicket?.id) updateField(modalTicket.id, 'description', modalTicket.description); }} />
                        </div>

                        <div className="flex justify-end">
                            {modalTicket?.isNew ? (
                                <BAButton label="Create Task" onClick={handleCreateGlobalFromModal} className="bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg" />
                            ) : (
                                <BAButton label="Close" onClick={() => { setIsDetailModalOpen(false); setModalTicket(null); }} className="bg-gray-100 text-gray-800 py-3 rounded-xl font-bold shadow-sm" />
                            )}
                        </div>
                    </div>
                }
            />
        </BABox>
    );
}