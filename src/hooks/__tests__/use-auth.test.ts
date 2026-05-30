import { renderHook, act } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

const makeProject = (id: string) => ({
  id,
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    test("starts with isLoading as false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    test("returns the result from signInAction on success", async () => {
      const successResult = { success: true };
      vi.mocked(signInAction).mockResolvedValue(successResult);
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([makeProject("proj-1")]);

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signIn("test@example.com", "password123");
      });

      expect(returnValue).toEqual(successResult);
    });

    test("returns error result on failed sign in", async () => {
      const errorResult = { success: false, error: "Invalid credentials" };
      vi.mocked(signInAction).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(returnValue).toEqual(errorResult);
    });

    test("resets isLoading to false after successful sign in", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([makeProject("proj-1")]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false after failed sign in", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign in fails", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "wrongpassword");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("calls signInAction with the provided credentials", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "mypassword");
      });

      expect(signInAction).toHaveBeenCalledWith("user@example.com", "mypassword");
    });

    describe("post sign-in navigation with anon work", () => {
      test("creates project from anon work messages and navigates to it", async () => {
        const anonMessages = [{ role: "user", content: "make a button" }];
        const anonData = { "/App.jsx": { content: "" } };
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue({ messages: anonMessages, fileSystemData: anonData });
        vi.mocked(createProject).mockResolvedValue({ id: "anon-project" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: anonMessages, data: anonData })
        );
        expect(mockPush).toHaveBeenCalledWith("/anon-project");
      });

      test("names the anon project using current time", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue({
          messages: [{ role: "user", content: "hello" }],
          fileSystemData: {},
        });
        vi.mocked(createProject).mockResolvedValue({ id: "proj" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ name: expect.stringMatching(/^Design from /) })
        );
      });

      test("clears anon work after migrating it", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue({
          messages: [{ role: "user", content: "hello" }],
          fileSystemData: {},
        });
        vi.mocked(createProject).mockResolvedValue({ id: "proj" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(clearAnonWork).toHaveBeenCalledOnce();
      });

      test("skips fetching existing projects when anon work has messages", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue({
          messages: [{ role: "user", content: "hello" }],
          fileSystemData: {},
        });
        vi.mocked(createProject).mockResolvedValue({ id: "proj" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(getProjects).not.toHaveBeenCalled();
      });
    });

    describe("post sign-in navigation without anon work", () => {
      test("navigates to the most recent existing project", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([
          makeProject("recent-proj"),
          makeProject("old-proj"),
        ]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-proj");
      });

      test("creates a new project when no existing projects", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([]);
        vi.mocked(createProject).mockResolvedValue({ id: "brand-new" } as any);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new");
      });

      test("does not call createProject when existing projects are found", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([makeProject("proj-1")]);

        const { result } = renderHook(() => useAuth());
        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProject).not.toHaveBeenCalled();
      });
    });
  });

  describe("signUp", () => {
    test("returns the result from signUpAction on success", async () => {
      const successResult = { success: true };
      vi.mocked(signUpAction).mockResolvedValue(successResult);
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([makeProject("proj-1")]);

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signUp("new@example.com", "password123");
      });

      expect(returnValue).toEqual(successResult);
    });

    test("returns error result on failed sign up", async () => {
      const errorResult = { success: false, error: "Email already registered" };
      vi.mocked(signUpAction).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnValue).toEqual(errorResult);
    });

    test("resets isLoading to false after sign up", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([makeProject("proj-1")]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign up fails", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("calls signUpAction with the provided credentials", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Error" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "securepassword");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "securepassword");
    });

    test("creates project from anon work and navigates to it when messages exist", async () => {
      const anonMessages = [{ role: "user", content: "make a form" }];
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue({ messages: anonMessages, fileSystemData: {} });
      vi.mocked(createProject).mockResolvedValue({ id: "new-user-proj" } as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: anonMessages })
      );
      expect(mockPush).toHaveBeenCalledWith("/new-user-proj");
    });

    test("navigates to most recent project when no anon work and projects exist", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([makeProject("user-proj-1")]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/user-proj-1");
    });

    test("creates a new project when no anon work and no existing projects", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "first-proj" } as any);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/first-proj");
    });
  });

  describe("edge cases", () => {
    test("treats anon work with empty messages as no anon work", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
      vi.mocked(getProjects).mockResolvedValue([makeProject("existing-proj")]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
      expect(clearAnonWork).not.toHaveBeenCalled();
    });

    test("treats null anon work data as no anon work", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([makeProject("existing-proj")]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
      expect(clearAnonWork).not.toHaveBeenCalled();
    });

    test("does not call signUpAction when signing in", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Error" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(signUpAction).not.toHaveBeenCalled();
    });

    test("does not call signInAction when signing up", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Error" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(signInAction).not.toHaveBeenCalled();
    });
  });
});
