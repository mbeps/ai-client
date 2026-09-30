import { describe, expect, it } from "vitest";
import { resolveContextSkills } from "@/lib/skills/resolve-context-skills";
import type { SkillRow } from "@/types/skill/skill-row";

const skillOne = {
  id: "sk-1",
  name: "skill-one",
  displayName: "Skill One",
  description: "First",
  content: "One body",
} as SkillRow;

const skillTwo = {
  id: "sk-2",
  name: "skill-two",
  displayName: "Skill Two",
  description: "Second",
  content: "Two body",
} as SkillRow;

const skillThree = {
  id: "sk-3",
  name: "skill-three",
  displayName: "Skill Three",
  description: "Third",
  content: "Three body",
} as SkillRow;

const allSkills = [skillOne, skillTwo, skillThree];

describe("resolveContextSkills", () => {
  describe("mode none", () => {
    it("returns empty catalog and no preloaded skills, ignoring entity ids", () => {
      const result = resolveContextSkills({
        skillMode: "none",
        skillIds: ["sk-1", "sk-2"],
        userSkills: allSkills,
      });

      expect(result.availableSkills).toEqual([]);
      expect(result.selectedSkills).toEqual([]);
    });

    it("returns empty results when there are no user skills at all", () => {
      const result = resolveContextSkills({
        skillMode: "none",
        skillIds: [],
        userSkills: [],
      });

      expect(result).toEqual({ availableSkills: [], selectedSkills: [] });
    });
  });

  describe("mode specific", () => {
    it("preloads configured skills and offers the rest through the catalog", () => {
      const result = resolveContextSkills({
        skillMode: "specific",
        skillIds: ["sk-1"],
        userSkills: allSkills,
      });

      expect(result.selectedSkills).toEqual([skillOne]);
      expect(result.availableSkills.map((s) => s.name)).toEqual([
        "skill-two",
        "skill-three",
      ]);
    });

    it("matches a preloaded skill by name when given the skill name", () => {
      const result = resolveContextSkills({
        skillMode: "specific",
        skillIds: ["skill-two"],
        userSkills: allSkills,
      });

      expect(result.selectedSkills).toEqual([skillTwo]);
      expect(result.availableSkills.map((s) => s.name)).toEqual([
        "skill-one",
        "skill-three",
      ]);
    });

    it("exposes only summary fields in the catalog entries", () => {
      const result = resolveContextSkills({
        skillMode: "specific",
        skillIds: [],
        userSkills: [skillOne],
      });

      expect(result.selectedSkills).toEqual([]);
      expect(result.availableSkills).toEqual([
        {
          name: "skill-one",
          displayName: "Skill One",
          description: "First",
        },
      ]);
    });

    it("ignores the per-chat selection in specific mode", () => {
      const result = resolveContextSkills({
        skillMode: "specific",
        skillIds: ["sk-1"],
        userSkills: allSkills,
        chatSkillIds: ["sk-3"],
      });

      expect(result.selectedSkills).toEqual([skillOne]);
      expect(result.availableSkills.map((s) => s.name)).toEqual([
        "skill-two",
        "skill-three",
      ]);
    });

    it("returns an empty catalog when every skill is preloaded", () => {
      const result = resolveContextSkills({
        skillMode: "specific",
        skillIds: ["sk-1", "skill-two", "sk-3"],
        userSkills: allSkills,
      });

      expect(result.selectedSkills).toHaveLength(3);
      expect(result.availableSkills).toEqual([]);
    });

    it("ignores configured ids that match no user skill", () => {
      const result = resolveContextSkills({
        skillMode: "specific",
        skillIds: ["missing-id"],
        userSkills: allSkills,
      });

      expect(result.selectedSkills).toEqual([]);
      expect(result.availableSkills).toHaveLength(3);
    });
  });

  describe("mode dynamic", () => {
    it("preloads the per-chat selection and catalogs the rest", () => {
      const result = resolveContextSkills({
        skillMode: "dynamic",
        skillIds: ["sk-2"],
        userSkills: allSkills,
        chatSkillIds: ["sk-1"],
      });

      expect(result.selectedSkills).toEqual([skillOne]);
      expect(result.availableSkills.map((s) => s.name)).toEqual([
        "skill-two",
        "skill-three",
      ]);
    });

    it("catalogs every user skill when no per-chat selection is given", () => {
      const result = resolveContextSkills({
        skillMode: "dynamic",
        skillIds: [],
        userSkills: allSkills,
      });

      expect(result.selectedSkills).toEqual([]);
      expect(result.availableSkills).toHaveLength(3);
    });

    it("matches the per-chat selection by skill name", () => {
      const result = resolveContextSkills({
        skillMode: "dynamic",
        skillIds: [],
        userSkills: allSkills,
        chatSkillIds: ["skill-three"],
      });

      expect(result.selectedSkills).toEqual([skillThree]);
      expect(result.availableSkills.map((s) => s.name)).toEqual([
        "skill-one",
        "skill-two",
      ]);
    });

    it("ignores the entity skill ids in dynamic mode", () => {
      const result = resolveContextSkills({
        skillMode: "dynamic",
        skillIds: ["sk-1", "sk-2"],
        userSkills: allSkills,
      });

      expect(result.selectedSkills).toEqual([]);
      expect(result.availableSkills).toHaveLength(3);
    });
  });

  describe("empty inputs", () => {
    it("returns empty results for an empty user skill list in dynamic mode", () => {
      const result = resolveContextSkills({
        skillMode: "dynamic",
        skillIds: [],
        userSkills: [],
      });

      expect(result).toEqual({ availableSkills: [], selectedSkills: [] });
    });

    it("returns empty results for an empty user skill list in specific mode", () => {
      const result = resolveContextSkills({
        skillMode: "specific",
        skillIds: ["sk-1"],
        userSkills: [],
      });

      expect(result).toEqual({ availableSkills: [], selectedSkills: [] });
    });
  });
});