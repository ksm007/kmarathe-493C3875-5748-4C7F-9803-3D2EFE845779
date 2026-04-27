import { ChatMessage, PendingChatAction } from '../models/chat';

export interface ChatAskRequest {
  message: string;
}

export interface ChatHistoryQuery {
  limit?: number;
  before?: string;
}

export interface ConfirmPendingChatActionResponse {
  pendingAction: PendingChatAction;
  message: string;
  chatMessage?: ChatMessage;
}
