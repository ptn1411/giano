/**
 * Upload API Service
 * Handles file uploads with progress tracking
 * Requirements: 8.1-8.3
 */

import axios from 'axios';
import { apiClient, getAuthToken } from './client';
import { Attachment, UploadProgress } from './types';
import { getApiUrl } from '@/lib/config';

// ============================================
// Types
// ============================================

export interface UploadResult {
  success: boolean;
  attachment?: Attachment;
  error?: string;
}

export type UploadType = 'image' | 'file' | 'voice';

// ============================================
// Upload Service
// ============================================

export const uploadService = {
  /**
   * Upload a file with progress tracking
   * Requirements: 8.1, 8.2, 8.4
   */
  uploadFile: async (
    file: File,
    type: UploadType,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await axios.post<{ attachment: Attachment }>(
        `${getApiUrl()}/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const progress: UploadProgress = {
                loaded: progressEvent.loaded,
                total: progressEvent.total,
                percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
              };
              onProgress(progress);
            }
          },
        }
      );

      return {
        success: true,
        attachment: response.data.attachment,
      };
    } catch (error) {
      let errorMessage = 'Upload failed. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: { message?: string } } } };
        if (axiosError.response?.data?.error?.message) {
          errorMessage = axiosError.response.data.error.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Upload multiple files with individual progress tracking
   */
  uploadMultiple: async (
    files: File[],
    type: UploadType,
    onFileProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const result = await uploadService.uploadFile(
        files[i],
        type,
        onFileProgress ? (progress) => onFileProgress(i, progress) : undefined
      );
      results.push(result);
    }

    return results;
  },

  /**
   * Determine upload type from file MIME type
   */
  getUploadType: (file: File): UploadType => {
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    if (file.type.startsWith('audio/')) {
      return 'voice';
    }
    return 'file';
  },

  /**
   * Validate file before upload
   */
  validateFile: (
    file: File,
    maxSizeMB: number = 50
  ): { valid: boolean; error?: string } => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File size exceeds ${maxSizeMB}MB limit`,
      };
    }

    return { valid: true };
  },
};

export default uploadService;
