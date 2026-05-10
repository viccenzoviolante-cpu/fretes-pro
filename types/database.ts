export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Plano = 'trial' | 'active' | 'expired' | 'cancelled'
export type ViagemStatus = 'EM_ANDAMENTO' | 'FINALIZADA'

export type UserRow = {
  id: string
  email: string
  nome: string | null
  telefone: string | null
  modelo_caminhao: string | null
  placa: string | null
  carroceria: string | null
  kml_medio: number | null
  tema: string
  plano: Plano
  trial_inicio: string
  trial_fim: string
  referred_by: string | null
  foto_perfil: string | null
  meta_financeira: number | null
  onboarding_completo: boolean
  corridas_usos: number
  created_at: string
}

export type CaminhaoRow = {
  id: string
  user_id: string
  apelido: string | null
  modelo: string
  placa: string
  carroceria: string | null
  kml_medio: number | null
  capacidade_kg: number | null
  tipos_carga: string[] | null
  is_principal: boolean
  plano_ativo: boolean
  created_at: string
}

export function maskPlaca(placa: string): string {
  const cleaned = placa.replace(/[-\s]/g, '')
  if (cleaned.length <= 3) return placa
  return `***${cleaned.slice(-3)}`
}

export type ViagemRow = {
  id: string
  user_id: string
  data: string
  origem: string
  destino: string
  km: number | null
  tonelada: number | null
  tipo_carga: string | null
  contratante: string | null
  valor_frete: number
  descontos_nota: number
  status: ViagemStatus
  gps_origem_lat: number | null
  gps_origem_lon: number | null
  created_at: string
}

export type DespesaRow = {
  id: string
  user_id: string
  viagem_id: string | null
  categoria: string
  valor: number
  litros: number | null
  data: string
  created_at: string
}

export type CategoriaRow = {
  id: string
  user_id: string
  nome: string
  created_at: string
}

export type PromoCodeRow = {
  id: string
  codigo: string
  trial_dias: number
  usos_max: number | null
  usos_atual: number
  ativo: boolean
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow
        Insert: Omit<UserRow, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<UserRow, 'id' | 'created_at'>>
        Relationships: []
      }
      viagens: {
        Row: ViagemRow
        Insert: Omit<ViagemRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<ViagemRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      despesas: {
        Row: DespesaRow
        Insert: Omit<DespesaRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<DespesaRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      categorias_despesa: {
        Row: CategoriaRow
        Insert: Omit<CategoriaRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<CategoriaRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      promo_codes: {
        Row: PromoCodeRow
        Insert: Omit<PromoCodeRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<PromoCodeRow, 'id' | 'created_at'>>
        Relationships: []
      }
      caminhoes: {
        Row: CaminhaoRow
        Insert: Omit<CaminhaoRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<CaminhaoRow, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      use_promo_code: {
        Args: { code: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
