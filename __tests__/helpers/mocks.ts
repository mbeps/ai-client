import { vi } from "vitest";

/**
 * Shared mock for the requireSession helper used in Server Actions.
 * Centralises the return of a standard test user and session.
 */
export function mockRequireSession(userOverrides = {}) {
  const defaultUser = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    twoFactorEnabled: false,
  };

  return vi.mock("@/lib/actions/require-session", () => ({
    requireSession: vi.fn().mockResolvedValue({
      user: { ...defaultUser, ...userOverrides },
      session: {
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 3600000),
      },
    }),
  }));
}

/**
 * Standard S3/MinIO mocks for bucket operations and file handling.
 */
export const mockSend = vi.fn();

export function mockS3Client() {
  vi.mock("@aws-sdk/client-s3", () => ({
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn().mockImplementation((params) => ({
      _type: "PutObjectCommand",
      ...params,
    })),
    GetObjectCommand: vi.fn().mockImplementation((params) => ({
      _type: "GetObjectCommand",
      ...params,
    })),
    DeleteObjectCommand: vi.fn().mockImplementation((params) => ({
      _type: "DeleteObjectCommand",
      ...params,
    })),
    DeleteObjectsCommand: vi.fn().mockImplementation((params) => ({
      _type: "DeleteObjectsCommand",
      ...params,
    })),
    HeadBucketCommand: vi.fn().mockImplementation((params) => ({
      _type: "HeadBucketCommand",
      ...params,
    })),
    CreateBucketCommand: vi.fn().mockImplementation((params) => ({
      _type: "CreateBucketCommand",
      ...params,
    })),
  }));

  vi.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: vi
      .fn()
      .mockResolvedValue("https://example.com/presigned-url"),
  }));
}
