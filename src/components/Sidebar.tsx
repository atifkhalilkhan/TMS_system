import { useEffect, useState, useCallback } from "react"
import { useNavigate, useLocation } from "react-router"
import supabase from "../dbconfig/db"
import { message, Popconfirm, Tooltip } from "antd"
import {
  Hash, Plus, LayoutGrid, Settings, Menu,
  Search, Edit2, Trash2, XCircle, ChevronRight, ChevronDown, X
} from "lucide-react"
import { BAModal, BAFormElement } from "basuite"

const SidebarSkeleton = () => (
  <div className="animate-pulse space-y-4 px-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center gap-3 p-2">
        <div className="w-7 h-7 bg-white/5 rounded-lg" />
        <div className="h-3 bg-white/5 rounded w-28" />
      </div>
    ))}
  </div>
);

export default function Sidebar() {
  const [spaces, setSpaces] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSpaces, setExpandedSpaces] = useState<{ [key: string]: boolean }>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [spaceModal, setSpaceModal] = useState(false)
  const [projectModal, setProjectModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const initialSpace = { spaceName: "", iconBgColor: "#6366f1" };
  const initialProject = { name: "", description: "", spaceId: "" };
  const [spaceObj, setSpaceObj] = useState<any>(initialSpace)
  const [projectObj, setProjectObj] = useState<any>(initialProject)

  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  const getData = useCallback(async () => {
    setLoading(true)
    const [sRes, pRes] = await Promise.all([
      supabase.from('Space').select('*').order('created_at', { ascending: true }),
      supabase.from('Project').select('*').order('created_at', { ascending: true })
    ])
    if (sRes.error) {
      console.error(sRes.error)
      message.error("Failed to load spaces")
    }
    if (pRes.error) {
      console.error(pRes.error)
      message.error("Failed to load projects")
    }
    setSpaces(sRes.data || [])
    setProjects(pRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { getData() }, [getData])

  useEffect(() => {
    if (searchQuery.length > 0) {
      const autoExpand: any = {};
      spaces.forEach(s => {
        const hasProject = projects.some(p => p.spaceId === s.id && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        if (hasProject || s.spaceName.toLowerCase().includes(searchQuery.toLowerCase())) {
          autoExpand[s.id] = true;
        }
      });
      setExpandedSpaces(autoExpand);
    } else {
      setExpandedSpaces({});
    }
  }, [searchQuery, spaces, projects]);

  const handleSaveSpace = async () => {
    if (!spaceObj.spaceName) return message.error("Enter Space Name")
    const { error } = isEditing
      ? await supabase.from('Space').update({ spaceName: spaceObj.spaceName }).eq('id', spaceObj.id)
      : await supabase.from('Space').insert([spaceObj])
    if (!error) {
      message.success(isEditing ? "Space Updated" : "Space Created");
      setSpaceModal(false);
      getData();
    }
  }

  const deleteSpace = async (id: string) => {
    const { error } = await supabase.from('Space').delete().eq('id', id)
    if (!error) { message.success("Space Deleted"); getData(); }
  }

  const handleSaveProject = async () => {
    if (!projectObj.name) return message.error("Enter Project Name")
    const { error, data } = isEditing
      ? await supabase.from('Project').update({ name: projectObj.name, description: projectObj.description }).eq('id', projectObj.id)
      : await supabase.from('Project').insert([projectObj]).select()
    if (!error) {
      message.success(isEditing ? "Project Updated" : "Project Added");
      setProjectModal(false);
      getData();

      if (!isEditing && data?.[0]) {
        const newProj = data[0];
        navigate(`/space/${newProj.spaceId}/project/${newProj.id}`);
      }
    }
  }

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('Project').delete().eq('id', id)
    if (!error) {
      message.success("Project Deleted");
      getData();
      if (location.pathname === `/space/${projectObj.spaceId}/project/${id}` || location.pathname.includes(`/project/${id}`)) navigate('/');
    }
  }

  const filteredSpaces = spaces.filter(s =>
    s.spaceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    projects.some(p => p.spaceId === s.id && p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <>
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-[#141417] border border-white/10 rounded-lg text-white shadow-xl"
        >
          <Menu size={20} />
        </button>
      )}

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[51] lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed left-0 top-0 w-64 h-screen bg-[#0f0f11] border-r border-white/5 flex flex-col z-[55] shadow-2xl overflow-hidden font-sans transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0
      `}>

        <div className="p-4 flex items-center gap-3 border-b border-white/5 bg-[#141417]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-500/20">B</div>
          <div className="flex-1 overflow-hidden">
            <h3 className="text-sm font-bold text-white tracking-tight truncate">BA Suite</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Online</p>
            </div>
          </div>
          <X
            size={18}
            className="lg:hidden text-gray-500 cursor-pointer"
            onClick={() => setIsMobileOpen(false)}
          />
          <Settings size={16} className="hidden lg:block text-gray-600 hover:text-white cursor-pointer transition-colors" />
        </div>

        <div className="p-4 pb-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-400 transition-colors" size={14} />
            <input
              className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-2 pl-9 pr-8 text-xs outline-none focus:bg-white/[0.05] focus:border-indigo-500/50 transition-all placeholder-gray-600 text-gray-200"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <XCircle onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer transition-colors" size={14} />
            )}
          </div>
        </div>

        <div className="px-3 py-2">
          <div onClick={() => navigate('/')} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all text-sm ${location.pathname === '/' ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
            <LayoutGrid size={18} />
            <span>Dashboard</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-4 pt-2 custom-sidebar-scroll">
          <div>
            <div className="flex items-center justify-between px-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-[2px] text-gray-600">Spaces</span>
              <Tooltip title="Add Space">
                <button onClick={() => { setIsEditing(false); setSpaceObj(initialSpace); setSpaceModal(true); }} className="p-1 hover:bg-white/10 rounded-md text-gray-500 hover:text-indigo-400 transition-all">
                  <Plus size={16} />
                </button>
              </Tooltip>
            </div>

            <div className="space-y-1">
              {loading ? (
                <SidebarSkeleton />
              ) : (
                filteredSpaces.map((space) => {
                  const spaceProjects = projects.filter(p => p.spaceId === space.id && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
                  const isExpanded = expandedSpaces[space.id];

                  return (
                    <div key={space.id} className="group/space mb-1">
                      <div
                        onClick={() => setExpandedSpaces(prev => ({ ...prev, [space.id]: !isExpanded }))}
                        className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all duration-200 ${isExpanded ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-lg flex-shrink-0 border border-white/10" style={{ backgroundColor: space.iconBgColor || '#6366f1', color: '#ffffff' }}>
                          {space.spaceName?.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-[13px] font-semibold flex-1 truncate transition-colors ${isExpanded ? 'text-white' : 'text-gray-400 group-hover/space:text-gray-200'}`}>
                          {space.spaceName}
                        </span>

                        <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover/space:opacity-100 transition-all">
                          <Edit2 size={12} className="text-gray-500 hover:text-yellow-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); setIsEditing(true); setSpaceObj(space); setSpaceModal(true); }} />
                          <Popconfirm title="Delete Space?" onConfirm={() => deleteSpace(space.id)} okText="Yes" cancelText="No">
                            <Trash2 size={12} className="text-gray-500 hover:text-red-500 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                          </Popconfirm>
                        </div>
                        {isExpanded ? <ChevronDown size={14} className="text-gray-600" /> : <ChevronRight size={14} className="text-gray-600" />}
                      </div>

                      {isExpanded && (
                        <div className="ml-3.5 mt-1 pl-4 border-l border-white/10 space-y-1">
                          {spaceProjects.map(proj => {
                            const projectUrl = `/space${space.id}/project${proj.id}`;
                            const isActive = location.pathname === projectUrl || location.pathname.startsWith(`${projectUrl}/`);
                            return (
                              <div key={proj.id}
                                onClick={() => navigate(projectUrl)}
                                className={`group/proj flex items-center gap-2.5 p-2 rounded-lg text-[13px] cursor-pointer transition-all ${isActive ? 'text-indigo-400 bg-indigo-500/10 font-medium' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}`}>
                                <Hash size={12} className={isActive ? 'text-indigo-400' : 'text-gray-600'} />
                                <span className="flex-1 truncate">{proj.name}</span>
                                <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover/proj:opacity-100 transition-opacity">
                                  <Edit2 size={11} className="hover:text-yellow-500" onClick={(e) => { e.stopPropagation(); setIsEditing(true); setProjectObj(proj); setProjectModal(true); }} />
                                  <Popconfirm title="Delete Project?" onConfirm={() => deleteProject(proj.id)}>
                                    <Trash2 size={11} className="hover:text-red-500" onClick={(e) => e.stopPropagation()} />
                                  </Popconfirm>
                                </div>
                              </div>
                            )
                          })}

                          <div
                            onClick={(e) => { e.stopPropagation(); setIsEditing(false); setProjectObj({ ...initialProject, spaceId: space.id }); setProjectModal(true); }}
                            className={`flex items-center gap-2 p-2 rounded-lg text-[11px] transition-all cursor-pointer border border-dashed border-white/10 mt-1
                              ${spaceProjects.length === 0 ? 'text-gray-600 hover:text-indigo-400 hover:bg-white/[0.02]' : 'text-gray-700 hover:text-gray-400 hover:border-white/20'}`}
                          >
                            <Plus size={12} />
                            <span>{spaceProjects.length === 0 ? 'Add first project' : 'Add project'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#0f0f11] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">BA Suite</span>
          </div>
        </div>
      </aside>

      <BAModal title={isEditing ? "Edit Space" : "New Space"} open={spaceModal} close={() => setSpaceModal(false)}
        content={<BAFormElement model={spaceObj} setModel={setSpaceObj} onSaveClick={handleSaveSpace} formElement={[{ col: 12, elementType: "input", label: "Space Name", key: "spaceName", required: true }]} />}
      />
      <BAModal title={isEditing ? "Edit Project" : "New Project"} open={projectModal} close={() => setProjectModal(false)}
        content={<BAFormElement model={projectObj} setModel={setProjectObj} onSaveClick={handleSaveProject} formElement={[{ col: 12, elementType: "input", label: "Project Name", key: "name", required: true }, { col: 12, elementType: "textarea", label: "Description", key: "description" }]} />}
      />

      <style>{`
          .custom-sidebar-scroll::-webkit-scrollbar { width: 3px; }
          .custom-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
          .custom-sidebar-scroll:hover::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); }
      `}</style>
    </>
  )
}