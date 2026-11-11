import type {
  KbGraphEdge,
  KbGraphNode,
} from "@/types/knowledgebase/kb-graph-data";

/**
 * Standard palette mapping document classifications to high-contrast categorical colors.
 * Inspired by Graphify's Tableau-10 community color palette.
 *
 * @author Maruf Bepary
 */
export const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  technical_spec: "#4E79A7", // Steel Blue
  manual: "#F28E2B", // Amber Orange
  policy: "#E15759", // Coral Red
  report: "#76B7B2", // Teal
  reference: "#59A14F", // Green
  general: "#EDC948", // Sand Yellow
};

/**
 * Node position and visualization metadata in the force-directed canvas layout.
 *
 * @author Maruf Bepary
 */
export interface PositionedGraphNode extends KbGraphNode {
  /** X coordinate in world space. */
  x: number;
  /** Y coordinate in world space. */
  y: number;
  /** Display radius in pixels, scaled by connection degree. */
  radius: number;
  /** Total number of inbound and outbound edges. */
  degree: number;
  /** Visual categorical color hex. */
  color: string;
}

/**
 * 2D camera viewport state for panning and zooming the canvas.
 *
 * @author Maruf Bepary
 */
export interface GraphCamera {
  /** World X offset at the viewport center. */
  x: number;
  /** World Y offset at the viewport center. */
  y: number;
  /** Zoom scale factor (1 = 100%). */
  scale: number;
}

/**
 * Converts a world-space point to screen coordinates.
 *
 * @param wx - World X
 * @param wy - World Y
 * @param camera - Active camera state
 * @param width - Viewport width
 * @param height - Viewport height
 * @returns Screen coordinate point
 * @author Maruf Bepary
 */
export function worldToScreen(
  wx: number,
  wy: number,
  camera: GraphCamera,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: width / 2 + (wx - camera.x) * camera.scale,
    y: height / 2 + (wy - camera.y) * camera.scale,
  };
}

/**
 * Converts a screen-space point to world coordinates.
 *
 * @param sx - Screen X
 * @param sy - Screen Y
 * @param camera - Active camera state
 * @param width - Viewport width
 * @param height - Viewport height
 * @returns World coordinate point
 * @author Maruf Bepary
 */
export function screenToWorld(
  sx: number,
  sy: number,
  camera: GraphCamera,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: camera.x + (sx - width / 2) / camera.scale,
    y: camera.y + (sy - height / 2) / camera.scale,
  };
}

/**
 * Performs reverse-order hit testing to find the topmost node under a world-space point.
 *
 * @param nodes - Positioned nodes array
 * @param wx - World X coordinate
 * @param wy - World Y coordinate
 * @param hitPadding - Extra pointer tolerance in world units (defaults to 4)
 * @returns Matching node or null
 * @author Maruf Bepary
 */
export function findNodeAtPoint(
  nodes: PositionedGraphNode[],
  wx: number,
  wy: number,
  hitPadding = 4,
): PositionedGraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const dx = wx - node.x;
    const dy = wy - node.y;
    const hitRadius = node.radius + hitPadding;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return node;
    }
  }
  return null;
}

/**
 * Computes an optimal camera viewport centering and scaling to fit all visible nodes.
 *
 * @param nodes - Positioned nodes array
 * @param width - Viewport width
 * @param height - Viewport height
 * @param padding - Viewport margin in pixels (defaults to 60)
 * @returns Camera state
 * @author Maruf Bepary
 */
export function computeFitCamera(
  nodes: PositionedGraphNode[],
  width: number,
  height: number,
  padding = 60,
): GraphCamera {
  if (nodes.length === 0) {
    return { x: 0, y: 0, scale: 1 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.radius);
    maxX = Math.max(maxX, n.x + n.radius);
    minY = Math.min(minY, n.y - n.radius);
    maxY = Math.max(maxY, n.y + n.radius);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);

  const availWidth = Math.max(10, width - padding * 2);
  const availHeight = Math.max(10, height - padding * 2);

  const scale = Math.min(
    1.5,
    Math.max(0.2, Math.min(availWidth / graphWidth, availHeight / graphHeight)),
  );

  return { x: cx, y: cy, scale };
}

/**
 * Computes a deterministic force-directed layout for knowledgebase documents and relationship edges.
 *
 * Places nodes on an initial golden-angle spiral, filters dangling edges and self-loops, applies
 * pairwise inverse-square repulsion, edge spring-attraction, and center gravity, and centers the network at (0, 0).
 *
 * ponytail: ceiling is ~1,000 nodes due to O(N^2) pairwise repulsion pre-stabilization.
 * If knowledge bases exceed 1,000 documents, upgrade to Barnes-Hut quadtree or d3-force worker.
 *
 * @param documents - Raw knowledge base documents
 * @param relations - Raw relationship edges
 * @param options - Custom iteration options
 * @returns Positioned nodes, validated edges, and 1-hop bidirectional adjacency map
 * @author Maruf Bepary
 */
