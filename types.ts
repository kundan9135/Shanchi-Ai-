
export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system' | 'action';
  message: string;
}

export interface WhatsAppMessage {
  recipient: string;
  content: string;
}
