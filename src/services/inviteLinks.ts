import { apiClient } from "./api/client";

export interface CreateInviteLinkRequest {
  type: "group" | "direct";
  chatId?: string;
  expiresIn?: number; // seconds
  maxUses?: number;
}

export interface InviteLink {
  id: string;
  code: string;
  type: "group" | "direct";
  chatId?: string;
  chatName?: string;
  createdBy: string;
  creatorName: string;
  expiresAt?: string;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
  url: string;
  createdAt: string;
}

export interface UseInviteLinkResponse {
  chatId: string;
  chatName: string;
  chatType: string;
  joined: boolean;
}

export const inviteLinksApi = {
  // Create a new invite link
  createInviteLink: async (
    request: CreateInviteLinkRequest
  ): Promise<InviteLink> => {
    const response = await apiClient.post("/invite-links", request);
    return response.data;
  },

  // Get invite link by code
  getInviteLink: async (code: string): Promise<InviteLink> => {
    const response = await apiClient.get(`/invite-links/${code}`);
    return response.data;
  },

  // Use an invite link
  useInviteLink: async (code: string): Promise<UseInviteLinkResponse> => {
    const response = await apiClient.post(`/invite-links/${code}/use`, {});
    return response.data;
  },

  // Get all invite links created by the current user
  getMyInviteLinks: async (): Promise<InviteLink[]> => {
    const response = await apiClient.get("/invite-links/my");
    return response.data;
  },

  // Revoke an invite link
  revokeInviteLink: async (id: string): Promise<void> => {
    await apiClient.post(`/invite-links/${id}/revoke`, {});
  },
};
