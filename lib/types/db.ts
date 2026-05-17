// PYBF v1 DB 타입.
// supabase/migrations/0001_initial.sql 의 스키마와 1:1.

export type Channel = "instagram" | "facebook" | "threads" | "band";

export type DraftStatus = "generated" | "failed_generation" | "media_cleaned";

export type PublicationStatus =
  | "pending"
  | "success"
  | "failed"
  | "auth_expired";

export type CredentialsProvider = "meta" | "band";

export type StyleSource = "manual" | "analyzed";

export type MediaItem = {
  storage_path: string;
  kind: "image" | "video";
  thumbnail_path?: string;
};

export type GenerationPerChannel = {
  caption: string;
  hashtags?: string[];
};

export type Generations = Partial<Record<Channel, GenerationPerChannel>>;

export type ChannelAccountIds = {
  instagram_id?: string;
  facebook_page_id?: string;
  threads_id?: string;
  band_ids?: string[];
};

export interface UserProfile {
  id: string;
  user_id: string;
  context_text: string;
  default_style_id: string | null;
  updated_at: string;
}

export interface StylePreset {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  source: StyleSource;
  created_at: string;
}

export interface ChannelCredentials {
  id: string;
  user_id: string;
  provider: CredentialsProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  account_ids: ChannelAccountIds;
  updated_at: string;
}

export interface Draft {
  id: string;
  user_id: string;
  created_at: string;
  media: MediaItem[];
  user_text: string;
  style_id: string | null;
  style_freestyle: string | null;
  generations: Generations | null;
  status: DraftStatus;
  media_cleaned_at: string | null;
}

export interface Publication {
  id: string;
  draft_id: string;
  channel: Channel;
  status: PublicationStatus;
  post_url: string | null;
  error_message: string | null;
  attempted_at: string;
}
