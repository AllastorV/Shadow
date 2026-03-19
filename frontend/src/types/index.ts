export type UserRole = 'admin' | 'editor' | 'viewer'
export type AssetType = 'image' | 'video' | 'audio' | 'document' | 'other'
export type AssetStatus = 'pending' | 'processing' | 'ready' | 'approved' | 'rejected'
export type SharePermission = 'view' | 'comment' | 'download'

export interface User {
  id: number
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  avatar_url?: string
  created_at: string
}

export interface Project {
  id: number
  name: string
  description?: string
  cover_image_url?: string
  owner_id: number
  owner?: User
  asset_count: number
  created_at: string
  updated_at?: string
}

export interface Asset {
  id: number
  filename: string
  original_name: string
  file_size: number
  mime_type: string
  asset_type: AssetType
  status: AssetStatus
  width?: number
  height?: number
  duration?: number
  ai_description?: string
  ai_tags?: string[]
  ai_scene_type?: string
  ai_objects?: string[]
  ai_colors?: string[]
  ai_transcript?: string
  // Sinema/görsel sektör metadata
  shot_scale?: string
  camera_angle?: string
  camera_movement?: string
  lighting_type?: string
  color_tone?: string
  composition_tags?: string[]
  subject_tags?: string[]
  mood_tags?: string[]
  thumbnail_path?: string
  project_id: number
  uploader_id: number
  created_at: string
  updated_at?: string
  tags: Tag[]
  comment_count: number
}

export interface Tag {
  id: number
  name: string
  is_ai_generated: boolean
}

export interface Comment {
  id: number
  content: string
  timestamp?: number
  x_pos?: number
  y_pos?: number
  is_resolved: boolean
  parent_id?: number
  asset_id: number
  author_id: number
  author?: User
  created_at: string
}

export interface ShareLink {
  id: number
  token: string
  label?: string
  permission: SharePermission
  is_active: boolean
  expires_at?: string
  view_count: number
  download_count?: number
  asset_id: number
  created_at: string
}

export type MarkerColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'orange' | 'cyan'

export interface Marker {
  id: number
  label: string
  note?: string
  color: MarkerColor
  /** Video markeri: saniye cinsinden zaman damgası */
  timestamp?: number
  /** Aralık markeri süresi (saniye, 0 = an markeri) */
  duration_sec?: number
  /** Gorsel markeri: X konumu (%) */
  x_pos?: number
  /** Gorsel markeri: Y konumu (%) */
  y_pos?: number
  asset_id: number
  created_by_id: number
  created_at: string
}

export interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}
