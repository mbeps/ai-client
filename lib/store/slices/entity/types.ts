import { StateCreator } from "zustand";
import { AppState } from "@/types/app-state";

/** Zustand state setter type for entity actions. */
export type EntitySet = Parameters<StateCreator<AppState>>[0];
