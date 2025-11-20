
import { Product, NotaEmpenho, Movement, MovementType, DashboardStats, NEStatus, User, UserRole } from '../types';
import { API_URL } from './config';

class InventoryService {
  private cachedUsers: User[] = [];
  private cachedProducts: Product[] = [];
  private cachedMovements: Movement[] = [];
  private cachedNes: NotaEmpenho[] = [];
  
  private dataLoaded = false;

  // --- API HELPERS ---

  private async fetchAllData() {
    if (this.dataLoaded && this.cachedUsers.length > 0) return;

    if (!API_URL || API_URL.includes('COLE_SUA_URL_AQUI')) {
      console.warn("API URL not configured");
      return;
    }

    try {
      // Adiciona timestamp para evitar cache do navegador
      const response = await fetch(`${API_URL}?action=getAll&t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const text = await response.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("A resposta do servidor não é um JSON válido:", text.substring(0, 200) + "...");
        throw new Error("O servidor retornou HTML em vez de JSON. Verifique as permissões do Script (Deve ser 'Qualquer pessoa').");
      }
      
      if (data.error) {
        throw new Error(data.error);
      }

      this.cachedUsers = (data.users || []).map((u: any) => ({
        ...u,
        active: u.active === true || u.active === "TRUE"
      }));
      
      this.cachedProducts = (data.products || []).map((p: any) => ({
        ...p,
        currentBalance: Number(p.currentBalance),
        unitValue: Number(p.unitValue),
        initialQty: Number(p.initialQty),
        minStock: Number(p.minStock)
      }));

      this.cachedMovements = (data.movements || []).map((m: any) => ({
        ...m,
        quantity: Number(m.quantity),
        value: Number(m.value),
        isReversed: m.isReversed === true || m.isReversed === "TRUE"
      }));

      this.cachedNes = data.nes || [];
      this.dataLoaded = true;
    } catch (error) {
      console.error("Erro detalhado no fetchAllData:", error);
      // Não usar alert aqui para não travar a UI em loop, apenas logar
      console.warn("Falha na conexão com a planilha. Verifique o console.");
    }
  }

  private async postData(action: string, payload: any): Promise<boolean> {
    try {
      // IMPORTANTE: Usar 'text/plain' no Content-Type evita que o navegador envie uma requisição OPTIONS (Preflight)
      // que o Google Apps Script não suporta, causando erro de CORS.
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, payload })
      });
      
      const text = await response.text();
      let result;
      
      try {
        result = JSON.parse(text);
      } catch (e) {
        console.error("Erro ao parsear resposta do POST:", text);
        return false;
      }

      if (result.success) {
        // Invalidate cache to force reload on next get
        this.dataLoaded = false; 
        return true;
      } else {
        console.error("API Error:", result.error);
        return false;
      }
    } catch (error) {
      console.error("Network Error:", error);
      return false;
    }
  }

  // --- USER MANAGEMENT ---

  async getCurrentUser(): Promise<User> {
    await this.fetchAllData();
    
    // Try to get from localStorage
    const storedEmail = localStorage.getItem('almoxarifado_user');
    if (storedEmail) {
      const found = this.cachedUsers.find(u => u.email === storedEmail && u.active);
      if (found) return found;
    }

    // Fallback: return first Admin or first user
    const admin = this.cachedUsers.find(u => u.role === UserRole.ADMIN && u.active);
    if (admin) {
      this.setCurrentUser(admin);
      return admin;
    }

    // Fallback absolute (if sheet is empty)
    return { email: 'admin@temp.com', name: 'Admin Temporário', role: UserRole.ADMIN, active: true };
  }

  async switchUser(index: number): Promise<User> {
    // This method is used by the UI "Switch User" button (Demo style)
    // We will map the index to the list of available users
    await this.fetchAllData();
    if (this.cachedUsers.length === 0) return this.getCurrentUser();

    const user = this.cachedUsers[index % this.cachedUsers.length];
    this.setCurrentUser(user);
    return user;
  }

  // Helper to persist session
  private setCurrentUser(user: User) {
    localStorage.setItem('almoxarifado_user', user.email);
  }

  async getUsers(): Promise<User[]> {
    await this.fetchAllData();
    return this.cachedUsers;
  }

  async saveUser(user: User): Promise<boolean> {
    const success = await this.postData('saveUser', user);
    if (success) await this.fetchAllData();
    return success;
  }

  async deleteUser(email: string): Promise<boolean> {
    // In our logic, delete is just set active=false, handled by saveUser in UI
    return true; 
  }

  // --- INVENTORY & DASHBOARD ---

  async getProducts(): Promise<Product[]> {
    await this.fetchAllData();
    return this.cachedProducts;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    await this.fetchAllData();
    const totalValue = this.cachedProducts.reduce((acc, p) => acc + (p.currentBalance * p.unitValue), 0);
    const lowStock = this.cachedProducts.filter(p => p.currentBalance <= p.minStock).length;
    
    // Calculate monthly outflow from movements
    const monthlyData = new Map<string, number>();
    const now = new Date();
    
    this.cachedMovements
      .filter(m => m.type === MovementType.EXIT && !m.isReversed)
      .forEach(m => {
        const date = new Date(m.date);
        const key = date.toLocaleString('pt-BR', { month: 'short' }); // Jan, Fev...
        monthlyData.set(key, (monthlyData.get(key) || 0) + m.value);
      });

    const monthlyOutflow = Array.from(monthlyData.entries()).map(([month, value]) => ({ month, value }));

    const topProducts = this.cachedProducts
      .map(p => ({ name: p.name, value: p.initialQty - p.currentBalance })) // Simplistic consumption metric
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalValueStock: totalValue,
      totalItems: this.cachedProducts.length,
      lowStockCount: lowStock,
      monthlyOutflow,
      topProducts
    };
  }

  async getConsolidatedStock(): Promise<{ name: string; totalBalance: number; unit: string }[]> {
    await this.fetchAllData();
    const map = new Map<string, { name: string; totalBalance: number; unit: string }>();

    this.cachedProducts.forEach(p => {
      if (!map.has(p.name)) {
        map.set(p.name, { name: p.name, totalBalance: 0, unit: p.unit });
      }
      const item = map.get(p.name)!;
      item.totalBalance += p.currentBalance;
    });

    return Array.from(map.values()).filter(item => item.totalBalance > 0);
  }

  async calculateDistribution(productName: string, quantityRequested: number): Promise<{ 
    itemsToDeduct: { productId: string; neId: string; qty: number; unitValue: number }[], 
    remainingQty: number 
  }> {
    await this.fetchAllData();
    
    const availableBatches = this.cachedProducts
      .filter(p => p.name === productName && p.currentBalance > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let qtyToDistribute = quantityRequested;
    const itemsToDeduct = [];

    for (const batch of availableBatches) {
      if (qtyToDistribute <= 0) break;

      const take = Math.min(batch.currentBalance, qtyToDistribute);
      itemsToDeduct.push({
        productId: batch.id,
        neId: batch.neId,
        qty: take,
        unitValue: batch.unitValue
      });

      qtyToDistribute -= take;
    }

    return {
      itemsToDeduct,
      remainingQty: qtyToDistribute 
    };
  }

  async executeDistribution(movementsAllocated: { productId: string; neId: string; qty: number; unitValue: number }[], userEmail: string, obs: string): Promise<boolean> {
    const timestamp = new Date().toISOString();
    
    // Prepare movements objects for the backend
    const movementsData = movementsAllocated.map(m => {
      const product = this.cachedProducts.find(p => p.id === m.productId);
      return {
        id: `MOV-${Math.floor(Math.random() * 100000)}`,
        date: timestamp,
        type: MovementType.EXIT,
        neId: m.neId,
        productId: m.productId,
        productName: product ? product.name : 'Unknown',
        quantity: m.qty,
        value: m.qty * m.unitValue,
        userEmail,
        observation: obs,
        isReversed: false
      };
    });

    const success = await this.postData('distribute', { movements: movementsData });
    return success;
  }

  async reverseMovement(movementId: string, userEmail: string): Promise<boolean> {
    // Find original movement to get details
    const movement = this.cachedMovements.find(m => m.id === movementId);
    if (!movement) return false;

    const reversalMovement: Movement = {
      id: `REV-${Math.floor(Math.random() * 100000)}`,
      date: new Date().toISOString(),
      type: MovementType.REVERSAL,
      neId: movement.neId,
      productId: movement.productId,
      productName: movement.productName,
      quantity: movement.quantity,
      value: movement.value,
      userEmail: userEmail,
      observation: `ESTORNO referente à saída: ${movement.id}`,
      isReversed: false
    };

    const success = await this.postData('reverse', { movementId, reversalMovement });
    return success;
  }

  async createNotaEmpenho(neData: { number: string, supplier: string, date: string }, items: any[]): Promise<boolean> {
    const timestamp = new Date().toISOString();

    // 1. Prepare NE Object
    const totalValue = items.reduce((acc, item) => acc + (item.initialQty * item.unitValue), 0);
    const newNE: NotaEmpenho = {
      id: neData.number,
      supplier: neData.supplier,
      date: neData.date,
      status: NEStatus.OPEN,
      totalValue: totalValue
    };

    // 2. Prepare Products and Movements
    const productsPayload: Product[] = [];
    const movementsPayload: Movement[] = [];

    items.forEach((item, index) => {
      const productId = `P-${Date.now()}-${index}`;
      
      const newProduct: Product = {
        id: productId,
        neId: neData.number,
        name: item.name,
        unit: item.unit,
        qtyPerPackage: item.qtyPerPackage,
        initialQty: item.initialQty,
        unitValue: item.unitValue,
        currentBalance: item.initialQty, 
        minStock: item.minStock,
        createdAt: timestamp
      };
      productsPayload.push(newProduct);

      const newMovement: Movement = {
        id: `MOV-IN-${Date.now()}-${index}`,
        date: timestamp,
        type: MovementType.ENTRY,
        neId: neData.number,
        productId: productId,
        productName: item.name,
        quantity: item.initialQty,
        value: item.initialQty * item.unitValue,
        userEmail: 'admin@sys.com', // Ideally current user
        observation: 'Entrada Inicial de Nota de Empenho',
        isReversed: false
      };
      movementsPayload.push(newMovement);
    });

    const success = await this.postData('createNE', { 
      ne: newNE, 
      items: productsPayload, 
      movements: movementsPayload 
    });

    return success;
  }

  async getMovements(): Promise<Movement[]> {
    await this.fetchAllData();
    return this.cachedMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const inventoryService = new InventoryService();