export function computeForceGraphLayout(
  documents: KbGraphNode[],
  relations: KbGraphEdge[],
  options?: { iterations?: number },
): {
  nodes: PositionedGraphNode[];
  edges: KbGraphEdge[];
  adjacency: Map<string, Set<string>>;
} {
  if (documents.length === 0) {
    return { nodes: [], edges: [], adjacency: new Map() };
  }

  const docIdSet = new Set(documents.map((d) => d.id));
  const adjacency = new Map<string, Set<string>>();
  for (const doc of documents) {
    adjacency.set(doc.id, new Set<string>());
  }

  const degreeMap = new Map<string, number>();
  const validEdges: KbGraphEdge[] = [];

  for (const rel of relations) {
    if (rel.sourceDocId === rel.targetDocId) continue;
    if (!docIdSet.has(rel.sourceDocId) || !docIdSet.has(rel.targetDocId)) {
      continue;
    }

    validEdges.push(rel);
    degreeMap.set(rel.sourceDocId, (degreeMap.get(rel.sourceDocId) ?? 0) + 1);
    degreeMap.set(rel.targetDocId, (degreeMap.get(rel.targetDocId) ?? 0) + 1);
    adjacency.get(rel.sourceDocId)?.add(rel.targetDocId);
    adjacency.get(rel.targetDocId)?.add(rel.sourceDocId);
  }

  if (documents.length === 1) {
    const single = documents[0];
    const color =
      DOCUMENT_TYPE_COLORS[single.documentType] ?? DOCUMENT_TYPE_COLORS.general;
    return {
      nodes: [
        {
          ...single,
          x: 0,
          y: 0,
          radius: 12,
          degree: 0,
          color,
        },
      ],
      edges: [],
      adjacency,
    };
  }

  // Deterministic golden-angle spiral placement
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodes: PositionedGraphNode[] = documents.map((doc, index) => {
    const degree = degreeMap.get(doc.id) ?? 0;
    const radius = Math.min(22, 6 + Math.sqrt(degree) * 2.5);
    const color =
      DOCUMENT_TYPE_COLORS[doc.documentType] ?? DOCUMENT_TYPE_COLORS.general;

    const dist = 35 * Math.sqrt(index + 1);
    const angle = index * goldenAngle;
    return {
      ...doc,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius,
      degree,
      color,
    };
  });

  const nodeMap = new Map<string, PositionedGraphNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const iterations = options?.iterations ?? (nodes.length > 150 ? 120 : 180);
  const k = Math.max(40, 300 / Math.sqrt(nodes.length));
  const repulsionStrength = k * k;
  const springLength = 70;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = (1 - iter / iterations) * 0.4;
    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);

    // Pairwise repulsion
    for (let i = 0; i < nodes.length; i++) {
      const u = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[j];
        const dx = u.x - v.x;
        const dy = u.y - v.y;
        const d = Math.hypot(dx, dy);

        const force = repulsionStrength / (d * d);
        const fX = (dx / d) * force;
        const fY = (dy / d) * force;

        fx[i] += fX;
        fy[i] += fY;
        fx[j] -= fX;
        fy[j] -= fY;
      }
    }

    // Edge spring attraction
    for (const edge of validEdges) {
      const u = nodeMap.get(edge.sourceDocId)!;
      const v = nodeMap.get(edge.targetDocId)!;

      const idxU = nodes.indexOf(u);
      const idxV = nodes.indexOf(v);
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const displacement = d - springLength;
      const force = displacement * 0.05;

      const fX = (dx / d) * force;
      const fY = (dy / d) * force;

      fx[idxU] += fX;
      fy[idxU] += fY;
      fx[idxV] -= fX;
      fy[idxV] -= fY;
    }

    // Apply movement with mild center gravity
    for (let i = 0; i < nodes.length; i++) {
      fx[i] -= nodes[i].x * 0.02;
      fy[i] -= nodes[i].y * 0.02;

      nodes[i].x += fx[i] * temp;
      nodes[i].y += fy[i] * temp;
    }
  }

  // Recenter at (0, 0)
  let sumX = 0;
  let sumY = 0;
  for (const n of nodes) {
    sumX += n.x;
    sumY += n.y;
  }
  const avgX = sumX / nodes.length;
  const avgY = sumY / nodes.length;
  for (const n of nodes) {
    n.x -= avgX;
    n.y -= avgY;
  }

  return { nodes, edges: validEdges, adjacency };
}
