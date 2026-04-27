export interface ChatSource {
  taskId: string;
  title: string;
  similarity: number;
}

export type ChatMessageRole = 'user' | 'assistant';

export type PendingChatActionType = 'create_task' | 'update_task' | 'delete_task';

export type PendingChatActionStatus = 'pending' | 'confirmed' | 'cancelled';

export interface PendingChatAction {
  id: string;
  actionType: PendingChatActionType;
  status: PendingChatActionStatus;
  summary: string;
  payload: Record<string, unknown>;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  sources: ChatSource[];
  pendingAction: PendingChatAction | null;
  createdAt: string;
}

export interface ChatHistoryResponse {
  items: ChatMessage[];
  nextCursor: string | null;
}

export type ChatStreamEvent =
  | {
      type: 'ack';
      messageId: string;
    }
  | {
      type: 'chunk';
      messageId: string;
      content: string;
    }
  | {
      type: 'pending_action';
      messageId: string;
      pendingAction: PendingChatAction;
    }
  | {
      type: 'message';
      message: ChatMessage;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'done';
    };
