import { useParams } from "react-router";
import { useEffect, useState, useCallback } from "react";
import supabase from "../dbconfig/db";
import { message, Dropdown, DatePicker } from "antd";
import {
    Plus, Hash, Search, Trash2, Edit2,
    Calendar as CalendarIcon, Flag, CircleDashed, ChevronDown, ChevronRight, MoreHorizontal, LayoutList
} from "lucide-react";
import { BABox, BAButton, BAModal, BAInput } from "basuite";
import dayjs from "dayjs";

export default function ProjectScreen() {
    const { projectId } = useParams();
    const [tickets, setTickets] = useState<any[]>([]);
    const [project, setProject] = useState<any>(null);
    const [isMainModalOpen, setIsMainModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const priorityConfig: any = {
        "Urgent": { color: "text-red-600", icon: <Flag size={13} className="fill-red-600 text-red-600" /> },
        "High": { color: "text-amber-600", icon: <Flag size={13} className="fill-amber-600 text-amber-600" /> },
        "Normal": { color: "text-blue-600", icon: <Flag size={13} className="fill-blue-600 text-blue-600" /> },
        "Low": { color: "text-gray-500", icon: <Flag size={13} className="fill-gray-500 text-gray-500" /> },
    };

    const statusConfig: any = {
        "Set Status": { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
        "Pending": { bg: "bg-red-50", text: "text-red-700", border: "border-red-100" },
        "TO DO": { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" },
        "IN PROGRESS": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
        "COMPLETE": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    };

    const fetchData = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        const { data: proj } = await supabase.from("Project").select("*, Space(spaceName)").eq("id", projectId).single();
        setProject(proj);
        const { data: tix } = await supabase.from("Tickets").select("*").eq("projectId", projectId).order('created_at', { ascending: true });
        setTickets(tix || []);
        setLoading(false);
    }, [projectId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const isVisible = (task: any): boolean => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        if (task.title?.toLowerCase().includes(query) || task.priority?.toLowerCase().includes(query)) return true;
        const subTasks = tickets.filter(t => t.parentId === task.id);
        return subTasks.some(st => isVisible(st));
    };

    const updateField = async (id: string, field: string, value: any) => {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
        const { error } = await supabase.from("Tickets").update({ [field]: value }).eq("id", id);
        if (error) message.error("Update Failed");
    };

    const deleteTask = async (id: string) => {
        const { error } = await supabase.from("Tickets").delete().eq("id", id);
        if (!error) {
            setTickets(prev => prev.filter(t => t.id !== id && t.parentId !== id));
            message.success("Deleted");
        }
    };

    const addInlineTask = async (parentId: string) => {
        const payload = { title: "", projectId, spaceId: project?.spaceId, parentId, is_section: false, Status: "Set Status" };
        const { data, error } = await supabase.from("Tickets").insert([payload]).select();
        if (!error && data) {
            setTickets(prev => [...prev, data[0]]);
            setEditingId(data[0].id);
            setTempTitle("");
        }
    };

    const TaskRow = ({ task, level = 0 }: { task: any, level: number }) => {
        const subTasks = tickets.filter(t => t.parentId === task.id && !t.is_section);
        const [isExpanded, setIsExpanded] = useState(true);
        const currentStatus = statusConfig[task.Status] || statusConfig["TO DO"];

        if (!isVisible(task)) return null;

        return (
            <div className="w-full min-w-[800px] lg:min-w-full">
                <div className="group flex items-center border-b border-gray-100 py-3 hover:bg-gray-50/80 transition-all px-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0" style={{ paddingLeft: `${level * 20}px` }}>
                        <div className="w-5 flex items-center justify-center cursor-pointer text-gray-500 hover:text-blue-600 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                            {subTasks.length > 0 ? (
                                isExpanded ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronRight size={16} strokeWidth={2.5} />
                            ) : (
                                <CircleDashed size={14} strokeWidth={2.5} className="text-gray-400" />
                            )}
                        </div>
                        {editingId === task.id ? (
                            <input autoFocus className="bg-white px-2 py-1 text-gray-900 text-[13px] font-semibold outline-none border-2 border-blue-400 rounded-md w-full max-w-md shadow-sm"
                                value={tempTitle} onChange={(e) => setTempTitle(e.target.value)}
                                onBlur={() => { updateField(task.id, 'title', tempTitle); setEditingId(null); }}
                                onKeyDown={(e) => e.key === 'Enter' && updateField(task.id, 'title', tempTitle).then(() => setEditingId(null))}
                            />
                        ) : (
                            <span className={`text-[13px] font-semibold truncate cursor-text ${task.title ? 'text-gray-800' : 'text-gray-400'}`}
                                onClick={() => { setEditingId(task.id); setTempTitle(task.title || "") }}>
                                {task.title || "Add Task Title"}
                            </span>
                        )}
                        <div className="flex items-center gap-2.5 ml-4 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <Plus size={14} strokeWidth={2.5} className="text-blue-500 hover:text-blue-700 cursor-pointer" onClick={() => addInlineTask(task.id)} />
                            <Trash2 size={13} strokeWidth={2.5} className="text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => deleteTask(task.id)} />
                        </div>
                    </div>

                    <div className="flex items-center gap-4 lg:gap-8">
                        {/* Due Date */}
                        <div className="w-[100px] flex justify-center items-center cursor-pointer hover:bg-gray-100 rounded py-1.5 relative">
                            <DatePicker suffixIcon={null} variant="borderless" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                onChange={(date) => updateField(task.id, 'due_date', date ? date.format('YYYY-MM-DD') : null)} />
                            <div className="flex items-center gap-2 pointer-events-none">
                                {task.due_date ? (
                                    <span className="text-[10px] text-gray-700 font-bold bg-gray-100 px-2 py-1 rounded">
                                        {dayjs(task.due_date).format('MMM DD')}
                                    </span>
                                ) : (
                                    <CalendarIcon size={14} className="text-gray-400" />
                                )}
                            </div>
                        </div>

                        {/* Priority */}
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

                        {/* Status */}
                        <div className="w-[140px] flex justify-end pr-2">
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

    if (loading) {
        return (
            <div className="p-6 lg:p-10 max-w-[1400px] mx-auto animate-pulse">
                <div className="h-8 bg-gray-200 rounded-md w-1/4 mb-10"></div>
                {[1, 2].map(i => <div key={i} className="mb-8"><div className="h-10 bg-gray-100 rounded-lg w-1/3 mb-4"></div><div className="h-24 bg-gray-50 rounded-md w-full"></div></div>)}
            </div>
        );
    }

    return (
        <BABox className="min-h-screen bg-[#fcfcfc] text-[#292d34] font-sans pb-20">
            {/* Header - Responsive */}
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

                <div className="hidden lg:flex flex-1 justify-end">
                    <BAButton label="New Section" onClick={() => { setTempTitle(""); setIsMainModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md" />
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 lg:p-8 max-w-[1400px] mx-auto overflow-x-auto">
                {sections.length > 0 && (
                    <div className="min-w-[800px] lg:min-w-full flex items-center px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-200">
                        <div className="flex-1">Task Name</div>
                        <div className="flex items-center gap-4 lg:gap-8">
                            <div className="w-[100px] text-center">Due date</div>
                            <div className="w-[110px] text-center">Priority</div>
                            <div className="w-[140px] text-right pr-4">Status</div>
                        </div>
                    </div>
                )}

                {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-10 lg:mt-20 p-6 lg:p-12 border-2 border-dashed border-gray-200 rounded-[20px] lg:rounded-[32px] bg-gray-50/50">
                        <LayoutList size={40} className="text-blue-500 mb-6" />
                        <h2 className="text-lg lg:text-xl font-bold text-gray-800 mb-2">No sections yet</h2>
                        <button onClick={() => { setTempTitle(""); setIsMainModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">
                            Add Your First Section
                        </button>
                    </div>
                ) : (
                    sections.map(section => {
                        const sectionTasks = tickets.filter(t => t.parentId === section.id && !t.is_section);
                        if (searchQuery && !section.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !sectionTasks.some(st => isVisible(st))) return null;

                        return (
                            <div key={section.id} className="mt-6 lg:mt-8 first:mt-2 min-w-[800px] lg:min-w-full">
                                <div className="flex items-center justify-between mb-3 group/sec">
                                    <div className="flex items-center gap-2">
                                        <div className="cursor-pointer text-gray-500 hover:text-blue-600 p-1"
                                            onClick={() => setCollapsedSections(prev => ({ ...prev, [section.id]: !prev[section.id] }))}>
                                            {collapsedSections[section.id] ? <ChevronRight size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
                                        </div>
                                        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-gray-200 bg-white shadow-sm">
                                            {editingId === section.id ? (
                                                <input autoFocus className="bg-transparent text-[11px] font-bold uppercase outline-none border-b-2 border-blue-500"
                                                    value={tempTitle} onChange={(e) => setTempTitle(e.target.value.toUpperCase())}
                                                    onBlur={() => { updateField(section.id, 'title', tempTitle); setEditingId(null); }}
                                                    onKeyDown={(e) => e.key === 'Enter' && updateField(section.id, 'title', tempTitle).then(() => setEditingId(null))}
                                                />
                                            ) : (
                                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-800" onClick={() => { setEditingId(section.id); setTempTitle(section.title); }}>
                                                    {section.title}
                                                </span>
                                            )}
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">{sectionTasks.length}</span>
                                        </div>
                                        <Dropdown trigger={['click']} menu={{
                                            items: [
                                                { key: 'edit', label: 'Rename', icon: <Edit2 size={12} />, onClick: () => { setEditingId(section.id); setTempTitle(section.title); } },
                                                { key: 'delete', label: 'Delete Section', danger: true, icon: <Trash2 size={12} />, onClick: () => deleteTask(section.id) }
                                            ]
                                        }}>
                                            <div className="cursor-pointer p-1.5 hover:bg-gray-200 rounded text-gray-400">
                                                <MoreHorizontal size={16} />
                                            </div>
                                        </Dropdown>
                                    </div>
                                </div>

                                {!collapsedSections[section.id] && (
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        {sectionTasks.map(task => <TaskRow key={task.id} task={task} level={0} />)}
                                        <div onClick={() => addInlineTask(section.id)} className="p-4 text-[13px] text-gray-400 hover:text-blue-600 cursor-pointer flex items-center gap-2 hover:bg-blue-50/40 transition-all font-semibold">
                                            <Plus size={16} strokeWidth={3} /> <span>Create New Task</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Floating Action Button for Mobile Section Addition */}
            <button 
                onClick={() => { setTempTitle(""); setIsMainModalOpen(true); }}
                className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40"
            >
                <Plus size={28} />
            </button>

            <BAModal title="Add Project Section" open={isMainModalOpen} close={() => setIsMainModalOpen(false)}
                content={
                    <div className="p-4 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Section Name</label>
                            <BAInput placeholder="e.g. IN REVIEW" value={tempTitle} onChange={(e: any) => setTempTitle(e.target.value)} label={""} />
                        </div>
                        <BAButton label="Add Section" onClick={async () => {
                            if (!tempTitle) return;
                            await supabase.from("Tickets").insert([{ title: tempTitle.toUpperCase(), projectId, is_section: true, spaceId: project?.spaceId, Status: "TO DO" }]);
                            fetchData();
                            setIsMainModalOpen(false);
                        }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg" />
                    </div>
                }
            />
        </BABox>
    );
}