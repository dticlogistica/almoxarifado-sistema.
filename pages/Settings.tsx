
import React, { useEffect, useState } from 'react';
import { inventoryService } from '../services/inventoryService';
import { User, UserRole } from '../types';
import { Users, UserPlus, Shield, Edit, Trash2, Check, X, HelpCircle, Globe, Github, Server } from 'lucide-react';

const Settings: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Modals State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  
  // Form State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<User>({
    email: '',
    name: '',
    role: UserRole.OPERATOR,
    active: true
  });

  const loadUsers = async () => {
    const data = await inventoryService.getUsers();
    const current = await inventoryService.getCurrentUser();
    setCurrentUser(current);
    setUsers([...data]); 
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Guard Clause: Only Admin can see this page content
  if (!loading && currentUser?.role !== UserRole.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <Shield size={64} className="mb-4 opacity-20" />
        <h2 className="text-2xl font-bold text-slate-600">Acesso Restrito</h2>
        <p>Apenas administradores podem acessar esta área.</p>
      </div>
    );
  }

  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({ email: '', name: '', role: UserRole.OPERATOR, active: true });
    }
    setIsUserModalOpen(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.name) return;

    setLoading(true);
    await inventoryService.saveUser(formData);
    await loadUsers();
    setIsUserModalOpen(false);
    setLoading(false);
  };

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Tem certeza que deseja inativar/remover o usuário ${email}?`)) return;
    setLoading(true);
    const user = users.find(u => u.email === email);
    if (user) {
      await inventoryService.saveUser({ ...user, active: false });
    }
    await loadUsers();
    setLoading(false);
  };

  const RoleBadge = ({ role }: { role: UserRole }) => {
    switch (role) {
      case UserRole.ADMIN:
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold border border-purple-200">Administrador</span>;
      case UserRole.MANAGER:
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold border border-emerald-200">Gestor</span>;
      case UserRole.OPERATOR:
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold border border-blue-200">Operador</span>;
      default:
        return <span>{role}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Shield className="text-slate-600" /> Configurações do Sistema
          </h2>
          <p className="text-slate-500 mt-2">Gerenciamento de usuários e sistema.</p>
        </div>
        <button 
          onClick={() => setIsDeployModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium shadow-sm"
        >
          <HelpCircle size={18} /> Como Publicar?
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
           <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">
             <Users size={20} /> Usuários Cadastrados
           </h3>
           <button 
             onClick={() => handleOpenUserModal()}
             className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-sky-600 transition-colors font-medium shadow-sm"
           >
             <UserPlus size={18} /> Novo Usuário
           </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">E-mail (Login)</th>
                <th className="p-4 text-center">Perfil</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.email} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{user.name}</td>
                  <td className="p-4 text-slate-600 font-mono text-sm">{user.email}</td>
                  <td className="p-4 text-center"><RoleBadge role={user.role} /></td>
                  <td className="p-4 text-center">
                    {user.active ? (
                      <span className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-bold">
                        <Check size={14} /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-red-400 text-xs font-bold">
                        <X size={14} /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleOpenUserModal(user)}
                        className="p-2 text-slate-400 hover:text-accent hover:bg-sky-50 rounded-lg transition-colors" 
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      {user.email !== 'admin@sys.com' && (
                         <button 
                           onClick={() => handleDelete(user.email)}
                           className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                           title={user.active ? "Desativar" : "Ativar"}
                         >
                           {user.active ? <Trash2 size={16} /> : <Check size={16} />}
                         </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Usuário */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (Login Google)</label>
                <input 
                  type="email" 
                  required
                  disabled={!!editingUser} // Não permitir trocar e-mail na edição para simplificar
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent outline-none disabled:opacity-60"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
                {editingUser && <p className="text-xs text-slate-400 mt-1">O e-mail é o identificador único e não pode ser alterado.</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Acesso</label>
                <div className="grid grid-cols-1 gap-2">
                   <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.role === UserRole.ADMIN ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="role" 
                        checked={formData.role === UserRole.ADMIN} 
                        onChange={() => setFormData({...formData, role: UserRole.ADMIN})}
                        className="accent-purple-600"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-800">Administrador</span>
                        <span className="block text-xs text-slate-500">Acesso total, incluindo criação de usuários.</span>
                      </div>
                   </label>
                   
                   <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.role === UserRole.MANAGER ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="role" 
                        checked={formData.role === UserRole.MANAGER} 
                        onChange={() => setFormData({...formData, role: UserRole.MANAGER})}
                        className="accent-emerald-600"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-800">Gestor</span>
                        <span className="block text-xs text-slate-500">Pode cadastrar Notas (NE), ver relatórios e fazer estornos.</span>
                      </div>
                   </label>

                   <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.role === UserRole.OPERATOR ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input 
                        type="radio" 
                        name="role" 
                        checked={formData.role === UserRole.OPERATOR} 
                        onChange={() => setFormData({...formData, role: UserRole.OPERATOR})}
                        className="accent-blue-600"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-800">Operador</span>
                        <span className="block text-xs text-slate-500">Acesso focado apenas em Distribuição de materiais.</span>
                      </div>
                   </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="activeCheck"
                  checked={formData.active}
                  onChange={e => setFormData({...formData, active: e.target.checked})}
                  className="w-4 h-4 accent-accent"
                />
                <label htmlFor="activeCheck" className="text-sm text-slate-700 font-medium">Usuário Ativo</label>
              </div>

              <div className="pt-4 flex gap-3">
                 <button 
                   type="button" 
                   onClick={() => setIsUserModalOpen(false)}
                   className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="submit" 
                   className="flex-1 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 shadow-lg"
                 >
                   {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Guia de Deploy */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-800 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Globe size={20} /> Como Publicar o Sistema
              </h3>
              <button onClick={() => setIsDeployModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 text-slate-700">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                <p>Este sistema é um "Frontend" separado. Para que ele funcione no seu celular ou no computador de outras pessoas, você precisa hospedá-lo em um serviço web. Recomendamos a <strong>Vercel</strong> (Gratuito).</p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-600 shrink-0">1</div>
                  <div>
                    <h4 className="font-bold text-slate-800">Baixe o Código</h4>
                    <p className="text-sm mt-1">Faça o download de todos os arquivos deste projeto para o seu computador.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-600 shrink-0">2</div>
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Github size={16}/> Crie um Repositório no GitHub</h4>
                    <p className="text-sm mt-1">
                      Crie uma conta no <a href="https://github.com" target="_blank" className="text-accent hover:underline">GitHub</a> e suba os arquivos baixados para um novo repositório (Público ou Privado).
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-600 shrink-0">3</div>
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Server size={16}/> Conecte na Vercel</h4>
                    <ol className="list-disc list-inside text-sm mt-2 space-y-1">
                      <li>Crie uma conta na <a href="https://vercel.com" target="_blank" className="text-accent hover:underline">Vercel</a>.</li>
                      <li>Clique em <strong>"Add New Project"</strong>.</li>
                      <li>Selecione <strong>"Import"</strong> ao lado do seu repositório do GitHub.</li>
                      <li>Nas configurações de Build, deixe o padrão (Vite ou Create React App).</li>
                      <li>Clique em <strong>Deploy</strong>.</li>
                    </ol>
                  </div>
                </div>

                <div className="flex gap-4">
                   <div className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-600 shrink-0">4</div>
                   <div>
                     <h4 className="font-bold text-slate-800">Pronto!</h4>
                     <p className="text-sm mt-1">A Vercel vai gerar um link (ex: <code>seu-projeto.vercel.app</code>). Você pode abrir esse link no celular, tablet ou computador.</p>
                     <p className="text-xs text-slate-500 mt-2 italic">Nota: O arquivo <code>vercel.json</code> já foi adicionado ao projeto para garantir que a navegação entre páginas funcione corretamente.</p>
                   </div>
                </div>
              </div>
              
              <div className="pt-4 text-center">
                <button 
                  onClick={() => setIsDeployModalOpen(false)}
                  className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
