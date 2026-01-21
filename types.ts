
export enum ToolTab {
  DASHBOARD = 'dashboard',
  LIVE_VOICE = 'live_voice',
  IMAGE_STUDIO = 'image_studio',
  VIDEO_GEN = 'video_gen',
  INTELLIGENCE = 'intelligence',
  UTILITIES = 'utilities',
  HEALTH = 'health'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  isThinking?: boolean;
  imageUrl?: string;
  groundingLinks?: { title: string; url: string }[];
}

export enum AspectRatio {
  SQR = '1:1',
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9',
  THREE_FOUR = '3:4',
  FOUR_THREE = '4:3',
  TWENTY_ONE_NINE = '21:9'
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}
