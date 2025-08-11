import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {apiService} from '@/services/api';
import {Message, MessagesState, User} from '@/types';

const initialState: MessagesState = {
  conversations: [],
  messages: {},
  isLoading: false,
  error: null,
};

// Async thunks

// Get conversations
export const getConversations = createAsyncThunk(
  'messages/getConversations',
  async (_, {rejectWithValue}) => {
    try {
      const response = await apiService.get<{
        conversations: Array<{
          bookingId?: string;
          userId: string;
          user: User;
          lastMessage: Message;
          unreadCount: number;
        }>;
      }>('/messages/conversations');
      return response.conversations;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao carregar conversas');
    }
  }
);

// Get messages for a conversation
export const getMessages = createAsyncThunk(
  'messages/getMessages',
  async (params: {
    bookingId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }, {rejectWithValue}) => {
    try {
      const queryParams = new URLSearchParams();
      if (params.bookingId) queryParams.append('bookingId', params.bookingId);
      if (params.userId) queryParams.append('userId', params.userId);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      
      const response = await apiService.get<{messages: Message[]}>(`/messages?${queryParams}`);
      return {
        conversationKey: params.bookingId || params.userId!,
        messages: response.messages,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao carregar mensagens');
    }
  }
);

// Send message
export const sendMessage = createAsyncThunk(
  'messages/sendMessage',
  async (messageData: {
    bookingId?: string;
    recipientId?: string;
    content: string;
    type?: 'TEXT' | 'IMAGE';
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<Message>('/messages', messageData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao enviar mensagem');
    }
  }
);

// Mark messages as read
export const markAsRead = createAsyncThunk(
  'messages/markAsRead',
  async (params: {
    bookingId?: string;
    userId?: string;
  }, {rejectWithValue}) => {
    try {
      await apiService.post('/messages/mark-read', params);
      return params.bookingId || params.userId!;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao marcar como lida');
    }
  }
);

// Send via WhatsApp
export const sendWhatsAppMessage = createAsyncThunk(
  'messages/sendWhatsAppMessage',
  async (messageData: {
    bookingId: string;
    content: string;
  }, {rejectWithValue}) => {
    try {
      const response = await apiService.post<Message>('/messages/whatsapp', messageData);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Erro ao enviar via WhatsApp');
    }
  }
);

const messagesSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      const message = action.payload;
      const conversationKey = message.bookingId || message.senderId;
      
      if (!state.messages[conversationKey]) {
        state.messages[conversationKey] = [];
      }
      
      state.messages[conversationKey].push(message);
      
      // Update conversation
      const conversation = state.conversations.find(
        c => (c.bookingId && c.bookingId === message.bookingId) || 
             c.userId === message.senderId || 
             c.userId === message.recipientId
      );
      
      if (conversation) {
        conversation.lastMessage = message;
        if (!message.readAt) {
          conversation.unreadCount += 1;
        }
      }
    },
    updateMessage: (state, action: PayloadAction<Message>) => {
      const message = action.payload;
      const conversationKey = message.bookingId || message.senderId;
      
      if (state.messages[conversationKey]) {
        const index = state.messages[conversationKey].findIndex(m => m.id === message.id);
        if (index !== -1) {
          state.messages[conversationKey][index] = message;
        }
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    clearMessages: (state) => {
      state.messages = {};
      state.conversations = [];
    },
  },
  extraReducers: (builder) => {
    // Get Conversations
    builder
      .addCase(getConversations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getConversations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.conversations = action.payload;
        state.error = null;
      })
      .addCase(getConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Get Messages
    builder
      .addCase(getMessages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getMessages.fulfilled, (state, action) => {
        state.isLoading = false;
        const {conversationKey, messages} = action.payload;
        state.messages[conversationKey] = messages;
        state.error = null;
      })
      .addCase(getMessages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Send Message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        const conversationKey = message.bookingId || message.recipientId;
        
        if (!state.messages[conversationKey]) {
          state.messages[conversationKey] = [];
        }
        
        state.messages[conversationKey].push(message);
        
        // Update conversation
        const conversation = state.conversations.find(
          c => (c.bookingId && c.bookingId === message.bookingId) || 
               c.userId === message.recipientId
        );
        
        if (conversation) {
          conversation.lastMessage = message;
        }
        
        state.error = null;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Mark as Read
    builder
      .addCase(markAsRead.fulfilled, (state, action) => {
        const conversationKey = action.payload;
        const conversation = state.conversations.find(
          c => (c.bookingId && c.bookingId === conversationKey) || c.userId === conversationKey
        );
        
        if (conversation) {
          conversation.unreadCount = 0;
        }
        
        // Mark messages as read
        if (state.messages[conversationKey]) {
          state.messages[conversationKey].forEach(message => {
            if (!message.readAt) {
              message.readAt = new Date().toISOString();
            }
          });
        }
      });

    // Send WhatsApp Message
    builder
      .addCase(sendWhatsAppMessage.fulfilled, (state, action) => {
        const message = action.payload;
        const conversationKey = message.bookingId!;
        
        if (!state.messages[conversationKey]) {
          state.messages[conversationKey] = [];
        }
        
        state.messages[conversationKey].push(message);
      });
  },
});

export const {
  addMessage,
  updateMessage,
  clearError,
  clearMessages,
} = messagesSlice.actions;

export default messagesSlice.reducer;